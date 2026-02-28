/**
 * KisanCall — Landing Page (Phase 6: Polish)
 * - Scroll-reveal animations via IntersectionObserver
 * - Mobile-responsive hero CTA row
 * - Language toggle in hero
 * - Improved grid classes
 */
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { LanguageToggle, useLanguage } from '../components/LanguageContext';

const FEATURES = [
    { icon: '📞', title: 'Instant Expert Call', desc: 'Connect with a verified agriculture expert in seconds via live voice call.' },
    { icon: '🌾', title: 'All Crop Topics', desc: 'Pest control, irrigation, fertilizers, weather — our experts cover it all.' },
    { icon: '🤖', title: 'AI Consultation Summary', desc: 'Get a written AI-powered summary of every consultation in Hindi or English.' },
    { icon: '📱', title: 'Mobile First', desc: 'Works perfectly on any smartphone — no app download needed.' },
    { icon: '🔒', title: 'Safe & Secure', desc: 'End-to-end encrypted peer-to-peer voice calls. Your data stays private.' },
    { icon: '🇮🇳', title: 'Made for India', desc: 'Hindi + English support, built for Indian farmers and agri-conditions.' },
];

const STEPS = [
    { step: '01', icon: '📝', title: 'Sign Up', desc: 'Create your free farmer account in 1 minute.' },
    { step: '02', icon: '🎯', title: 'Pick a Topic', desc: 'Select your crop problem category.' },
    { step: '03', icon: '📞', title: 'Call Expert', desc: 'Connect instantly with a live agriculture expert.' },
    { step: '04', icon: '📋', title: 'Get Summary', desc: 'Receive your AI consultation summary to save and share.' },
];

function useScrollReveal() {
    const elementsRef = useRef([]);
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
            { threshold: 0.12 }
        );
        elementsRef.current.forEach((el) => el && observer.observe(el));
        return () => observer.disconnect();
    }, []);
    const ref = (el) => { if (el && !elementsRef.current.includes(el)) elementsRef.current.push(el); };
    return ref;
}

export default function Landing() {
    const reveal = useScrollReveal();
    const { isHindi } = useLanguage();

    // Scroll-to-top button
    useEffect(() => {
        const btn = document.getElementById('scroll-top-btn');
        const onScroll = () => {
            if (btn) btn.classList.toggle('visible', window.scrollY > 400);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="bg-blobs">
                <div className="blob blob-1" />
                <div className="blob blob-2" />
                <div className="blob blob-3" />
            </div>

            <Navbar />

            <div className="content">
                {/* ── Hero ─────────────────────────────────────────────────────── */}
                <section style={{ padding: 'clamp(3rem, 8vw, 5rem) 1.5rem 3rem', textAlign: 'center', position: 'relative' }}>
                    <div className="hero-gradient" />
                    <div className="container" style={{ position: 'relative', zIndex: 1 }}>
                        {/* Language toggle hint */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
                                borderRadius: '999px', padding: '0.4rem 1.2rem',
                                fontSize: '0.85rem', color: 'var(--green-400)', fontWeight: 600,
                            }}>
                                <span className="pulse-dot" /> Now available across India
                            </div>
                            <LanguageToggle compact />
                        </div>

                        <h1 className="heading-xl fade-in" style={{ marginBottom: '1.5rem', lineHeight: 1.12 }}>
                            {isHindi
                                ? <>किसानों को विशेषज्ञ मदद,{' '}<span className="gradient-text">एक कॉल दूर</span></>
                                : <>Expert Farming Advice,{' '}<span className="gradient-text">One Call Away</span></>
                            }
                        </h1>

                        <p className="subtext fade-in" style={{
                            fontSize: 'clamp(1rem, 2.5vw, 1.15rem)',
                            maxWidth: '600px', margin: '0 auto 2.5rem',
                            lineHeight: 1.75, animationDelay: '0.1s',
                        }}>
                            {isHindi
                                ? 'KisanCall भारतीय किसानों को तुरंत वॉयस कॉल के ज़रिए असली कृषि विशेषज्ञों से जोड़ता है — और AI परामर्श सारांश देता है।'
                                : 'KisanCall connects Indian farmers with real agriculture experts via instant voice calls, followed by an AI-generated consultation summary.'
                            }
                        </p>

                        <div className="hero-cta-row fade-in" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', animationDelay: '0.2s' }}>
                            <Link to="/signup" className="btn btn-primary btn-lg" id="hero-cta-farmer">
                                🌾 {isHindi ? 'किसान हूँ — मदद चाहिए' : "I'm a Farmer — Get Help"}
                            </Link>
                            <Link to="/signup" className="btn btn-gold btn-lg" id="hero-cta-expert">
                                👨‍🌾 {isHindi ? 'विशेषज्ञ हूँ — जुड़ें' : "I'm an Expert — Join"}
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ── Stats ─────────────────────────────────────────────────────── */}
                <section style={{ padding: '1.5rem 1.5rem 3rem' }}>
                    <div className="container">
                        <div className="stats-grid-3" ref={reveal}>
                            {[
                                { value: '500+', label: isHindi ? 'सत्यापित विशेषज्ञ' : 'Verified Experts' },
                                { value: '10K+', label: isHindi ? 'किसान लाभान्वित' : 'Farmers Helped' },
                                { value: '4.9★', label: isHindi ? 'औसत रेटिंग' : 'Average Rating' },
                            ].map((s) => (
                                <div key={s.label} className="card section-reveal" ref={reveal} style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                                    <div style={{ fontSize: 'clamp(1.5rem, 4vw, 1.8rem)', fontWeight: 800, color: 'var(--green-400)' }}>{s.value}</div>
                                    <div className="subtext" style={{ fontSize: '0.82rem', marginTop: '0.3rem' }}>{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Features ──────────────────────────────────────────────────── */}
                <section style={{ padding: '3rem 1.5rem' }}>
                    <div className="container">
                        <h2 className="heading-lg text-center section-reveal" ref={reveal} style={{ marginBottom: '0.75rem' }}>
                            {isHindi ? 'किसान के लिए सब कुछ' : 'Everything a Farmer Needs'}
                        </h2>
                        <p className="subtext text-center section-reveal" ref={reveal} style={{ marginBottom: '2.5rem' }}>
                            {isHindi ? 'पहली कॉल से AI फॉलो-अप तक — पूरी मदद।' : 'From first call to AI follow-up — we\'ve got you covered.'}
                        </p>
                        <div className="feature-grid">
                            {FEATURES.map((f, i) => (
                                <div key={f.title} className="card section-reveal" ref={reveal} style={{ padding: '1.75rem', animationDelay: `${i * 0.05}s` }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{f.icon}</div>
                                    <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--green-400)' }}>{f.title}</h3>
                                    <p className="subtext" style={{ fontSize: '0.875rem', lineHeight: 1.65 }}>{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── How it Works ───────────────────────────────────────────────── */}
                <section style={{ padding: '3rem 1.5rem', background: 'rgba(10,32,19,0.5)' }}>
                    <div className="container">
                        <h2 className="heading-lg text-center section-reveal" ref={reveal} style={{ marginBottom: '2.5rem' }}>
                            {isHindi ? 'KisanCall कैसे काम करता है?' : 'How KisanCall Works'}
                        </h2>
                        <div className="how-it-works-grid" style={{ maxWidth: '900px', margin: '0 auto' }}>
                            {STEPS.map((s, i) => (
                                <div key={s.step} className="section-reveal" ref={reveal} style={{ textAlign: 'center', animationDelay: `${i * 0.1}s` }}>
                                    <div style={{
                                        width: '56px', height: '56px', borderRadius: '50%',
                                        background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.6rem', margin: '0 auto 1rem',
                                        transition: 'all 0.3s ease',
                                    }}>{s.icon}</div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--gold-400)', fontWeight: 700, letterSpacing: '0.12em', marginBottom: '0.4rem' }}>
                                        STEP {s.step}
                                    </div>
                                    <h3 style={{ fontSize: '1rem', marginBottom: '0.4rem' }}>{s.title}</h3>
                                    <p className="subtext" style={{ fontSize: '0.82rem', lineHeight: 1.6 }}>{s.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── CTA ───────────────────────────────────────────────────────── */}
                <section style={{ padding: 'clamp(3rem, 6vw, 5rem) 1.5rem', textAlign: 'center' }}>
                    <div className="container">
                        <div className="section-reveal" ref={reveal}>
                            <h2 className="heading-lg" style={{ marginBottom: '1rem' }}>
                                {isHindi ? 'विशेषज्ञ से बात करने के लिए तैयार हैं?' : 'Ready to Talk to an Expert?'}
                            </h2>
                            <p className="subtext" style={{ marginBottom: '2rem' }}>
                                {isHindi ? 'हजारों किसानों के साथ जुड़ें जो बेहतर निर्णय ले रहे हैं।' : 'Join thousands of farmers making smarter decisions.'}
                            </p>
                            <Link to="/signup" className="btn btn-primary btn-lg" id="footer-cta">
                                {isHindi ? 'मुफ्त शुरू करें →' : 'Start for Free →'}
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ── Footer ───────────────────────────────────────────────────── */}
                <footer style={{
                    borderTop: '1px solid var(--border)', padding: '2rem 1.5rem',
                    textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem',
                }}>
                    <p>🌾 KisanCall — {isHindi ? 'भारतीय किसानों को विशेषज्ञ सलाह से सशक्त बनाना' : 'Empowering Indian Farmers with Expert Advice'}</p>
                    <p style={{ marginTop: '0.5rem', opacity: 0.6 }}>© 2025 KisanCall. Made with ❤️ in India.</p>
                </footer>
            </div>

            {/* Scroll to top */}
            <button
                id="scroll-top-btn"
                className="scroll-top-btn"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                aria-label="Scroll to top"
            >
                ↑
            </button>
        </div>
    );
}
