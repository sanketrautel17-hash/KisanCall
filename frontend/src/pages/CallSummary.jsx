/**
 * KisanCall — Call Summary Page (Phase 6: Polish)
 * - Uses SummaryCard component
 * - Toast for copy success
 * - Better loading/error states
 * - Scroll reveal
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../components/ToastProvider';
import Navbar from '../components/Navbar';
import SummaryCard from '../components/SummaryCard';

const POLL_INTERVAL = 5000;
const MAX_POLLS = 36; // 3 minutes

export default function CallSummary() {
    const { callId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [callData, setCallData] = useState(null);
    const [status, setStatus] = useState('loading'); // loading | processing | ready | error
    const [pollCount, setPollCount] = useState(0);
    const timerRef = useRef(null);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await api.get(`/call/status/${callId}`);
            const data = res.data;
            setCallData(data);

            if (data.summary) {
                setStatus('ready');
            } else if (data.status === 'ended') {
                setStatus('processing');
            } else {
                setStatus('loading');
            }
        } catch {
            setStatus('error');
        }
    }, [callId]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    // ── Polling until summary is ready ────────────────────────────────────
    useEffect(() => {
        if (status === 'ready' || status === 'error') {
            clearInterval(timerRef.current);
            return;
        }
        if (pollCount >= MAX_POLLS) {
            setStatus('error');
            return;
        }
        timerRef.current = setInterval(async () => {
            setPollCount((n) => n + 1);
            await fetchStatus();
        }, POLL_INTERVAL);

        return () => clearInterval(timerRef.current);
    }, [status, pollCount, fetchStatus]);

    const handleCopy = () => {
        if (callData?.summary) {
            navigator.clipboard.writeText(callData.summary).then(() => {
                toast.success('Summary copied to clipboard!');
            });
        }
    };

    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="bg-blobs"><div className="blob blob-1" /><div className="blob blob-2" /></div>
            <Navbar />
            <div className="content page" style={{ paddingTop: '2rem' }}>
                <div className="container" style={{ maxWidth: '760px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/farmer')}>← Dashboard</button>
                        <div>
                            <h1 className="heading-lg">Consultation Summary</h1>
                            {callData?.topic && <p className="subtext">Topic: {callData.topic}</p>}
                        </div>
                    </div>

                    {/* ── Loading / processing ──────────────────────────────────── */}
                    {(status === 'loading' || status === 'processing') && (
                        <div className="card fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <div style={{
                                width: 80, height: 80, borderRadius: '50%',
                                background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(245,158,11,0.1))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '2.5rem', margin: '0 auto 1.5rem',
                                border: '2px solid rgba(34,197,94,0.2)',
                                animation: 'pulse-ring 2s ease-in-out infinite',
                            }}>🤖</div>
                            <h2 style={{ marginBottom: '0.75rem', fontSize: '1.15rem' }}>
                                {status === 'loading' ? 'Loading your call...' : 'AI is generating your summary...'}
                            </h2>
                            <p className="subtext" style={{ marginBottom: '2rem', fontSize: '0.875rem' }}>
                                {status === 'processing'
                                    ? 'Our AI is transcribing the call and generating a consultation summary. This takes 30–60 seconds.'
                                    : 'Fetching call details...'
                                }
                            </p>

                            {/* Animated steps */}
                            {status === 'processing' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxWidth: '280px', margin: '0 auto 2rem', textAlign: 'left' }}>
                                    {[
                                        { label: 'Uploading recording', done: pollCount >= 1 },
                                        { label: 'Transcribing audio', done: pollCount >= 3 },
                                        { label: 'Detecting language', done: pollCount >= 4 },
                                        { label: 'Generating AI summary', done: pollCount >= 6 },
                                    ].map((step) => (
                                        <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                                            <span style={{ color: step.done ? 'var(--green-400)' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                {step.done ? '✅' : '⏳'}
                                            </span>
                                            <span style={{ color: step.done ? 'var(--text-primary)' : 'var(--text-muted)' }}>{step.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="dot-progress">
                                <span /><span /><span />
                            </div>
                        </div>
                    )}

                    {/* ── Error ─────────────────────────────────────────────────── */}
                    {status === 'error' && (
                        <div className="card fade-in" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                            <h2 style={{ marginBottom: '0.75rem' }}>Summary Not Available</h2>
                            <p className="subtext" style={{ marginBottom: '2rem', fontSize: '0.875rem' }}>
                                The AI summary could not be generated for this call. This can happen if the recording was too short or there was a processing error.
                            </p>
                            <button className="btn btn-primary" onClick={() => navigate('/farmer')}>
                                Back to Dashboard
                            </button>
                        </div>
                    )}

                    {/* ── Ready ─────────────────────────────────────────────────── */}
                    {status === 'ready' && callData && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Summary card with copy handler via toast */}
                            <div onClick={undefined} style={{ position: 'relative' }}>
                                <SummaryCard
                                    summary={callData.summary}
                                    language={callData.language_detected}
                                    topic={callData.topic}
                                    expertName={callData.expert_name}
                                    createdAt={callData.created_at}
                                    durationSeconds={callData.duration_seconds}
                                    followupNote={callData.followup_note}
                                />
                                {/* Override copy button to use toast */}
                                <button
                                    onClick={handleCopy}
                                    style={{
                                        position: 'absolute', top: '1.5rem', right: '1.5rem',
                                        background: 'rgba(34,197,94,0.08)', border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem',
                                        cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)',
                                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.35rem',
                                    }}
                                >
                                    📋 Copy
                                </button>
                            </div>

                            {/* Transcript */}
                            {callData.transcript && (
                                <div className="card" style={{ padding: '1.5rem' }}>
                                    <details>
                                        <summary style={{
                                            cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
                                            color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        }}>
                                            📝 Show Full Transcript
                                        </summary>
                                        <div style={{
                                            whiteSpace: 'pre-wrap', fontSize: '0.85rem',
                                            color: 'var(--text-secondary)', lineHeight: 1.8,
                                            maxHeight: '320px', overflowY: 'auto',
                                            background: 'rgba(6,20,9,0.4)',
                                            padding: '1rem', borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--border)',
                                        }}>
                                            {callData.transcript}
                                        </div>
                                    </details>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <button className="btn btn-primary" onClick={() => navigate('/farmer')} style={{ flex: 1, minWidth: 160, justifyContent: 'center' }}>
                                    ← Back to Dashboard
                                </button>
                                <button className="btn btn-ghost" onClick={() => window.print()} style={{ flex: 1, minWidth: 140, justifyContent: 'center' }}>
                                    🖨️ Print / Save
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
