import { useState, useEffect } from 'react'
import { createApiClient } from '../lib/api'

/**
 * SessionReviewPage — shows full replay of a past session.
 * Renders each question with the student's answer, correct/incorrect banner,
 * feedback, ideal answer, and reasoning score.
 *
 * Props:
 *   sessionId       Session UUID to review
 *   token           JWT session token
 *   onUnauthorized  401 handler
 *   onBack()        Called when user clicks Back
 */

const scoreColor = (score) => {
    if (score == null) return 'var(--text-muted)'
    if (score >= 4) return 'var(--success)'
    if (score >= 2) return 'var(--warning)'
    return 'var(--error)'
}

const SessionReviewPage = ({ sessionId, token, onUnauthorized, onBack }) => {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [session, setSession] = useState(null)

    useEffect(() => {
        if (!sessionId || !token) return
        const api = createApiClient(token, onUnauthorized)
        api.get(`/sessions/${sessionId}`)
            .then(data => {
                setSession(data)
                setLoading(false)
            })
            .catch(err => {
                setError(err.message)
                setLoading(false)
            })
    }, [sessionId, token])

    if (loading) {
        return (
            <div className="quiz-active-container animate-fade-in">
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto 1rem' }} />
                    <p style={{ color: 'var(--text-muted)' }}>Loading session…</p>
                </div>
            </div>
        )
    }

    if (error || !session) {
        return (
            <div className="quiz-active-container animate-fade-in">
                <p style={{ color: 'var(--error)', textAlign: 'center' }}>
                    {error || 'Session not found.'}
                </p>
                <button className="btn btn-ghost" onClick={onBack} style={{ marginTop: '1rem' }}>
                    ← Back
                </button>
            </div>
        )
    }

    const answered = (session.questions || []).filter(q => q.student_answer != null)
    const correct  = answered.filter(q => q.correct).length
    const accuracy = answered.length ? Math.round((correct / answered.length) * 100) : null

    return (
        <div className="quiz-active-container animate-fade-in">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.75rem' }}>
                <button
                    className="btn btn-ghost"
                    onClick={onBack}
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                >
                    ← Back
                </button>
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Session Review</h2>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {session.topic}
                        {session.difficulty && ` · `}
                        {session.difficulty && (
                            <span className={`badge badge-${session.difficulty}`}>{session.difficulty}</span>
                        )}
                    </p>
                </div>
                {accuracy !== null && (
                    <div style={{ textAlign: 'right' }}>
                        <span style={{
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: accuracy >= 80 ? 'var(--success)' : accuracy >= 65 ? 'var(--warning)' : 'var(--error)',
                        }}>
                            {accuracy}%
                        </span>
                        <br />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {correct}/{answered.length} correct
                        </span>
                    </div>
                )}
            </div>

            {/* Question cards */}
            {session.questions.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                    No questions recorded for this session.
                </p>
            ) : (
                <div className="stagger-children">
                    {session.questions.map((q, i) => {
                        const answered  = q.student_answer != null
                        const isCorrect = q.correct
                        // Normalise reasoning_score: DB stores 0-1 range from older sessions
                        const rawScore = q.reasoning_score
                        const displayScore = rawScore == null ? null
                            : rawScore <= 1.0 ? Math.round(rawScore * 5)
                            : Math.round(rawScore)
                        const isMCQ = Boolean(q.correct_answer)

                        return (
                            <div
                                key={q.question_id || i}
                                className="card"
                                style={{ marginBottom: '1rem' }}
                            >
                                {/* Question number + tags */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                        Q{i + 1}
                                    </span>
                                    {q.concept_tag && (
                                        <span style={{
                                            padding: '0.12rem 0.55rem',
                                            borderRadius: '100px',
                                            fontSize: '0.68rem',
                                            fontWeight: 600,
                                            background: 'rgba(99,102,241,0.1)',
                                            color: 'var(--accent-primary)',
                                        }}>
                                            {q.concept_tag}
                                        </span>
                                    )}
                                    {q.difficulty && (
                                        <span className={`badge badge-${q.difficulty}`} style={{ fontSize: '0.68rem' }}>
                                            {q.difficulty}
                                        </span>
                                    )}
                                    {isMCQ && (
                                        <span style={{ padding: '0.12rem 0.55rem', borderRadius: '100px', fontSize: '0.68rem', fontWeight: 600, background: 'rgba(245,158,11,0.1)', color: 'var(--warning)' }}>
                                            MCQ
                                        </span>
                                    )}
                                    {answered && (
                                        <span style={{
                                            marginLeft: 'auto',
                                            fontSize: '1rem',
                                        }}>
                                            {isCorrect ? '✅' : '❌'}
                                        </span>
                                    )}
                                </div>

                                {/* Question text */}
                                <p style={{ fontWeight: 500, lineHeight: 1.55, marginBottom: '0.9rem', fontSize: '0.95rem' }}>
                                    {q.question_text}
                                </p>

                                {answered ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                        {/* Student answer */}
                                        <div style={{
                                            padding: '0.65rem 0.9rem',
                                            background: isCorrect ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.06)',
                                            border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)'}`,
                                            borderRadius: 'var(--radius-sm)',
                                        }}>
                                            <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                                Your answer
                                            </p>
                                            <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', margin: 0, fontStyle: 'italic' }}>
                                                {q.student_answer || '(no answer)'}
                                            </p>
                                        </div>

                                        {/* Ideal answer */}
                                        {(q.ideal_answer || q.correct_answer) && (
                                            <div style={{
                                                padding: '0.65rem 0.9rem',
                                                background: 'rgba(99,102,241,0.07)',
                                                border: '1px solid rgba(99,102,241,0.18)',
                                                borderRadius: 'var(--radius-sm)',
                                            }}>
                                                <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-primary)', marginBottom: '0.25rem' }}>
                                                    📘 {isMCQ ? 'Correct answer' : 'Ideal answer'}
                                                </p>
                                                <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', margin: 0 }}>
                                                    {q.ideal_answer || q.correct_answer}
                                                </p>
                                            </div>
                                        )}

                                        {/* Feedback */}
                                        {q.feedback && (
                                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                                {q.feedback}
                                            </p>
                                        )}

                                        {/* Reasoning score (open-ended only) */}
                                        {!isMCQ && displayScore != null && (
                                            <p style={{ fontSize: '0.8rem', color: scoreColor(displayScore), fontWeight: 600 }}>
                                                Reasoning: {'⭐'.repeat(displayScore)}{'☆'.repeat(5 - displayScore)} {displayScore}/5
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                                        Not answered in this session
                                    </p>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default SessionReviewPage
