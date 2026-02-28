/**
 * KisanCall — CallStatusBadge
 */
export default function CallStatusBadge({ status }) {
    const map = {
        pending: { cls: 'badge-pending', label: '⏳ Pending' },
        active: { cls: 'badge-active', label: '🟢 Active' },
        ended: { cls: 'badge-ended', label: '✓ Ended' },
        rejected: { cls: 'badge-rejected', label: '✕ Rejected' },
    };
    const { cls, label } = map[status] || { cls: 'badge-ended', label: status };
    return <span className={`badge ${cls}`}>{label}</span>;
}
