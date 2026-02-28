/**
 * KisanCall — Signup Page (with Google Sign-Up)
 * - Select role (Farmer/Expert) first
 * - Then continue with Google OR fill the form
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../AuthContext';
import { useToast } from '../components/ToastProvider';
import Navbar from '../components/Navbar';
import GoogleSignInButton from '../components/GoogleSignInButton';

const ROLES = [
    { value: 'farmer', label: '🌾 Farmer', desc: 'I need expert advice on my crops' },
    { value: 'expert', label: '👨‍🌾 Expert', desc: 'I want to help farmers with my knowledge' },
];

export default function Signup() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const { toast } = useToast();

    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'farmer' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Use functional updater to always read latest state — prevents stale closure
    // overwriting the `role` field when user types after clicking a role card.
    const handle = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const selectRole = (roleValue) => {
        setForm((prev) => ({ ...prev, role: roleValue }));
    };

    /* ── Email / Password Signup ── */
    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
        setLoading(true);
        try {
            await api.post('/auth/signup', form);
            navigate('/verify-email', { state: { email: form.email } });
        } catch (err) {
            setError(err.response?.data?.detail || 'Signup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    /* ── Google Sign-Up ── */
    const handleGoogleSuccess = async (credential) => {
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/auth/google', { credential, role: form.role });
            const { access_token, user } = res.data;
            login(user, access_token);
            toast.success(`Welcome to KisanCall, ${user.name.split(' ')[0]}! 🎉`);
            navigate(user.role === 'expert' ? '/expert' : '/farmer');
        } catch (err) {
            setError(err.response?.data?.detail || 'Google sign-up failed. Please try again.');
            setLoading(false);
        }
    };

    const handleGoogleError = (msg) => setError(msg);

    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="bg-blobs">
                <div className="blob blob-1" /><div className="blob blob-2" />
            </div>
            <Navbar />
            <div className="page-center content">
                <div className="card fade-in" style={{ width: '100%', maxWidth: '460px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🌾</div>
                        <h1 className="heading-md">Create your account</h1>
                        <p className="subtext" style={{ marginTop: '0.4rem' }}>Join KisanCall today — it's free</p>
                    </div>

                    {/* ── Role selector ──────────────────────────────────────── */}
                    <div className="grid-2" style={{ marginBottom: '1.5rem', gap: '0.75rem' }}>
                        {ROLES.map((r) => (
                            <button
                                key={r.value}
                                type="button"
                                id={`role-${r.value}`}
                                onClick={() => selectRole(r.value)}
                                style={{
                                    background: form.role === r.value ? 'rgba(34,197,94,0.15)' : 'rgba(6,20,9,0.5)',
                                    border: `2px solid ${form.role === r.value ? 'var(--green-500)' : 'var(--border)'}`,
                                    borderRadius: 'var(--radius-md)', padding: '1rem 0.75rem', cursor: 'pointer',
                                    textAlign: 'center', transition: 'var(--transition)', color: 'var(--text-primary)',
                                    fontFamily: 'inherit',
                                }}
                            >
                                <div style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>{r.label.split(' ')[0]}</div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.label.split(' ').slice(1).join(' ')}</div>
                                <div className="subtext" style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>{r.desc}</div>
                            </button>
                        ))}
                    </div>

                    {/* ── Google sign-up ─────────────────────────────────────── */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <GoogleSignInButton
                            role={form.role}
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            label={`Sign up as ${form.role === 'expert' ? 'Expert' : 'Farmer'} with Google`}
                            disabled={loading}
                        />
                    </div>

                    {/* ── Hint about role ────────────────────────────────────── */}
                    <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                        Role selected: <strong style={{ color: form.role === 'expert' ? 'var(--gold-400)' : 'var(--green-400)' }}>
                            {form.role === 'expert' ? '👨‍🌾 Expert' : '🌾 Farmer'}
                        </strong> — change it above before signing up
                    </p>

                    {/* ── Divider ────────────────────────────────────────────── */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem',
                    }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>OR sign up with email</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>

                    {/* ── Email / Password form ──────────────────────────────── */}
                    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="name">Full Name</label>
                            <input id="name" name="name" className="form-input" placeholder="Rajan Kumar"
                                value={form.name} onChange={handle} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="email">Email</label>
                            <input id="email" name="email" type="email" className="form-input" placeholder="you@example.com"
                                value={form.email} onChange={handle} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="password">Password</label>
                            <input id="password" name="password" type="password" className="form-input" placeholder="Min. 6 characters"
                                value={form.password} onChange={handle} required />
                        </div>

                        {error && <div className="alert alert-error">{error}</div>}

                        <button id="signup-submit" type="submit" className="btn btn-primary btn-full" disabled={loading}>
                            {loading ? 'Creating account...' : 'Create Account →'}
                        </button>
                    </form>

                    <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        Already have an account? <Link to="/login">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
