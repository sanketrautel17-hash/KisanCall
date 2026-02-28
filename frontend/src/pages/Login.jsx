/**
 * KisanCall — Login Page (with Google Sign-In)
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../AuthContext';
import { useToast } from '../components/ToastProvider';
import Navbar from '../components/Navbar';
import GoogleSignInButton from '../components/GoogleSignInButton';

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const { toast } = useToast();

    const [form, setForm] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handle = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    /* ── Email / Password Login ── */
    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/auth/login', form);
            const { access_token, user } = res.data;
            login(user, access_token);
            toast.success(`Welcome back, ${user.name.split(' ')[0]}! 👋`);
            navigate(user.role === 'expert' ? '/expert' : '/farmer');
        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed. Check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    /* ── Google Sign-In ── */
    const handleGoogleSuccess = async (credential) => {
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/auth/google', { credential, role: 'farmer' });
            const { access_token, user } = res.data;
            login(user, access_token);
            toast.success(`Welcome, ${user.name.split(' ')[0]}! 🎉`);
            navigate(user.role === 'expert' ? '/expert' : '/farmer');
        } catch (err) {
            setError(err.response?.data?.detail || 'Google sign-in failed. Please try again.');
            setLoading(false);
        }
    };

    const handleGoogleError = (msg) => {
        setError(msg);
    };

    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="bg-blobs">
                <div className="blob blob-1" /><div className="blob blob-2" />
            </div>
            <Navbar />
            <div className="page-center content">
                <div className="card fade-in" style={{ width: '100%', maxWidth: '420px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👋</div>
                        <h1 className="heading-md">Welcome back</h1>
                        <p className="subtext" style={{ marginTop: '0.4rem' }}>Sign in to your KisanCall account</p>
                    </div>

                    {/* ── Google sign-in ─────────────────────────────────────── */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <GoogleSignInButton
                            role="farmer"
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            label="Continue with Google"
                            disabled={loading}
                        />
                    </div>

                    {/* ── Divider ────────────────────────────────────────────── */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        marginBottom: '1.5rem',
                    }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>OR</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>

                    {/* ── Email / Password form ──────────────────────────────── */}
                    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="email">Email</label>
                            <input id="email" name="email" type="email" className="form-input"
                                placeholder="you@example.com" value={form.email} onChange={handle} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="password">Password</label>
                            <input id="password" name="password" type="password" className="form-input"
                                placeholder="Your password" value={form.password} onChange={handle} required />
                        </div>

                        {error && <div className="alert alert-error">{error}</div>}

                        <button id="login-submit" type="submit" className="btn btn-primary btn-full" disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In →'}
                        </button>
                    </form>

                    <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        Don't have an account? <Link to="/signup">Sign up free</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
