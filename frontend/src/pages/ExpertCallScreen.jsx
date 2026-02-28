/**
 * KisanCall — Expert Call Screen
 *
 * RACE-CONDITION FIX (two-pronged approach):
 *
 * Problem: Farmer navigates to CallScreen and sends offer via POST /api/offer.
 * The backend tries to forward it to expert WS, but expert may not have
 * authenticated the new WS yet (they just navigated here from ExpertDashboard).
 *
 * Solution:
 *  1. Farmer now waits 2.5s before sending the offer (gives expert time to load).
 *  2. Expert always polls /call/status AFTER WS auth to get the stored offer_sdp
 *     as a guaranteed fallback (DB fallback fires at 5s max wait).
 *  3. ICE candidates are buffered until remote description is set.
 *
 * Flow:
 *  - Open /ws/expert WebSocket
 *  - On WS 'connected' (auth success): schedule DB poll at 3s as fallback
 *  - If webrtc_offer arrives on WS first → process it immediately, cancel poll
 *  - DB poll: check /call/status for saved offer_sdp → process it
 *  - Either way: get mic, create PC, set remote description, send answer
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../AuthContext';

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
];

export default function ExpertCallScreen() {
    const { callId } = useParams();
    const { token } = useAuth();
    const navigate = useNavigate();

    const [callStatus, setCallStatus] = useState('waiting');
    const [farmerName, setFarmerName] = useState('Farmer');
    const [statusMsg, setStatusMsg] = useState('Waiting for farmer to connect...');
    const [timer, setTimer] = useState(0);
    const [muted, setMuted] = useState(false);
    const [ending, setEnding] = useState(false);
    const [followupNote, setFollowupNote] = useState('');
    const [showFollowup, setShowFollowup] = useState(false);
    const [savingNote, setSavingNote] = useState(false);

    const localStreamRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const pcRef = useRef(null);
    const wsRef = useRef(null);
    const timerRef = useRef(null);
    const answerDoneRef = useRef(false);  // prevent double-answer
    const iceCandidateQueueRef = useRef([]); // buffer ICE candidates until remote desc is set
    const remoteDescSetRef = useRef(false);  // track if setRemoteDescription done

    const startTimer = useCallback(() => {
        if (timerRef.current) return;
        timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    }, []);

    const stopTimer = useCallback(() => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }, []);

    const formatTime = (s) =>
        `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    // ─── Create RTCPeerConnection and get mic ──────────────────────────────────
    const initPC = useCallback(async () => {
        try {
            setStatusMsg('Accessing microphone...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;

            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            pcRef.current = pc;
            stream.getTracks().forEach((t) => pc.addTrack(t, stream));

            pc.ontrack = (e) => {
                if (remoteAudioRef.current) {
                    remoteAudioRef.current.srcObject = e.streams[0];
                    remoteAudioRef.current.play().catch(() => { });
                }
            };

            pc.onicecandidate = async (e) => {
                if (e.candidate) {
                    try {
                        await api.post('/api/ice-candidate', {
                            call_id: callId,
                            candidate: e.candidate.candidate,
                            sdp_mid: e.candidate.sdpMid,
                            sdp_mline_index: e.candidate.sdpMLineIndex,
                        });
                    } catch { }
                }
            };

            pc.onconnectionstatechange = () => {
                console.log('[ExpertCallScreen] connectionState:', pc.connectionState);
                if (pc.connectionState === 'connected') {
                    setCallStatus('active');
                    setStatusMsg('');
                    startTimer();
                } else if (['disconnected', 'failed'].includes(pc.connectionState)) {
                    setCallStatus('ended');
                    stopTimer();
                    setShowFollowup(true);
                }
            };

            return pc;
        } catch (err) {
            console.error('[ExpertCallScreen] initPC error:', err);
            setStatusMsg(`Microphone error: ${err.message}`);
            return null;
        }
    }, [callId, startTimer, stopTimer]);

    // ─── Process a received offer (from WS or DB fallback) ───────────────────
    const processOffer = useCallback(async (offerSdp, sdpType = 'offer') => {
        if (answerDoneRef.current) return;   // don't answer twice
        answerDoneRef.current = true;

        setStatusMsg('Processing farmer\'s call offer...');
        const pc = await initPC();
        if (!pc) { answerDoneRef.current = false; return; }

        try {
            await pc.setRemoteDescription({ type: sdpType, sdp: offerSdp });
            remoteDescSetRef.current = true;

            // Flush any ICE candidates that arrived before remote description was set
            for (const candidate of iceCandidateQueueRef.current) {
                try {
                    await pc.addIceCandidate(candidate);
                } catch { /* non-fatal */ }
            }
            iceCandidateQueueRef.current = [];

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            setStatusMsg('Sending answer...');
            await api.post('/api/answer', {
                call_id: callId,
                sdp: answer.sdp,
                type: answer.type,
            });

            setStatusMsg('Answer sent. Establishing connection...');
        } catch (err) {
            console.error('[ExpertCallScreen] processOffer error:', err);
            setStatusMsg(`Failed to process offer: ${err.message}`);
            answerDoneRef.current = false;
        }
    }, [callId, initPC]);

    // ─── WebSocket + DB fallback for offer ────────────────────────────────────
    useEffect(() => {
        if (!token) return;

        // Fetch call info to get farmer name
        api.get(`/call/status/${callId}`)
            .then((res) => {
                setFarmerName(res.data.farmer_name || 'Farmer');
            })
            .catch(() => { });

        const ws = new WebSocket('ws://localhost:8000/ws/expert');
        wsRef.current = ws;

        // DB fallback timer — scheduled AFTER WS authenticates
        // Farmer waits 2.5s before sending offer, so we check DB at 3s after auth.
        let dbFallbackTimer = null;

        const scheduleDbFallback = () => {
            if (dbFallbackTimer) return;
            dbFallbackTimer = setTimeout(async () => {
                if (answerDoneRef.current) return; // offer already handled via WS
                console.log('[ExpertCallScreen] Checking DB for stored offer_sdp (fallback)...');
                try {
                    const res = await api.get(`/call/status/${callId}`);
                    if (res.data.offer_sdp && !answerDoneRef.current) {
                        console.log('[ExpertCallScreen] Found stored offer in DB — processing fallback');
                        processOffer(res.data.offer_sdp, 'offer');
                    } else if (!answerDoneRef.current) {
                        // Offer not in DB yet — wait another 2s and try once more
                        setTimeout(async () => {
                            if (answerDoneRef.current) return;
                            const res2 = await api.get(`/call/status/${callId}`);
                            if (res2.data.offer_sdp && !answerDoneRef.current) {
                                console.log('[ExpertCallScreen] Found stored offer in DB — processing fallback (retry)');
                                processOffer(res2.data.offer_sdp, 'offer');
                            }
                        }, 2000);
                    }
                } catch { }
            }, 3000); // 3s after auth: farmer will have sent offer by now
        };

        ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));

        ws.onmessage = async (e) => {
            let msg;
            try { msg = JSON.parse(e.data); } catch { return; }

            if (msg.type === 'connected') {
                // WS authenticated — schedule DB fallback from NOW
                console.log('[WS:expert] authenticated on ExpertCallScreen');
                scheduleDbFallback();

            } else if (msg.type === 'webrtc_offer') {
                // Fresh offer from WS — cancel DB fallback and process immediately
                if (dbFallbackTimer) { clearTimeout(dbFallbackTimer); dbFallbackTimer = null; }
                await processOffer(msg.sdp, msg.sdp_type || 'offer');

            } else if (msg.type === 'ice_candidate' && pcRef.current) {
                const candidateInit = {
                    candidate: msg.candidate,
                    sdpMid: msg.sdp_mid,
                    sdpMLineIndex: msg.sdp_mline_index,
                };
                if (!remoteDescSetRef.current) {
                    // Buffer until remote description is set
                    iceCandidateQueueRef.current.push(candidateInit);
                } else {
                    try {
                        await pcRef.current.addIceCandidate(candidateInit);
                    } catch { }
                }

            } else if (msg.type === 'call_ended') {
                setCallStatus('ended');
                stopTimer();
                setShowFollowup(true);
            }
        };

        ws.onerror = (err) => console.warn('[WS:expert] error', err);
        ws.onclose = () => console.log('[WS:expert] closed');

        return () => {
            if (dbFallbackTimer) clearTimeout(dbFallbackTimer);
            ws.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, callId]);

    // ─── Hang up ─────────────────────────────────────────────────────────────
    const hangUp = useCallback(async () => {
        if (ending) return;
        setEnding(true);
        stopTimer();
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        pcRef.current?.close();
        pcRef.current = null;
        try { await api.post(`/call/end/${callId}`); } catch { }
        wsRef.current?.close();
        setCallStatus('ended');
        setEnding(false);
        setShowFollowup(true);
    }, [callId, ending, stopTimer]);

    // ─── Save follow-up note ──────────────────────────────────────────────────
    const saveNote = async () => {
        if (!followupNote.trim()) { navigate('/expert'); return; }
        setSavingNote(true);
        try {
            await api.post(`/expert/followup/${callId}`, { note: followupNote });
        } catch { }
        setSavingNote(false);
        navigate('/expert');
    };

    const toggleMute = () => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) { track.enabled = !track.enabled; setMuted((m) => !m); }
    };

    useEffect(() => {
        return () => { stopTimer(); localStreamRef.current?.getTracks().forEach((t) => t.stop()); };
    }, [stopTimer]);

    // ─── Follow-up note screen (after call) ───────────────────────────────────
    if (showFollowup) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div className="card fade-in" style={{ width: '100%', maxWidth: '480px' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem', textAlign: 'center' }}>✅</div>
                    <h2 className="heading-md" style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Call Ended</h2>
                    <p className="subtext" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        Add a follow-up note for {farmerName} (optional):
                    </p>
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label" htmlFor="followup-note">Follow-up Note</label>
                        <textarea
                            id="followup-note"
                            className="form-input"
                            rows={5}
                            placeholder="E.g. Apply neem oil spray every 3 days. Recheck in 2 weeks..."
                            value={followupNote}
                            onChange={(e) => setFollowupNote(e.target.value)}
                            style={{ resize: 'vertical' }}
                        />
                    </div>
                    <button id="save-note-btn" className="btn btn-primary btn-full" onClick={saveNote} disabled={savingNote}>
                        {savingNote ? 'Saving...' : followupNote.trim() ? 'Save & Done' : 'Skip →'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh', background: 'var(--bg-deep)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', padding: '2rem',
        }}>
            <div className="bg-blobs"><div className="blob blob-1" /><div className="blob blob-2" /></div>
            <audio ref={remoteAudioRef} autoPlay playsInline />

            <div className="card fade-in content" style={{ width: '100%', maxWidth: '440px', textAlign: 'center' }}>

                {callStatus === 'waiting' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                        <div className="spinner" />
                        <p style={{ color: 'var(--gold-400)', fontWeight: 600 }}>Waiting for {farmerName} to connect...</p>
                        {statusMsg && <p className="subtext" style={{ fontSize: '0.8rem' }}>{statusMsg}</p>}
                    </div>
                )}

                {callStatus === 'active' && (
                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{
                            width: 80, height: 80, borderRadius: '50%', margin: '0 auto 1rem',
                            background: 'linear-gradient(135deg, var(--gold-500), var(--gold-400))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '2.5rem', boxShadow: '0 0 40px rgba(245,158,11,0.35)',
                        }}>🌾</div>
                        <h2 style={{ marginBottom: '0.25rem' }}>{farmerName}</h2>
                        <p className="subtext" style={{ fontSize: '0.85rem' }}>Farmer</p>
                    </div>
                )}

                {callStatus === 'active' && (
                    <div style={{
                        fontFamily: 'monospace', fontSize: '2rem', fontWeight: 700,
                        color: 'var(--gold-400)', marginBottom: '2rem', letterSpacing: '0.05em',
                    }}>
                        {formatTime(timer)}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        className="btn btn-ghost"
                        onClick={toggleMute}
                        style={{ minWidth: '130px' }}
                        disabled={callStatus !== 'active'}
                    >
                        {muted ? '🔇 Unmute' : '🎙️ Mute'}
                    </button>
                    <button
                        id="expert-hangup-btn"
                        className="btn btn-danger"
                        onClick={hangUp}
                        disabled={ending || callStatus === 'ended'}
                        style={{ minWidth: '130px' }}
                    >
                        {ending ? 'Ending...' : '📵 End Call'}
                    </button>
                </div>

                <p className="subtext" style={{ marginTop: '1.5rem', fontSize: '0.8rem' }}>
                    You'll be able to add a follow-up note after the call.
                </p>
            </div>
        </div>
    );
}
