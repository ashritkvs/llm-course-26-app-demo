import { useState, useEffect } from 'react'
import { createApiClient } from '../../lib/api'

const scoreClass = (accuracy) => {
    if (accuracy === null || accuracy === undefined) return 'badge-medium'
    if (accuracy >= 0.80) return 'badge-easy'
    if (accuracy >= 0.65) return 'badge-medium'
    return 'badge-hard'
}

const formatDate = (isoString) => {
    if (!isoString) return ''
    return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const RecentSessionsList = ({ token, onUnauthorized, onResume, onReview }) => {
    const [sessions, setSessions] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [deletingId, setDeletingId] = useState(null)

    useEffect(() => {
        if (!token) { setLoading(false); return }
        loadSessions()
    }, [token])

    const loadSessions = () => {
        const api = createApiClient(token, onUnauthorized)
        setLoading(true)
        api.get('/sessions/recent')
            .then(data => {
                setSessions(data.sessions || [])
                setLoading(false)
            })
            .catch(err => {
                console.warn('[RecentSessions] fetch failed:', err.message)
                setError(err.message)
                setLoading(false)
            })
    }

    const handleDelete = async (sessionId) => {
        if (!window.confirm('Delete this session? This cannot be undone.')) return
        setDeletingId(sessionId)
        const api = createApiClient(token, onUnauthorized)
        try {
            await api.delete(`/sessions/${sessionId}`)
            setSessions(prev => prev.filter(s => s.session_id !== sessionId))
        } catch (err) {
            console.error('[Delete session]', err)
            alert(`Could not delete session: ${err.message}`)
        } finally {
            setDeletingId(null)
        }
    }

    if (loading) {
        return (
            <div className="recent-sessions">
                <h3 className="recent-sessions-title">Recent Sessions</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
            </div>
        )
    }

    if (error || sessions.length === 0) {
        return (
            <div className="recent-sessions">
                <h3 className="recent-sessions-title">Recent Sessions</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    {error ? 'Could not load sessions.' : 'No sessions yet. Start your first quiz!'}
                </p>
            </div>
        )
    }

    return (
        <div className="recent-sessions animate-fade-in-up">
            <h3 className="recent-sessions-title">Recent Sessions</h3>
            <div className="stagger-children">
                {sessions.map(session => (
                    <div key={session.session_id} className="recent-session-item">
                        <div className="recent-session-info">
                            <span className="recent-session-topic">{session.topic}</span>
                            <span className="recent-session-meta">
                                {formatDate(session.date)}
                                {session.date && ' · '}
                                <span className={`badge badge-${session.difficulty}`}>{session.difficulty}</span>
                            </span>
                        </div>
                        <div className="recent-session-right">
                            {session.accuracy !== null && session.accuracy !== undefined ? (
                                <span className={`badge ${scoreClass(session.accuracy)}`}>
                                    {Math.round(session.accuracy * 100)}%
                                </span>
                            ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                            )}
                            {/* Review */}
                            <button
                                className="btn btn-ghost recent-session-btn"
                                onClick={() => onReview?.(session.session_id)}
                                aria-label={`Review ${session.topic}`}
                                style={{ fontSize: '0.8rem' }}
                            >
                                Review
                            </button>
                            {/* Retry */}
                            <button
                                className="btn btn-ghost recent-session-btn"
                                onClick={() => onResume?.(session.topic)}
                                aria-label={`Retry ${session.topic}`}
                            >
                                Retry →
                            </button>
                            {/* Delete */}
                            <button
                                className="btn btn-ghost"
                                onClick={() => handleDelete(session.session_id)}
                                disabled={deletingId === session.session_id}
                                aria-label={`Delete session for ${session.topic}`}
                                title="Delete session"
                                style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.85rem',
                                    opacity: deletingId === session.session_id ? 0.4 : 0.6,
                                    color: 'var(--error)',
                                }}
                            >
                                {deletingId === session.session_id ? '…' : '🗑'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default RecentSessionsList
