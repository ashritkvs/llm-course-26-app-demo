import { useState } from 'react'
import { createApiClient } from '../lib/api'

/**
 * ProblemSolver — Step-by-step Socratic guidance with LLM reasoning evaluation.
 *
 * Props:
 *   steps          — array of { question, hint } from /problem/solve
 *   problem        — original problem statement (sent to evaluator for context)
 *   onReset        — callback to return to setup screen
 *   token          — JWT session token
 *   onUnauthorized — 401 handler
 */
const ProblemSolver = ({ steps, problem, onReset, token, onUnauthorized }) => {
    const [currentStep, setCurrentStep] = useState(0)
    const [answer, setAnswer] = useState('')
    const [hintVisible, setHintVisible] = useState(false)
    const [phase, setPhase] = useState('answering')   // 'answering' | 'evaluating' | 'feedback'
    const [feedback, setFeedback] = useState(null)    // { reasoning_score, on_track, what_went_wrong, socratic_nudge }
    const [responses, setResponses] = useState([])    // { answer, hintUsed, on_track, score }
    const [evalError, setEvalError] = useState('')

    const total = steps.length
    const step = steps[currentStep]
    const isLast = currentStep === total - 1
    const isDone = currentStep >= total

    const stars = (score) => '★'.repeat(score) + '☆'.repeat(5 - score)

    // ── Submit answer for evaluation ─────────────────────────────────────────
    const handleSubmit = async () => {
        if (!answer.trim()) return
        setEvalError('')
        setPhase('evaluating')

        const api = createApiClient(token, onUnauthorized)
        try {
            const data = await api.post('/problem/evaluate', {
                problem,
                question: step.question,
                hint: hintVisible ? step.hint : '',
                student_answer: answer.trim(),
                step_num: currentStep + 1,
                total_steps: total,
            })
            setFeedback(data)
            setPhase('feedback')
        } catch (err) {
            console.error('[ProblemSolver]', err)
            setPhase('answering')
            setEvalError(`Evaluation failed: ${err.message}`)
        }
    }

    // ── Advance to next step ──────────────────────────────────────────────────
    const handleNext = () => {
        setResponses(prev => [...prev, {
            answer,
            hintUsed: hintVisible,
            on_track: feedback?.on_track ?? true,
            score: feedback?.reasoning_score ?? 3,
        }])
        setAnswer('')
        setHintVisible(false)
        setFeedback(null)
        setEvalError('')
        setPhase('answering')
        setCurrentStep(prev => prev + 1)
    }

    // ── Done screen ──────────────────────────────────────────────────────────
    if (isDone) {
        const avgScore = responses.length
            ? Math.round(responses.reduce((s, r) => s + r.score, 0) / responses.length)
            : 0
        const onTrackCount = responses.filter(r => r.on_track).length

        return (
            <div className="container">
                <div className="animate-fade-in-up" style={{ maxWidth: 640, margin: '3rem auto', textAlign: 'center' }}>
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎯</div>
                        <h2>Problem Walkthrough Complete!</h2>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                            You worked through {total} Socratic steps.
                        </p>

                        {/* Summary stats */}
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                            <div style={{ padding: '0.75rem 1.25rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', minWidth: 120 }}>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Avg Reasoning</p>
                                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '0.25rem' }}>
                                    {stars(avgScore)}
                                </p>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{avgScore}/5</p>
                            </div>
                            <div style={{ padding: '0.75rem 1.25rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', minWidth: 120 }}>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>On Track</p>
                                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.25rem' }}>
                                    {onTrackCount}/{total}
                                </p>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>steps</p>
                            </div>
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={onReset} style={{ width: '100%' }}>
                        ✦ Try Another Problem
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="container">
            <div style={{ maxWidth: 680, margin: '2rem auto' }}>
                {/* Problem header */}
                <div className="card problem-header animate-fade-in-up" style={{ marginBottom: '1.5rem' }}>
                    <p className="config-label" style={{ marginBottom: '0.4rem' }}>Problem</p>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{problem}</p>
                </div>

                {/* Progress */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Step {currentStep + 1} of {total}
                    </span>
                    <span className="badge badge-medium">Problem Mode</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg-glass)', borderRadius: 2, marginBottom: '1.5rem', overflow: 'hidden' }}>
                    <div style={{
                        height: '100%',
                        width: `${(currentStep / total) * 100}%`,
                        background: 'var(--accent-gradient)',
                        borderRadius: 2,
                        transition: 'width 0.3s ease',
                    }} />
                </div>

                {/* ── EVALUATING ───────────────────────────────────────────── */}
                {phase === 'evaluating' && (
                    <div className="card animate-fade-in-up" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto 1.25rem' }} />
                        <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Evaluating your reasoning…</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
                            Gemini is reviewing your response
                        </p>
                    </div>
                )}

                {/* ── FEEDBACK ─────────────────────────────────────────────── */}
                {phase === 'feedback' && feedback && (
                    <div className="card animate-fade-in-up" key={`fb-${currentStep}`}>
                        {/* Guiding question recap */}
                        <p className="config-label" style={{ marginBottom: '0.4rem' }}>Guiding Question</p>
                        <p style={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.5, marginBottom: '1.25rem' }}>
                            {step.question}
                        </p>

                        {/* Your answer */}
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>
                            Your Response
                        </p>
                        <p style={{
                            padding: '0.7rem 0.9rem',
                            background: 'var(--bg-glass)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.9rem',
                            lineHeight: 1.5,
                            marginBottom: '1.15rem',
                            color: 'var(--text-secondary)',
                            fontStyle: 'italic',
                        }}>
                            {answer}
                        </p>

                        {/* Reasoning score */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.9rem 1.1rem',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: '1rem',
                            background: feedback.on_track ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
                            border: `1px solid ${feedback.on_track ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
                        }}>
                            <div>
                                <p style={{ fontWeight: 700, color: feedback.on_track ? 'var(--success)' : 'var(--warning)', fontSize: '0.95rem' }}>
                                    {feedback.on_track ? 'Good reasoning — keep going!' : 'Needs more depth'}
                                </p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.15rem' }}>
                                    Reasoning: {stars(feedback.reasoning_score)} {feedback.reasoning_score}/5
                                </p>
                            </div>
                        </div>

                        {/* What went wrong */}
                        {!feedback.on_track && feedback.what_went_wrong && (
                            <div style={{
                                padding: '0.85rem 1rem',
                                background: 'rgba(239,68,68,0.07)',
                                border: '1px solid rgba(239,68,68,0.2)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: '1rem',
                            }}>
                                <p style={{ fontSize: '0.72rem', color: 'var(--error)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>
                                    Gap in reasoning
                                </p>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.55 }}>
                                    {feedback.what_went_wrong}
                                </p>
                            </div>
                        )}

                        {/* Socratic nudge */}
                        {feedback.socratic_nudge && (
                            <div className="config-note animate-fade-in" style={{ marginBottom: '1.25rem' }}>
                                <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem', opacity: 0.7 }}>
                                    Think about this…
                                </p>
                                <p style={{ fontSize: '0.9rem', lineHeight: 1.55, fontStyle: 'italic' }}>
                                    {feedback.socratic_nudge}
                                </p>
                            </div>
                        )}

                        <button
                            className="btn btn-primary"
                            onClick={handleNext}
                            style={{ width: '100%' }}
                        >
                            {isLast ? 'Finish ✓' : 'Next Step →'}
                        </button>
                    </div>
                )}

                {/* ── ANSWERING ────────────────────────────────────────────── */}
                {phase === 'answering' && (
                    <div className="card animate-fade-in" key={currentStep}>
                        <p className="config-label" style={{ marginBottom: '0.75rem' }}>Guiding Question</p>
                        <p style={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.5, marginBottom: '1.5rem' }}>
                            {step.question}
                        </p>

                        {/* Hint */}
                        {!hintVisible ? (
                            <button
                                className="btn btn-ghost"
                                onClick={() => setHintVisible(true)}
                                style={{ marginBottom: '1rem', fontSize: '0.85rem' }}
                            >
                                💡 Show hint
                            </button>
                        ) : (
                            <div className="config-note animate-fade-in" style={{ marginBottom: '1rem' }}>
                                💡 {step.hint}
                            </div>
                        )}

                        {/* Answer area */}
                        <textarea
                            className="input problem-textarea"
                            placeholder="Write your reasoning here… explain your thinking, not just the conclusion."
                            value={answer}
                            onChange={e => setAnswer(e.target.value)}
                            rows={4}
                            style={{ marginBottom: evalError ? '0.5rem' : '1rem' }}
                        />

                        {evalError && (
                            <p className="validation-error animate-fade-in" style={{ marginBottom: '0.75rem' }}>
                                {evalError}
                            </p>
                        )}

                        <button
                            className="btn btn-primary"
                            onClick={handleSubmit}
                            disabled={!answer.trim()}
                            style={{ width: '100%', opacity: !answer.trim() ? 0.5 : 1 }}
                        >
                            Submit Reasoning
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ProblemSolver
