import { useState } from 'react'
import { createApiClient } from '../lib/api'

const HintReveal = ({ questionId, apiBase, token, onUnauthorized, onReveal }) => {
    const [hints, setHints] = useState([null, null, null])  // 3 progressive hints
    const [revealedCount, setRevealedCount] = useState(0)
    const [loading, setLoading] = useState(false)

    const fetchNextHint = async () => {
        const nextNumber = revealedCount + 1
        if (nextNumber > 3) return

        const api = createApiClient(token, onUnauthorized)
        setLoading(true)
        try {
            const data = await api.get(`/quiz/hint/${questionId}/${nextNumber}`)
            setHints(prev => {
                const updated = [...prev]
                updated[nextNumber - 1] = data.hint_text
                return updated
            })
            setRevealedCount(nextNumber)
            onReveal?.(nextNumber)
        } catch (err) {
            console.error('[HintReveal]', err)
        } finally {
            setLoading(false)
        }
    }

    const hintLabels = ['💡 Hint 1 — Gentle nudge', '🔍 Hint 2 — More guidance', '🎯 Hint 3 — Strong clue']
    const hintColors = [
        { bg: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.2)', label: 'var(--accent-primary)' },
        { bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.2)', label: 'var(--accent-secondary)' },
        { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)', label: 'var(--warning)' },
    ]

    return (
        <div style={{ marginTop: '0.5rem' }}>
            {/* Revealed hints */}
            {hints.map((hint, i) =>
                hint ? (
                    <div key={i} className="animate-fade-in" style={{
                        padding: '0.85rem 1.1rem',
                        background: hintColors[i].bg,
                        border: `1px solid ${hintColors[i].border}`,
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '0.5rem',
                    }}>
                        <p style={{
                            color: hintColors[i].label,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            marginBottom: '0.3rem',
                        }}>
                            {hintLabels[i]}
                        </p>
                        <p style={{
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            fontStyle: 'italic',
                            lineHeight: 1.6,
                        }}>
                            {hint}
                        </p>
                    </div>
                ) : null
            )}

            {/* Show next hint button */}
            {revealedCount < 3 && (
                <button
                    className="btn btn-secondary"
                    onClick={fetchNextHint}
                    disabled={loading}
                    style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                >
                    {loading ? 'Loading...' : revealedCount === 0 ? '💡 Need a hint?' : `🔓 Reveal hint ${revealedCount + 1} of 3`}
                </button>
            )}
        </div>
    )
}

export default HintReveal
