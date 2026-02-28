/**
 * KisanCall — Google Sign-In Button (Fixed: no stale closure)
 *
 * Uses Google Identity Services (GSI) renderButton API — no redirect_uri needed.
 * Uses a ref to always call the latest onSuccess callback, so switching roles
 * on the Signup page before clicking Google works correctly.
 *
 * Requires in Google Cloud Console → Credentials → OAuth Client:
 *   Authorized JavaScript origins: http://localhost  AND  http://localhost:5173
 *   NO redirect URI is needed for this flow.
 */
import { useEffect, useRef, useState } from 'react';

const GOOGLE_CLIENT_ID = '430276258196-lh96c7ug43b8fjbdi4d9hvtc417vmrs9.apps.googleusercontent.com';

export default function GoogleSignInButton({ role = 'farmer', onSuccess, onError, label }) {
    const btnRef = useRef(null);
    const onSuccessRef = useRef(onSuccess);  // always latest callback
    const onErrorRef = useRef(onError);
    const [ready, setReady] = useState(false);

    // Keep refs in sync with props on every render — no stale closure
    useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);

    // Initialize GSI once and render the button
    useEffect(() => {
        let interval = setInterval(() => {
            if (!window.google?.accounts?.id) return;
            clearInterval(interval);

            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: (response) => {
                    // Always calls the LATEST onSuccess (via ref), not the stale closure
                    if (response.credential) {
                        onSuccessRef.current?.(response.credential);
                    } else {
                        onErrorRef.current?.('Google Sign-In did not return a credential. Please try again.');
                    }
                },
                auto_select: false,
                cancel_on_tap_outside: true,
                context: 'signin',
            });

            if (btnRef.current) {
                window.google.accounts.id.renderButton(btnRef.current, {
                    type: 'standard',
                    theme: 'filled_black',
                    size: 'large',
                    text: 'continue_with',
                    shape: 'rectangular',
                    logo_alignment: 'left',
                    width: Math.min(btnRef.current.offsetWidth || 380, 400),
                });
            }

            setReady(true);
        }, 150);

        return () => clearInterval(interval);
    }, []); // runs once — safe because we use refs for callbacks

    return (
        <div style={{ width: '100%' }}>
            {/* Optional label */}
            {label && (
                <p style={{
                    textAlign: 'center',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    marginBottom: '0.6rem',
                    fontWeight: 500,
                }}>
                    {label}
                </p>
            )}

            {/* Skeleton while GSI loads */}
            {!ready && (
                <div className="skeleton" style={{ height: '44px', borderRadius: '6px', width: '100%' }} />
            )}

            {/* Google renders its button into this div */}
            <div
                id="google-signin-btn"
                ref={btnRef}
                style={{
                    width: '100%',
                    display: ready ? 'flex' : 'none',
                    justifyContent: 'center',
                    minHeight: '44px',
                }}
            />
        </div>
    );
}
