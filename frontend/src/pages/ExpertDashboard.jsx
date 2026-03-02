/**
 * KisanCall — Expert Dashboard (Phase 6: Polish)
 * - Toast notifications
 * - Skeleton loading
 * - Language toggle
 * - Better stats
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { WS_BASE_URL } from '../api';
import { useAuth } from '../AuthContext';
import { useToast } from '../components/ToastProvider';
import { LanguageToggle } from '../components/LanguageContext';
import Navbar from '../components/Navbar';

function StatCard({ label, value, color }) {
    return (
        <div className="card" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: color || 'var(--green-400)' }}>{value}</div>
            <div className="subtext" style={{ fontSize: '0.78rem', marginTop: '0.3rem' }}>{label}</div>
        </div>
    );
}

export default function ExpertDashboard() {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [isOnline, setIsOnline] = useState(false);
    const [togglingOnline, setTogglingOnline] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null);
    const [recentCalls, setRecentCalls] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [wsStatus, setWsStatus] = useState('disconnected');
    const wsRef = useRef(null);

    const loadData = useCallback(async () => {
        try {
            const [meRes, callsRes] = await Promise.all([
                api.get('/auth/me'),
                api.get('/expert/calls'),
            ]);
            setIsOnline(meRes.data?.is_online ?? false);
            setRecentCalls(callsRes.data.data?.calls || []);
        } catch { }
        finally { setLoadingHistory(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // ── WebSocket with auto-reconnect ──────────────────────────────────────
    useEffect(() => {
        if (!token) return;

        // `active` prevents StrictMode's double-invoke from leaving a zombie WS.
        // When cleanup runs before onopen fires, we close immediately in onopen.
        let active = true;
        let ws = null;
        let hb = null;
        let retryTimeout = null;
        let retryDelay = 1500; // start at 1.5s, back off up to 30s

        const connect = () => {
            if (!active) return;

            ws = new WebSocket(`${WS_BASE_URL}/ws/expert`);
            wsRef.current = ws;

            ws.onopen = () => {
                if (!active) { ws.close(); return; }   // StrictMode cleanup fired
                retryDelay = 1500;                      // reset backoff on success
                ws.send(JSON.stringify({ type: 'auth', token }));
                setWsStatus('connected');

                // Start heartbeat
                hb = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'ping' }));
                    }
                }, 25000);
            };

            ws.onmessage = (e) => {
                if (!active) return;
                let msg;
                try { msg = JSON.parse(e.data); } catch { return; }

                if (msg.type === 'incoming_call') {
                    setIncomingCall({ call_id: msg.call_id, farmer_name: msg.farmer_name, topic: msg.topic });
                    toast.info(`📞 Incoming call from ${msg.farmer_name} about "${msg.topic}"`, 0);
                } else if (msg.type === 'call_ended') {
                    setIncomingCall(null);
                    toast.info('Call ended by farmer.');
                    loadData();
                }
            };

            ws.onerror = () => {
                // Let onclose handle reconnect
            };

            ws.onclose = () => {
                clearInterval(hb);
                hb = null;
                setWsStatus('disconnected');
                if (!active) return;   // intentional unmount — don't reconnect
                // Auto-reconnect with exponential backoff (max 30s)
                retryTimeout = setTimeout(() => {
                    retryDelay = Math.min(retryDelay * 1.5, 30000);
                    connect();
                }, retryDelay);
            };
        };

        connect();

        return () => {
            active = false;
            clearInterval(hb);
            clearTimeout(retryTimeout);
            if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
                ws.close();
            }
        };
    }, [token, loadData, toast]);

    // ── Toggle online ──────────────────────────────────────────────────────
    const toggleOnline = async () => {
        setTogglingOnline(true);
        const newVal = !isOnline;
        try {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'set_online', is_online: newVal }));
            } else {
                await api.post('/expert/toggle-online');
            }
            setIsOnline(newVal);
            toast.success(newVal ? '🟢 You are now Online — farmers can call you!' : '🔴 You are now Offline.');
        } catch {
            toast.error('Failed to update availability. Please try again.');
        } finally {
            setTogglingOnline(false);
        }
    };

    // ── Accept / Reject ────────────────────────────────────────────────────
    const acceptCall = async () => {
        if (!incomingCall) return;
        try {
            await api.post(`/call/accept/${incomingCall.call_id}`);
            toast.success('Call accepted! Connecting...');
            navigate(`/expert/call/${incomingCall.call_id}`);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to accept call.');
            setIncomingCall(null);
        }
    };

    const rejectCall = async () => {
        if (!incomingCall) return;
        try {
            await api.post(`/call/reject/${incomingCall.call_id}`);
            setIncomingCall(null);
            toast.info('Call rejected.');
        } catch {
            setIncomingCall(null);
        }
    };

    const now = new Date();
    const thisMonthCalls = recentCalls.filter((c) => {
        const d = new Date(c.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="bg-blobs"><div className="blob blob-1" /><div className="blob blob-3" /></div>
            <Navbar />
            <div className="content page" style={{ paddingTop: '2rem' }}>
                <div className="container">
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h1 className="heading-lg">Expert Dashboard 👨‍🌾</h1>
                            <p className="subtext">Welcome back, {user?.name}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <LanguageToggle compact />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: wsStatus === 'connected' ? 'var(--green-400)' : '#94a3b8' }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: wsStatus === 'connected' ? 'var(--green-400)' : '#94a3b8' }} />
                                {wsStatus === 'connected' ? 'Live' : 'Offline'}
                            </div>
                        </div>
                    </div>

                    {/* Incoming call alert — prominent */}
                    {incomingCall && (
                        <div className="card fade-in" style={{
                            marginBottom: '2rem', border: '2px solid var(--gold-400)',
                            background: 'rgba(245,158,11,0.06)',
                            animation: 'fadeIn 0.3s ease',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                                <div style={{
                                    fontSize: '2.2rem', animation: 'pulse-ring 1.2s infinite',
                                    width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    borderRadius: '50%', background: 'rgba(245,158,11,0.15)',
                                    flexShrink: 0,
                                }}>📞</div>
                                <div>
                                    <h2 style={{ fontSize: '1.1rem', color: 'var(--gold-400)', marginBottom: '0.25rem' }}>🔔 Incoming Call!</h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        <strong style={{ color: 'var(--text-primary)' }}>{incomingCall.farmer_name}</strong>{' '}
                                        needs help with <strong style={{ color: 'var(--gold-300)' }}>{incomingCall.topic}</strong>
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <button id="accept-call-btn" className="btn btn-primary" onClick={acceptCall} style={{ flex: 1, minWidth: 120, justifyContent: 'center' }}>
                                    ✅ Accept Call
                                </button>
                                <button id="reject-call-btn" className="btn btn-danger" onClick={rejectCall} style={{ flex: 1, minWidth: 120, justifyContent: 'center' }}>
                                    ❌ Reject
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Online toggle card */}
                    <div className="card" style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h2 className="heading-md" style={{ marginBottom: '0.3rem' }}>Your Availability</h2>
                                <p className="subtext" style={{ fontSize: '0.875rem' }}>
                                    {isOnline
                                        ? '✅ Online — farmers can see you and call you right now.'
                                        : '⭕ Offline — you won\'t receive any calls until you go online.'
                                    }
                                </p>
                            </div>
                            <button
                                id="availability-toggle-btn"
                                className={`btn ${isOnline ? 'btn-danger' : 'btn-primary'}`}
                                onClick={toggleOnline}
                                disabled={togglingOnline}
                                style={{ minWidth: '160px', fontWeight: 700 }}
                            >
                                {togglingOnline ? '⏳ Updating...' : isOnline ? '🔴 Go Offline' : '🟢 Go Online'}
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid-3" style={{ marginBottom: '2rem', gap: '1rem' }}>
                        <StatCard label="Total Calls" value={recentCalls.length} />
                        <StatCard label="Completed" value={recentCalls.filter(c => c.status === 'ended').length} color="var(--gold-400)" />
                        <StatCard label="This Month" value={thisMonthCalls.length} color="#93c5fd" />
                    </div>

                    {/* Recent calls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h2 className="heading-md">Recent Consultations</h2>
                        {recentCalls.length > 0 && (
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/expert/history')}>
                                View All →
                            </button>
                        )}
                    </div>

                    {loadingHistory ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {[1, 2].map(i => (
                                <div key={i} className="card" style={{ padding: '1.25rem 1.5rem' }}>
                                    <div className="skeleton skeleton-title" style={{ width: '45%', marginBottom: '0.4rem' }} />
                                    <div className="skeleton skeleton-text" style={{ width: '65%' }} />
                                </div>
                            ))}
                        </div>
                    ) : recentCalls.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
                            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📭</div>
                            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.05rem' }}>No calls yet</h3>
                            <p className="subtext" style={{ fontSize: '0.875rem' }}>Go online above to start receiving calls from farmers.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {recentCalls.slice(0, 5).map((c) => (
                                <div key={c.id} className="card" style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    flexWrap: 'wrap', gap: '0.75rem', padding: '1.1rem 1.5rem',
                                }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                                            <strong style={{ fontSize: '0.95rem' }}>{c.topic}</strong>
                                            <span className={`badge badge-${c.status}`}>{c.status}</span>
                                        </div>
                                        <p className="subtext" style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {c.farmer_name}
                                            {c.created_at ? ` • ${new Date(c.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}` : ''}
                                            {c.duration_seconds ? ` • ${Math.round(c.duration_seconds / 60)} min` : ''}
                                        </p>
                                    </div>
                                    {c.status === 'ended' && (
                                        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/expert/history')}>
                                            Details
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
