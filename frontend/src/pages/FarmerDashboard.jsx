/**
 * KisanCall — Farmer Dashboard (Phase 6: Polish)
 * - Toast notifications instead of inline alerts
 * - Language preference passed to call request
 * - Skeleton loading state
 * - Better empty state and UX
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../AuthContext';
import { useToast } from '../components/ToastProvider';
import { useLanguage, LanguageToggle } from '../components/LanguageContext';
import Navbar from '../components/Navbar';
import CategorySelector from '../components/CategorySelector';

function CallHistorySkeleton() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1, 2, 3].map((i) => (
                <div key={i} className="card" style={{ padding: '1.25rem 1.5rem' }}>
                    <div className="skeleton skeleton-title" style={{ width: '40%', marginBottom: '0.5rem' }} />
                    <div className="skeleton skeleton-text" style={{ width: '60%' }} />
                </div>
            ))}
        </div>
    );
}

export default function FarmerDashboard() {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { language } = useLanguage();

    const [topic, setTopic] = useState('');
    const [calling, setCalling] = useState(false);
    const [callData, setCallData] = useState(null);
    const [recentCalls, setRecentCalls] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [wsStatus, setWsStatus] = useState('disconnected');
    const wsRef = useRef(null);

    // ── Load call history ──────────────────────────────────────────────────
    const loadHistory = useCallback(async () => {
        try {
            const res = await api.get('/farmer/calls');
            setRecentCalls(res.data.data?.calls || []);
        } catch {
            // silently fail — user still sees empty state
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    // ── WebSocket ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!token) return;
        const ws = new WebSocket('ws://localhost:8000/ws/farmer');
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'auth', token }));
            setWsStatus('connected');
        };

        ws.onmessage = (e) => {
            let msg;
            try { msg = JSON.parse(e.data); } catch { return; }

            switch (msg.type) {
                case 'call_accepted':
                    toast.success(`✅ ${msg.expert_name} accepted your call! Connecting...`);
                    setCallData((prev) => prev ? { ...prev, status: 'active', expert_name: msg.expert_name } : prev);
                    setTimeout(() => navigate(`/call/${msg.call_id}`), 1200);
                    break;
                case 'call_rejected':
                    toast.error(msg.message || 'Your call was rejected. Trying to find another expert...');
                    setCalling(false);
                    setCallData(null);
                    loadHistory();
                    break;
                case 'call_reassigned':
                    toast.info(msg.message || 'Reassigning to another expert...');
                    break;
                case 'summary_ready':
                    toast.success('🤖 Your AI consultation summary is ready!', 6000);
                    loadHistory();
                    break;
                case 'pending_call':
                    toast.info('You have a pending call waiting for an expert.');
                    setCallData({ call_id: msg.call_id });
                    break;
                default:
                    break;
            }
        };

        ws.onclose = () => setWsStatus('disconnected');
        ws.onerror = () => setWsStatus('disconnected');

        const hb = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
        }, 25000);

        return () => { clearInterval(hb); ws.close(); };
    }, [token, navigate, toast, loadHistory]);

    // ── Request call ───────────────────────────────────────────────────────
    const requestCall = async () => {
        if (!topic) { toast.warning('Please select a topic first.'); return; }
        setCalling(true);
        try {
            const res = await api.post('/call/request', { topic, language });
            const data = res.data.data;
            setCallData({ call_id: data.id, topic: data.topic, status: data.status });
            toast.info(res.data.message || 'Call placed! Waiting for an expert...');
            if (data.status === 'active') navigate(`/call/${data.id}`);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to request call. Please try again.');
            setCalling(false);
        }
    };

    // ── Cancel call ────────────────────────────────────────────────────────
    const cancelCall = async () => {
        if (!callData?.call_id) return;
        try {
            await api.post(`/call/end/${callData.call_id}`);
            setCallData(null);
            setCalling(false);
            toast.info('Call cancelled.');
            loadHistory();
        } catch {
            toast.error('Could not cancel call. Try again.');
        }
    };

    const isConnected = wsStatus === 'connected';

    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="bg-blobs"><div className="blob blob-1" /><div className="blob blob-3" /></div>
            <Navbar />
            <div className="content page" style={{ paddingTop: '2rem' }}>
                <div className="container">
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h1 className="heading-lg">Namaste, {user?.name?.split(' ')[0]} 🌾</h1>
                            <p className="subtext">Ready to talk to an expert?</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <LanguageToggle compact />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: isConnected ? 'var(--green-400)' : '#94a3b8' }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: isConnected ? 'var(--green-400)' : '#94a3b8', flexShrink: 0 }} />
                                {isConnected ? 'Live' : 'Offline'}
                            </div>
                        </div>
                    </div>

                    {/* Active call banner */}
                    {callData && (
                        <div className="card fade-in" style={{
                            marginBottom: '2rem', border: '1px solid rgba(34,197,94,0.4)',
                            background: 'rgba(34,197,94,0.06)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                                        <span className="pulse-dot" />
                                        <strong>Call in progress — {callData.topic || 'Waiting...'}</strong>
                                    </div>
                                    <div className="dot-progress" style={{ justifyContent: 'flex-start', gap: '0.3rem', marginTop: '0.5rem' }}>
                                        <span /><span /><span />
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.25rem' }}>
                                            Waiting for expert to accept
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    {callData.status === 'active' && (
                                        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/call/${callData.call_id}`)}>
                                            Re-join Call
                                        </button>
                                    )}
                                    <button className="btn btn-danger btn-sm" onClick={cancelCall}>Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* New call section */}
                    {!callData && (
                        <div className="card fade-in" style={{ marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                <h2 className="heading-md">📞 Call an Expert Now</h2>
                                <div className="status-calling" style={{ fontSize: '0.75rem' }}>
                                    <span className="pulse-dot" style={{ width: 7, height: 7 }} />
                                    {recentCalls.filter(c => c.status === 'active').length > 0 ? 'Experts Active' : 'Experts Available'}
                                </div>
                            </div>
                            <CategorySelector selected={topic} onSelect={setTopic} />
                            <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                <button
                                    id="call-expert-btn"
                                    className="btn btn-primary btn-lg"
                                    onClick={requestCall}
                                    disabled={calling || !topic}
                                    style={{ minWidth: '180px' }}
                                >
                                    {calling
                                        ? <><span style={{ marginRight: '0.5rem' }}>⏳</span>Connecting...</>
                                        : '📞 Call Expert'
                                    }
                                </button>
                                {topic && (
                                    <span className="subtext" style={{ fontSize: '0.82rem' }}>
                                        Topic: <strong style={{ color: 'var(--green-400)' }}>{topic}</strong>
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Call history */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <h2 className="heading-md">📋 Past Consultations</h2>
                            {recentCalls.length > 0 && (
                                <span className="subtext" style={{ fontSize: '0.82rem' }}>
                                    {recentCalls.length} total
                                </span>
                            )}
                        </div>

                        {loadingHistory ? (
                            <CallHistorySkeleton />
                        ) : recentCalls.length === 0 ? (
                            <div className="card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
                                <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🌱</div>
                                <h3 style={{ marginBottom: '0.5rem', fontSize: '1.05rem' }}>No consultations yet</h3>
                                <p className="subtext" style={{ fontSize: '0.875rem' }}>
                                    Select a topic above and call an expert to get started!
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {recentCalls.map((c) => (
                                    <div key={c.id} className="card fade-in" style={{
                                        display: 'flex', justifyContent: 'space-between',
                                        alignItems: 'center', flexWrap: 'wrap',
                                        gap: '0.75rem', padding: '1.1rem 1.5rem',
                                    }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                                                <strong style={{ fontSize: '0.95rem' }}>{c.topic}</strong>
                                                <span className={`badge badge-${c.status}`}>{c.status}</span>
                                                {c.language_detected && (
                                                    <span className={`lang-badge lang-badge-${c.language_detected === 'hi' ? 'hi' : 'en'}`}>
                                                        {c.language_detected === 'hi' ? '🇮🇳 हि' : '🇬🇧 EN'}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="subtext" style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {c.expert_name ? `Expert: ${c.expert_name}` : 'No expert assigned'}
                                                {c.created_at ? ` • ${new Date(c.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}` : ''}
                                                {c.duration_seconds ? ` • ${Math.round(c.duration_seconds / 60)}m` : ''}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                            {c.status === 'ended' && c.summary && (
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => navigate(`/summary/${c.id}`)}
                                                >
                                                    📋 Summary
                                                </button>
                                            )}
                                            {c.status === 'ended' && !c.summary && (
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => navigate(`/summary/${c.id}`)}
                                                >
                                                    View
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
