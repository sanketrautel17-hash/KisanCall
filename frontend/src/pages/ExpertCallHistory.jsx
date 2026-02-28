/**
 * KisanCall — Expert Call History
 * Paginated list of all past consultations with transcripts and summaries.
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import Navbar from '../components/Navbar';

export default function ExpertCallHistory() {
    const navigate = useNavigate();
    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
        api.get('/expert/calls')
            .then((res) => setCalls(res.data.data?.calls || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="bg-blobs"><div className="blob blob-1" /><div className="blob blob-2" /></div>
            <Navbar />
            <div className="content page" style={{ paddingTop: '2rem' }}>
                <div className="container" style={{ maxWidth: '900px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/expert')}>← Dashboard</button>
                        <div>
                            <h1 className="heading-lg">Consultation History</h1>
                            <p className="subtext">{calls.length} total consultations</p>
                        </div>
                    </div>

                    {loading && (
                        <div style={{ textAlign: 'center', padding: '4rem' }}>
                            <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                            <p className="subtext">Loading your consultations...</p>
                        </div>
                    )}

                    {!loading && calls.length === 0 && (
                        <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                            <p className="subtext">No consultations yet. Go online on your dashboard to start receiving calls.</p>
                            <Link to="/expert" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
                                Go to Dashboard
                            </Link>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {calls.map((c) => (
                            <div key={c.id} className="card fade-in" style={{ padding: '1.5rem' }}>
                                {/* Call header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                                            <strong style={{ fontSize: '1rem' }}>{c.topic}</strong>
                                            <span className={`badge badge-${c.status}`}>{c.status}</span>
                                        </div>
                                        <p className="subtext" style={{ fontSize: '0.82rem' }}>
                                            Farmer: {c.farmer_name}
                                            {c.created_at && ` • ${new Date(c.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`}
                                            {c.duration_seconds && ` • ${Math.round(c.duration_seconds / 60)} min`}
                                            {c.language_detected && ` • Language: ${c.language_detected === 'hi' ? '🇮🇳 Hindi' : '🇬🇧 English'}`}
                                        </p>
                                    </div>

                                    {(c.summary || c.transcript) && (
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                                        >
                                            {expanded === c.id ? 'Hide Details ↑' : 'View Details ↓'}
                                        </button>
                                    )}
                                </div>

                                {/* Follow-up note */}
                                {c.followup_note && (
                                    <div className="alert alert-success" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                                        <strong>📝 Your Follow-up Note:</strong> {c.followup_note}
                                    </div>
                                )}

                                {/* Expandable: AI summary + transcript */}
                                {expanded === c.id && (
                                    <div style={{ marginTop: '0.75rem' }}>
                                        <hr className="divider" />

                                        {c.summary && (
                                            <div style={{ marginBottom: '1.25rem' }}>
                                                <h3 style={{ fontSize: '0.9rem', color: 'var(--green-400)', marginBottom: '0.75rem' }}>
                                                    🤖 AI Summary
                                                </h3>
                                                <div style={{
                                                    whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: 1.8,
                                                    color: 'var(--text-secondary)',
                                                    background: 'rgba(6,20,9,0.5)', padding: '1rem', borderRadius: 'var(--radius-sm)',
                                                }}>
                                                    {c.summary}
                                                </div>
                                            </div>
                                        )}

                                        {c.transcript && (
                                            <details>
                                                <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                                    📝 Full Transcript
                                                </summary>
                                                <div style={{
                                                    whiteSpace: 'pre-wrap', fontSize: '0.82rem', lineHeight: 1.8,
                                                    color: 'var(--text-secondary)', marginTop: '0.75rem',
                                                    maxHeight: '300px', overflowY: 'auto',
                                                    background: 'rgba(6,20,9,0.5)', padding: '1rem', borderRadius: 'var(--radius-sm)',
                                                }}>
                                                    {c.transcript}
                                                </div>
                                            </details>
                                        )}

                                        {!c.summary && !c.transcript && (
                                            <p className="subtext" style={{ fontSize: '0.85rem' }}>
                                                No AI summary available for this call.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
