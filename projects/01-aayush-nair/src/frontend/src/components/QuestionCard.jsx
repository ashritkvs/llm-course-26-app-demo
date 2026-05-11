import { useState } from 'react'
import { createApiClient } from '../lib/api'

/**
 * QuestionCard — full Socratic interaction loop: answering → evaluating → feedback
 *
 * Supports two modes driven by the question data:
 *   - Open-ended: free textarea + Gemini evaluation
 *   - MCQ: 4 radio-style option buttons + deterministic evaluation
 *
 * Props:
 *   question        { id, question_text, concept_tag, difficulty, hint_1/2/3, options?, correct_answer? }
 *   onEvaluated(result)  stored in QuizPage after evaluation
 *   onNext()             advance index in QuizPage
 *   token           JWT session token
 *   onUnauthorized  401 handler
 *   isLast          boolean — show "See Results" instead of "Next Question"
 */
const QuestionCard = ({ question, onEvaluated, onNext, token, onUnauthorized, isLast }) => {
    const [phase, setPhase] = useState('answering')   // 'answering' | 'evaluating' | 'feedback'
    const [openAnswer, setOpenAnswer] = useState('')
    const [selectedOption, setSelectedOption] = useState(null)
    const [answerError, setAnswerError] = useState('')
    const [revealedHints, setRevealedHints] = useState([])
    const [result, setResult] = useState(null)

    // ── null guard ────────────────────────────────────────────────────────────
    if (!question) {
        return (
            <div className="card animate-fade-in-up" style={{ textAlign: 'center', padding: '2.5rem' }}>
                <div className="loading-spinner" style={{ margin: '0 auto 1rem' }} />
                <p style={{ color: 'var(--text-secondary)' }}>Loading question…</p>
            </div>
        )
    }

    const isMCQ = (question.options || []).length === 4

    const hints = [
        question.hint_1 || '',
        question.hint_2 || '',
        question.hint_3 || '',
    ].filter(Boolean)

    const nextHintIdx = revealedHints.length
    const hasMoreHints = nextHintIdx < hints.length

    const hintMeta = [
        { bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.2)',  color: 'var(--accent-primary)',   label: 'Hint 1' },
        { bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)', color: 'var(--accent-secondary)', label: 'Hint 2' },
        { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', color: 'var(--warning)',          label: 'Hint 3' },
    ]

    // ── actions ───────────────────────────────────────────────────────────────
    const revealNextHint = () => {
        if (!hasMoreHints) return
        setRevealedHints(prev => [...prev, nextHintIdx])
    }

    const handleSubmit = async () => {
        const submittedAnswer = isMCQ ? selectedOption : openAnswer.trim()
        if (!submittedAnswer) {
            setAnswerError(isMCQ ? 'Please select an option.' : 'Please enter an answer before submitting.')
            return
        }
        setAnswerError('')
        setPhase('evaluating')

        const api = createApiClient(token, onUnauthorized)
        try {
            const data = await api.post('/quiz/answer', {
                question_id: question.id,
                student_answer: submittedAnswer,
                hints_used: revealedHints.length,
            })

            const normalized = {
                ...data,
                correct: data.correct ?? data.is_correct ?? false,
                feedback: data.feedback || data.explanation || '',
                ideal_answer: data.ideal_answer || '',
                question_text: question.question_text,
                concept_tag: question.concept_tag,
                student_answer: submittedAnswer,
                hints_used: revealedHints.length,
            }
            setResult(normalized)
            setPhase('feedback')
            onEvaluated?.(normalized)
        } catch (err) {
            console.error('[QuestionCard]', err)
            setPhase('answering')
            setAnswerError(`Evaluation failed: ${err.message}`)
        }
    }

    const handleKeyDown = (e) => {
        if (!isMCQ && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
    }

    const handleNext = () => {
        setPhase('answering')
        setOpenAnswer('')
        setSelectedOption(null)
        setAnswerError('')
        setRevealedHints([])
        setResult(null)
        onNext?.()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EVALUATING PHASE
    // ─────────────────────────────────────────────────────────────────────────
    if (phase === 'evaluating') {
        return (
            <div className="card animate-fade-in-up" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                <div className="loading-spinner" style={{ margin: '0 auto 1.25rem' }} />
                <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Evaluating your answer…</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
                    {isMCQ ? 'Checking your selection…' : 'Gemini is reviewing your reasoning'}
                </p>
            </div>
        )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FEEDBACK PHASE
    // ─────────────────────────────────────────────────────────────────────────
    if (phase === 'feedback' && result) {
        const isCorrect = result.correct
        const rawScore = result.reasoning_score
        const displayScore = rawScore <= 1 ? Math.round(rawScore * 5) : Math.round(rawScore)
        const stars = '★'.repeat(displayScore) + '☆'.repeat(5 - displayScore)

        return (
            <div className="card animate-fade-in-up">
                {/* Result banner */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1.25rem',
                    background: isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                    <div>
                        <p style={{ fontWeight: 700, color: isCorrect ? 'var(--success)' : 'var(--error)', fontSize: '1rem' }}>
                            {isCorrect ? 'Correct' : 'Not quite right'}
                        </p>
                        {!isMCQ && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.15rem' }}>
                                Reasoning: {stars} {displayScore}/5
                            </p>
                        )}
                    </div>
                </div>

                {/* MCQ: highlight correct/wrong options */}
                {isMCQ && (
                    <div style={{ marginBottom: '1.25rem' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                            Options
                        </p>
                        {(question.options || []).map((opt, i) => {
                            const isSelected = opt === result.student_answer
                            const isRight = opt === result.correct_answer
                            let bg = 'var(--bg-glass)'
                            let border = 'var(--border-subtle)'
                            let icon = null
                            if (isRight) { bg = 'rgba(34,197,94,0.12)'; border = 'rgba(34,197,94,0.35)'; icon = '✓' }
                            else if (isSelected && !isRight) { bg = 'rgba(239,68,68,0.1)'; border = 'rgba(239,68,68,0.3)'; icon = '✗' }
                            return (
                                <div key={i} style={{
                                    display: 'flex', gap: '0.6rem', alignItems: 'center',
                                    padding: '0.65rem 0.9rem',
                                    borderRadius: 'var(--radius-sm)',
                                    marginBottom: '0.4rem',
                                    background: bg,
                                    border: `1px solid ${border}`,
                                    fontWeight: isRight || (isSelected && !isRight) ? 600 : 400,
                                    color: isRight ? 'var(--success)' : isSelected ? 'var(--error)' : 'var(--text-primary)',
                                    fontSize: '0.9rem',
                                }}>
                                    {icon && <span>{icon}</span>}
                                    <span>{opt}</span>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Open-ended: rich feedback layout */}
                {!isMCQ && (() => {
                    const scoreLabel =
                        displayScore === 5 ? 'Full understanding' :
                        displayScore === 4 ? 'Strong understanding' :
                        displayScore === 3 ? 'Partial understanding' :
                        displayScore === 2 ? 'Minimal understanding' :
                                            'No understanding shown'
                    const scoreColor =
                        displayScore >= 4 ? 'var(--success)' :
                        displayScore === 3 ? 'var(--warning)' :
                                            'var(--error)'
                    return (
                        <>
                            {/* Question recap */}
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
                                Question
                            </p>
                            <p style={{ fontSize: '0.92rem', fontWeight: 600, lineHeight: 1.55, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                                {question.question_text}
                            </p>

                            {/* Your answer */}
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
                                Your answer
                            </p>
                            <p style={{
                                padding: '0.7rem 0.9rem',
                                background: 'var(--bg-glass)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.9rem',
                                lineHeight: 1.5,
                                marginBottom: '1rem',
                                color: 'var(--text-secondary)',
                                fontStyle: 'italic',
                            }}>
                                {result.student_answer}
                            </p>

                            {/* Reasoning score card */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                padding: '0.75rem 1rem',
                                background: 'var(--bg-glass)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: '1rem',
                                borderLeft: `3px solid ${scoreColor}`,
                            }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: scoreColor, marginBottom: '0.15rem' }}>
                                        Reasoning Quality
                                    </p>
                                    <p style={{ fontSize: '1.05rem', color: scoreColor, fontWeight: 700 }}>
                                        {stars}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: '1.2rem', fontWeight: 800, color: scoreColor }}>{displayScore}/5</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{scoreLabel}</p>
                                </div>
                            </div>

                            {/* Gemini feedback explanation */}
                            {result.feedback && (
                                <div style={{
                                    padding: '0.85rem 1rem',
                                    background: isCorrect ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                                    border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'}`,
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: '1rem',
                                }}>
                                    <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: isCorrect ? 'var(--success)' : 'var(--error)', marginBottom: '0.4rem' }}>
                                        {isCorrect ? 'What you got right' : 'What needs work'}
                                    </p>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.65 }}>
                                        {result.feedback}
                                    </p>
                                </div>
                            )}

                            {/* Socratic nudge */}
                            {!isCorrect && result.socratic_hint && (
                                <div style={{
                                    padding: '0.85rem 1rem',
                                    background: 'rgba(99,102,241,0.07)',
                                    border: '1px solid rgba(99,102,241,0.22)',
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: '1.15rem',
                                }}>
                                    <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-primary)', marginBottom: '0.4rem' }}>
                                        Think about this before moving on
                                    </p>
                                    <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.65, fontStyle: 'italic' }}>
                                        {result.socratic_hint}
                                    </p>
                                </div>
                            )}
                        </>
                    )
                })()}

                {/* Next */}
                <button
                    id="next-question-btn"
                    className="btn btn-primary"
                    onClick={handleNext}
                    style={{ width: '100%' }}
                >
                    {isLast ? 'See Results' : 'Next Question'}
                </button>
            </div>
        )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ANSWERING PHASE
    // ─────────────────────────────────────────────────────────────────────────
    const canSubmit = isMCQ ? selectedOption !== null : openAnswer.trim().length > 0

    return (
        <div className="card animate-fade-in-up">
            {/* Tags row */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {question.concept_tag && question.concept_tag.length <= 60 && (
                    <span style={{
                        padding: '0.15rem 0.65rem',
                        borderRadius: '100px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: 'rgba(99,102,241,0.12)',
                        color: 'var(--accent-primary-hover)',
                        letterSpacing: '0.03em',
                    }}>
                        {question.concept_tag}
                    </span>
                )}
                {question.difficulty && (
                    <span className={`badge badge-${question.difficulty}`} style={{ fontSize: '0.7rem' }}>
                        {question.difficulty}
                    </span>
                )}
                {isMCQ && (
                    <span style={{ padding: '0.15rem 0.65rem', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(245,158,11,0.1)', color: 'var(--warning)', letterSpacing: '0.03em' }}>
                        MCQ
                    </span>
                )}
            </div>

            {/* Question text */}
            <h3 style={{ marginBottom: '1.5rem', lineHeight: 1.55, fontSize: '1.05rem' }}>
                {question.question_text || 'Question text unavailable.'}
            </h3>

            {/* Revealed hints */}
            {revealedHints.map(idx => (
                hints[idx] ? (
                    <div key={idx} className="animate-fade-in" style={{
                        padding: '0.8rem 1rem',
                        background: hintMeta[idx].bg,
                        border: `1px solid ${hintMeta[idx].border}`,
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '0.65rem',
                    }}>
                        <p style={{ color: hintMeta[idx].color, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                            {hintMeta[idx].label}
                        </p>
                        <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontStyle: 'italic', lineHeight: 1.6 }}>
                            {hints[idx]}
                        </p>
                    </div>
                ) : null
            ))}

            {/* Reveal next hint */}
            {hints.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    {hasMoreHints && (
                        <button
                            className="btn btn-secondary"
                            onClick={revealNextHint}
                            style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
                        >
                            {revealedHints.length === 0
                                ? 'Need a hint?'
                                : `Hint ${revealedHints.length + 1} of ${hints.length}`}
                        </button>
                    )}
                    {revealedHints.length > 0 && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            {revealedHints.length}/{hints.length} revealed
                        </span>
                    )}
                </div>
            )}

            {/* MCQ options */}
            {isMCQ && (
                <div style={{ marginBottom: '1rem' }}>
                    {(question.options || []).map((opt, i) => {
                        const isSelected = opt === selectedOption
                        return (
                            <button
                                key={i}
                                id={`mcq-option-${i}`}
                                onClick={() => { setSelectedOption(opt); setAnswerError('') }}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '0.75rem 1rem',
                                    marginBottom: '0.4rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                                    background: isSelected ? 'rgba(99,102,241,0.1)' : 'var(--bg-glass)',
                                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                                    fontWeight: isSelected ? 600 : 400,
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    lineHeight: 1.45,
                                    transition: 'all 0.15s ease',
                                }}
                                aria-pressed={isSelected}
                            >
                                <span style={{ marginRight: '0.6rem', opacity: 0.6 }}>
                                    {['A', 'B', 'C', 'D'][i]}.
                                </span>
                                {opt}
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Open-ended textarea */}
            {!isMCQ && (
                <textarea
                    id="answer-input"
                    className="input problem-textarea"
                    placeholder="Type your answer… (⌘+Enter to submit)"
                    value={openAnswer}
                    onChange={e => { setOpenAnswer(e.target.value); if (answerError) setAnswerError('') }}
                    onKeyDown={handleKeyDown}
                    rows={4}
                    style={{ marginBottom: answerError ? '0.5rem' : '1rem' }}
                />
            )}

            {/* Validation error */}
            {answerError && (
                <p className="validation-error animate-fade-in" style={{ marginBottom: '0.75rem' }}>
                    {answerError}
                </p>
            )}

            {/* Submit */}
            <button
                id="submit-answer-btn"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{ width: '100%', opacity: !canSubmit ? 0.5 : 1 }}
            >
                Submit Answer
            </button>

            {!isMCQ && openAnswer.trim() && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', marginTop: '0.5rem' }}>
                    Cmd+Enter to submit
                </p>
            )}
        </div>
    )
}

export default QuestionCard
