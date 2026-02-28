/**
 * KisanCall — CategorySelector
 * Grid of crop problem cards for farmer to pick from.
 */
const CATEGORIES = [
    { id: 'Crop Disease', icon: '🍂', desc: 'Leaf spots, blight, rot' },
    { id: 'Pest Control', icon: '🐛', desc: 'Insects, borers, worms' },
    { id: 'Soil Health', icon: '🌱', desc: 'pH, nutrients, drainage' },
    { id: 'Fertilizer', icon: '💊', desc: 'NPK, organic, timing' },
    { id: 'Weather', icon: '🌦️', desc: 'Drought, flood, frost' },
    { id: 'Irrigation', icon: '💧', desc: 'Water, drip, schedule' },
    { id: 'Seeds & Sowing', icon: '🌾', desc: 'Variety, spacing, depth' },
    { id: 'Market & Prices', icon: '📈', desc: 'MSP, mandi, buyers' },
];

export default function CategorySelector({ selected, onSelect }) {
    return (
        <div>
            <p className="subtext" style={{ marginBottom: '1rem' }}>
                Select your problem topic to connect with the right expert:
            </p>
            <div className="grid-4" style={{ gap: '0.75rem' }}>
                {CATEGORIES.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => onSelect(cat.id)}
                        className="card"
                        style={{
                            cursor: 'pointer',
                            border: selected === cat.id
                                ? '2px solid var(--green-500)'
                                : '1px solid var(--border)',
                            background: selected === cat.id
                                ? 'rgba(34,197,94,0.12)'
                                : 'var(--bg-card)',
                            padding: '1rem',
                            textAlign: 'center',
                            transition: 'all 0.2s',
                            outline: 'none',
                        }}
                    >
                        <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>{cat.icon}</div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {cat.id}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            {cat.desc}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
