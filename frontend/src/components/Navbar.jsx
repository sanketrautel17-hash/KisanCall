/**
 * KisanCall — Navbar (Phase 6: Mobile + Language Toggle)
 * - Sticky glassmorphism navbar
 * - Shows language toggle
 * - Hamburger menu on mobile (≤640px)
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { LanguageToggle } from './LanguageContext';

export default function Navbar() {
    const { user, logout, isLoggedIn } = useAuth();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/');
        setMenuOpen(false);
    };

    const dashboardPath = user?.role === 'expert' ? '/expert' : '/farmer';
    const historyPath = user?.role === 'expert' ? '/expert/history' : '/farmer';

    return (
        <nav className="navbar">
            {/* Brand */}
            <Link to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
                🌾 Kisan<span>Call</span>
            </Link>

            {/* Desktop nav */}
            <div className="navbar-actions" style={{ display: 'flex' }}>
                {/* Language toggle — always visible */}
                <LanguageToggle compact />

                {isLoggedIn ? (
                    <>
                        <Link to={dashboardPath} className="btn btn-ghost btn-sm" id="nav-dashboard-link">
                            Dashboard
                        </Link>
                        {user?.role === 'expert' && (
                            <Link to="/expert/history" className="btn btn-ghost btn-sm" id="nav-history-link">
                                History
                            </Link>
                        )}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.35rem 0.75rem',
                            background: 'rgba(34,197,94,0.08)',
                            borderRadius: '999px',
                            border: '1px solid var(--border)',
                        }}>
                            <span style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: user?.role === 'expert'
                                    ? 'linear-gradient(135deg, var(--gold-500), var(--gold-400))'
                                    : 'linear-gradient(135deg, var(--green-600), var(--green-500))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.8rem', fontWeight: 700, color: '#fff', flexShrink: 0,
                            }}>
                                {user?.name?.[0]?.toUpperCase()}
                            </span>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user?.name?.split(' ')[0]}
                            </span>
                        </div>
                        <button onClick={handleLogout} className="btn btn-ghost btn-sm" id="nav-logout-btn">
                            Logout
                        </button>
                    </>
                ) : (
                    <>
                        <Link to="/login" className="btn btn-ghost btn-sm" id="nav-login-link">Login</Link>
                        <Link to="/signup" className="btn btn-primary btn-sm" id="nav-signup-link">Sign Up</Link>
                    </>
                )}
            </div>

            {/* Mobile hamburger */}
            <button
                id="nav-hamburger"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle menu"
                style={{
                    display: 'none',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0.5rem', color: 'var(--text-primary)', fontSize: '1.5rem',
                }}
            >
                {menuOpen ? '✕' : '☰'}
            </button>

            {/* Mobile dropdown */}
            {menuOpen && (
                <div style={{
                    position: 'fixed', top: 64, left: 0, right: 0,
                    background: 'rgba(6,20,9,0.97)',
                    backdropFilter: 'blur(24px)',
                    borderBottom: '1px solid var(--border)',
                    padding: '1.5rem',
                    display: 'flex', flexDirection: 'column', gap: '0.75rem',
                    zIndex: 200,
                    animation: 'fadeIn 0.2s ease',
                }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                        <LanguageToggle />
                    </div>
                    {isLoggedIn ? (
                        <>
                            <Link to={dashboardPath} className="btn btn-ghost btn-full" onClick={() => setMenuOpen(false)}>
                                Dashboard
                            </Link>
                            {user?.role === 'expert' && (
                                <Link to="/expert/history" className="btn btn-ghost btn-full" onClick={() => setMenuOpen(false)}>
                                    Call History
                                </Link>
                            )}
                            <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>
                                Signed in as <strong style={{ color: 'var(--text-primary)' }}>{user?.name}</strong>
                                <span style={{
                                    marginLeft: '0.5rem',
                                    background: user?.role === 'expert' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                                    color: user?.role === 'expert' ? 'var(--gold-400)' : 'var(--green-400)',
                                    padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600,
                                }}>
                                    {user?.role}
                                </span>
                            </div>
                            <button onClick={handleLogout} className="btn btn-danger btn-full">
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="btn btn-ghost btn-full" onClick={() => setMenuOpen(false)}>Login</Link>
                            <Link to="/signup" className="btn btn-primary btn-full" onClick={() => setMenuOpen(false)}>Sign Up Free</Link>
                        </>
                    )}
                </div>
            )}

            {/* Inline responsive style */}
            <style>{`
                @media (max-width: 640px) {
                    .navbar-actions { display: none !important; }
                    #nav-hamburger { display: flex !important; }
                }
            `}</style>
        </nav>
    );
}
