/**
 * KisanCall — Verify Email Page
 */
import { useLocation, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function VerifyEmail() {
    const { state } = useLocation();
    const email = state?.email || 'your email';

    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="bg-blobs">
                <div className="blob blob-1" /><div className="blob blob-2" />
            </div>
            <Navbar />
            <div className="page-center content">
                <div className="card fade-in" style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>📧</div>
                    <h1 className="heading-md" style={{ marginBottom: '1rem' }}>Check your inbox!</h1>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                        We've sent a verification link to{' '}
                        <strong style={{ color: 'var(--green-400)' }}>{email}</strong>.
                        Click the link in the email to activate your account.
                    </p>

                    <div className="alert alert-info" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                        <strong>💡 Tip:</strong> Check your spam/promotions folder if you don't see it within 2 minutes.
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <Link to="/login" className="btn btn-primary btn-full" id="verify-go-login">
                            Already verified? Sign In →
                        </Link>
                        <Link to="/" className="btn btn-ghost btn-full">
                            Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
