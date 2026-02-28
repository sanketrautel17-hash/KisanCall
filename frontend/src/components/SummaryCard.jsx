/**
 * KisanCall — SummaryCard Component
 * Reusable display card for AI-generated consultation summaries.
 */
export default function SummaryCard({ summary, language, topic, expertName, createdAt, durationSeconds, followupNote }) {
    const isHindi = language === 'hi';

    const copyToClipboard = () => {
        if (summary) {
            navigator.clipboard.writeText(summary).then(() => {
                // Short visual feedback handled by parent or toast
            });
        }
    };

    return (
        <div className="card fade-in" style={{ padding: '1.75rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, var(--green-600), var(--green-500))',
                        borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', fontSize: '1.1rem',
                        flexShrink: 0,
                    }}>🤖</div>
                    <div>
                        <h3 style={{ fontSize: '1rem', marginBottom: '0.2rem' }}>AI Consultation Summary</h3>
                        <p className="subtext" style={{ fontSize: '0.78rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {isHindi ? '🇮🇳 Hindi' : '🇬🇧 English'}
                            {topic && <span>• {topic}</span>}
                            {expertName && <span>• {expertName}</span>}
                            {createdAt && <span>• {new Date(createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>}
                            {durationSeconds && <span>• {Math.round(durationSeconds / 60)} min</span>}
                        </p>
                    </div>
                </div>

                <button
                    onClick={copyToClipboard}
                    title="Copy summary"
                    style={{
                        background: 'rgba(34,197,94,0.08)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem',
                        cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)',
                        fontFamily: 'inherit', transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                    }}
                >
                    📋 Copy
                </button>
            </div>

            {/* Summary Body */}
            <div style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.85,
                color: 'var(--text-primary)',
                fontSize: '0.93rem',
                background: 'rgba(6,20,9,0.4)',
                borderRadius: 'var(--radius-sm)',
                padding: '1.25rem',
                border: '1px solid var(--border)',
            }}>
                {summary}
            </div>

            {/* Follow-up note (if expert added one) */}
            {followupNote && (
                <div style={{
                    marginTop: '1rem',
                    background: 'rgba(245,158,11,0.06)',
                    border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem 1rem',
                    fontSize: '0.875rem',
                }}>
                    <strong style={{ color: 'var(--gold-400)' }}>📝 Expert Follow-up Note:</strong>
                    <p style={{ marginTop: '0.4rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{followupNote}</p>
                </div>
            )}
        </div>
    );
}
