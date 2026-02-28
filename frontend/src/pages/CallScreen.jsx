/**
 * KisanCall — Call Screen (Farmer side)
 *
 * FIX: The call is already "active" when the farmer navigates here
 * (FarmerDashboard navigated after receiving call_accepted via WS).
 * So we IMMEDIATELY call setupCall() on mount without waiting for
 * another call_accepted event. The WS is only needed for:
 *   - webrtc_answer   → set remote description
 *   - ice_candidate   → add ICE candidate
 *   - call_ended      → hang up
 *
 * RACE-CONDITION FIX:
 * We wait 2.5s before sending the offer to give the expert time to:
 *   1. Navigate to ExpertCallScreen
 *   2. Load the page and open /ws/expert
 *   3. Authenticate the new WebSocket
 * Without this delay the offer arrives at the wrong (ExpertDashboard)
 * WebSocket that is in the process of closing, and gets silently dropped.
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

export default function CallScreen() {
    const { callId } = useParams();
    const { token } = useAuth();
    const navigate = useNavigate();

    const [callStatus, setCallStatus] = useState('connecting');
    const [expertName, setExpertName] = useState('Expert');
    const [statusMsg, setStatusMsg] = useState('Starting call...');
    const [timer, setTimer] = useState(0);
    const [muted, setMuted] = useState(false);
    const [ending, setEnding] = useState(false);

    const localStreamRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const pcRef = useRef(null);
    const wsRef = useRef(null);
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const setupDoneRef = useRef(false);   // prevent double-init

    // ─── Timer helpers ────────────────────────────────────────────────────────
    const startTimer = useCallback(() => {
        if (timerRef.current) return;
        timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    }, []);

    const stopTimer = useCallback(() => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }, []);

    const formatTime = (s) =>
        `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    // ─── WebRTC setup (Farmer creates offer) ─────────────────────────────────
    const setupCall = useCallback(async () => {
        if (setupDoneRef.current) return;   // idempotent
        setupDoneRef.current = true;

        try {
            setStatusMsg('Accessing microphone...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;

            // Start recording immediately
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.start(1000);
            recorderRef.current = recorder;

            setStatusMsg('Establishing connection...');
            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            pcRef.current = pc;
            stream.getTracks().forEach((t) => pc.addTrack(t, stream));

            // Remote audio output
            pc.ontrack = (e) => {
                if (remoteAudioRef.current) {
                    remoteAudioRef.current.srcObject = e.streams[0];
                    remoteAudioRef.current.play().catch(() => { });
                }
            };

            // Buffer ICE candidates until after offer is sent
            const iceCandidateQueue = [];
            let offerSent = false;

            // Relay ICE candidates to expert via backend
            pc.onicecandidate = async (e) => {
                if (e.candidate) {
                    if (!offerSent) {
                        // Buffer candidates until offer is sent
                        iceCandidateQueue.push(e.candidate);
                        return;
                    }
                    try {
                        await api.post('/api/ice-candidate', {
                            call_id: callId,
                            candidate: e.candidate.candidate,
                            sdp_mid: e.candidate.sdpMid,
                            sdp_mline_index: e.candidate.sdpMLineIndex,
                        });
                    } catch { /* non-fatal */ }
                }
            };

            pc.onconnectionstatechange = () => {
                console.log('[CallScreen] connectionState:', pc.connectionState);
                if (pc.connectionState === 'connected') {
                    setCallStatus('active');
                    setStatusMsg('');
                    startTimer();
                } else if (['disconnected', 'failed'].includes(pc.connectionState)) {
                    setCallStatus('error');
                    setStatusMsg('Connection lost. Please hang up and try again.');
                    stopTimer();
                }
            };

            // ── RACE-CONDITION FIX ────────────────────────────────────────────
            // Wait 2.5s so the expert has time to:
            //   1. Navigate to ExpertCallScreen
            //   2. Open and authenticate /ws/expert
            // Without this delay the offer arrives at the ExpertDashboard WS
            // that is in the process of closing and the message is dropped.
            setStatusMsg('Connecting to expert... please wait.');
            await new Promise((r) => setTimeout(r, 2500));

            // Create and send offer → backend stores + forwards to expert's WS
            setStatusMsg('Sending call offer to expert...');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await api.post('/api/offer', { call_id: callId, sdp: offer.sdp, type: offer.type });
            offerSent = true;

            // Flush buffered ICE candidates
            for (const candidate of iceCandidateQueue) {
                try {
                    await api.post('/api/ice-candidate', {
                        call_id: callId,
                        candidate: candidate.candidate,
                        sdp_mid: candidate.sdpMid,
                        sdp_mline_index: candidate.sdpMLineIndex,
                    });
                } catch { /* non-fatal */ }
            }

            setStatusMsg('Waiting for expert to answer...');

        } catch (err) {
            console.error('[CallScreen] setupCall error:', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setStatusMsg('Microphone access denied. Please allow microphone access and refresh.');
            } else {
                setStatusMsg(`Failed to connect: ${err.message}`);
            }
            setCallStatus('error');
            setupDoneRef.current = false; // allow retry
        }
    }, [callId, startTimer, stopTimer]);

    // ─── WebSocket for signaling + call status push ───────────────────────────
    useEffect(() => {
        if (!token) return;

        // ── Step 1: Fetch call info first to get expert name ─────────────────
        api.get(`/call/status/${callId}`)
            .then((res) => {
                const c = res.data;
                setExpertName(c.expert_name || 'Expert');
                if (c.status === 'ended') {
                    setCallStatus('ended');
                    return;
                }
                // Call is active (or still transitioning) — start WebRTC immediately
                setupCall();
            })
            .catch(() => {
                setCallStatus('error');
                setStatusMsg('Could not retrieve call information.');
            });

        // ── Step 2: Open WS for ongoing signaling (answer + ICE) ─────────────
        const ws = new WebSocket('ws://localhost:8000/ws/farmer');
        wsRef.current = ws;

        ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));

        ws.onmessage = async (e) => {
            let msg;
            try { msg = JSON.parse(e.data); } catch { return; }

            if (msg.type === 'webrtc_answer' && pcRef.current) {
                // Expert answered — set remote description to complete handshake
                try {
                    await pcRef.current.setRemoteDescription({
                        type: msg.sdp_type || 'answer',
                        sdp: msg.sdp,
                    });
                    setStatusMsg('Answer received. Negotiating...');
                } catch (err) {
                    console.error('[CallScreen] setRemoteDescription error:', err);
                }

            } else if (msg.type === 'ice_candidate' && pcRef.current) {
                try {
                    await pcRef.current.addIceCandidate({
                        candidate: msg.candidate,
                        sdpMid: msg.sdp_mid,
                        sdpMLineIndex: msg.sdp_mline_index,
                    });
                } catch { /* non-fatal */ }

            } else if (msg.type === 'call_ended') {
                hangUp(false);
            } else if (msg.type === 'connected') {
                console.log('[WS:farmer] authenticated on CallScreen');
            }
        };

        ws.onerror = (err) => console.warn('[WS:farmer] error', err);
        ws.onclose = () => console.log('[WS:farmer] closed');

        return () => {
            ws.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, callId]);

    // ─── Hang up ─────────────────────────────────────────────────────────────
    const hangUp = useCallback(async (notify = true) => {
        if (ending) return;
        setEnding(true);
        stopTimer();

        // Stop recording and collect final chunk
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
            await new Promise((res) => setTimeout(res, 500));
        }

        // Stop mic tracks
        localStreamRef.current?.getTracks().forEach((t) => t.stop());

        // Close peer connection
        pcRef.current?.close();
        pcRef.current = null;

        // Upload recording to backend for AI transcription
        if (chunksRef.current.length > 0) {
            try {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const fd = new FormData();
                fd.append('audio', blob, 'recording.webm');
                await api.post(`/call/recording/${callId}`, fd);
            } catch (err) {
                console.warn('[CallScreen] recording upload failed:', err);
            }
        }

        // End the call via API
        if (notify) {
            try { await api.post(`/call/end/${callId}`); } catch { }
        }

        wsRef.current?.close();
        navigate(`/summary/${callId}`);
    }, [callId, ending, navigate, stopTimer]);

    // ─── Mute toggle ──────────────────────────────────────────────────────────
    const toggleMute = () => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) { track.enabled = !track.enabled; setMuted((m) => !m); }
    };

    // ─── Cleanup on unmount ───────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            stopTimer();
            localStreamRef.current?.getTracks().forEach((t) => t.stop());
        };
    }, [stopTimer]);

    // ─── UI ───────────────────────────────────────────────────────────────────
    return (
        <div style={{
            minHeight: '100vh', background: 'var(--bg-deep)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', padding: '2rem',
        }}>
            <div className="bg-blobs"><div className="blob blob-1" /><div className="blob blob-2" /></div>
            <audio ref={remoteAudioRef} autoPlay playsInline />

            <div className="card fade-in content" style={{ width: '100%', maxWidth: '440px', textAlign: 'center' }}>

                {/* ── Connecting state ── */}
                {callStatus === 'connecting' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                        <div className="spinner" />
                        <p style={{ color: 'var(--green-400)', fontWeight: 600 }}>Connecting to {expertName}...</p>
                        {statusMsg && <p className="subtext" style={{ fontSize: '0.8rem' }}>{statusMsg}</p>}
                    </div>
                )}

                {/* ── Active call ── */}
                {callStatus === 'active' && (
                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{
                            width: 80, height: 80, borderRadius: '50%', margin: '0 auto 1rem',
                            background: 'linear-gradient(135deg, var(--green-600), var(--green-500))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '2.5rem', boxShadow: '0 0 40px rgba(34,197,94,0.4)',
                            animation: 'pulsate 2s ease-in-out infinite alternate',
                        }}>👨‍🌾</div>
                        <h2 style={{ marginBottom: '0.25rem' }}>{expertName}</h2>
                        <p className="subtext" style={{ fontSize: '0.85rem' }}>Agriculture Expert</p>
                    </div>
                )}

                {/* ── Error state ── */}
                {callStatus === 'error' && (
                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⚠️</div>
                        <p style={{ color: '#f87171', fontWeight: 600 }}>Connection Failed</p>
                        <p className="subtext" style={{ fontSize: '0.82rem', marginTop: '0.5rem' }}>{statusMsg}</p>
                    </div>
                )}

                {/* ── Call ended ── */}
                {callStatus === 'ended' && (
                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📵</div>
                        <p style={{ fontWeight: 600 }}>Call Ended</p>
                        <p className="subtext" style={{ fontSize: '0.82rem', marginTop: '0.5rem' }}>Generating AI summary...</p>
                    </div>
                )}

                {/* ── Call timer ── */}
                {callStatus === 'active' && (
                    <div style={{
                        fontFamily: 'monospace', fontSize: '2rem', fontWeight: 700,
                        color: 'var(--green-400)', marginBottom: '2rem', letterSpacing: '0.05em',
                    }}>
                        {formatTime(timer)}
                    </div>
                )}

                {/* ── Controls ── */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        id="call-mute-btn"
                        className="btn btn-ghost"
                        onClick={toggleMute}
                        style={{ minWidth: '130px' }}
                        disabled={callStatus !== 'active'}
                    >
                        {muted ? '🔇 Unmute' : '🎙️ Mute'}
                    </button>
                    <button
                        id="call-hangup-btn"
                        className="btn btn-danger"
                        onClick={() => hangUp(true)}
                        disabled={ending || callStatus === 'ended'}
                        style={{ minWidth: '130px' }}
                    >
                        {ending ? 'Ending...' : '📵 Hang Up'}
                    </button>
                </div>

                {callStatus === 'active' && (
                    <p className="subtext" style={{ marginTop: '1.5rem', fontSize: '0.8rem' }}>
                        🔴 Call is being recorded for AI summary
                    </p>
                )}
            </div>
        </div>
    );
}
