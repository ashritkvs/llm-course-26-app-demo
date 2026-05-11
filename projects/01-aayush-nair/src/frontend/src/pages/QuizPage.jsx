import { useState, useEffect, useRef } from 'react'
import { createApiClient } from '../lib/api'
import QuestionCard from '../components/QuestionCard'
import ProblemSolver from '../components/ProblemSolver'
import ModeToggle from '../components/quiz-setup/ModeToggle'
import TopicInput from '../components/quiz-setup/TopicInput'
import ProblemInput from '../components/quiz-setup/ProblemInput'
import PDFUploader from '../components/quiz-setup/PDFUploader'
import QuizConfigPanel from '../components/quiz-setup/QuizConfigPanel'
import StartQuizButton from '../components/quiz-setup/StartQuizButton'
import RecentSessionsList from '../components/quiz-setup/RecentSessionsList'
import SessionReviewPage from './SessionReviewPage'
import GeneratingScreen from '../components/GeneratingScreen'

// ── Problem "guide me" button ────────────────────────────────────────────────
const GuideMeButton = ({ loading, disabled, onClick }) => (
    <button
        id="guide-me-btn"
        className={`btn btn-primary start-quiz-btn${loading ? ' start-quiz-btn--loading' : ''}`}
        onClick={onClick}
        disabled={disabled || loading}
        aria-busy={loading}
    >
        {loading ? (
            <><span className="btn-spinner" /> Generating guidance…</>
        ) : (
            <><span>🧩</span> Guide Me Through This</>
        )}
    </button>
)

const QuizPage = ({ user, apiBase, onUnauthorized }) => {
    const token = user?.session_token
    const api = createApiClient(token, onUnauthorized)

    // ── Setup state ──────────────────────────────────────────────────────────
    const [mode, setMode] = useState('topic')
    const [topic, setTopic] = useState('')
    const [problem, setProblem] = useState('')
    const [file, setFile] = useState(null)
    const [extracting, setExtracting] = useState(false)
    const [difficulty, setDifficulty] = useState('adaptive')
    const [questionCount, setQuestionCount] = useState(5)
    const [questionType, setQuestionType] = useState('mixed')
    const [questionFormat, setQuestionFormat] = useState('open')   // 'open' | 'mcq'
    const [validationErr, setValidationErr] = useState('')
    const [reviewSessionId, setReviewSessionId] = useState(null)   // session to review

    // ── Quiz session state ───────────────────────────────────────────────────
    const [sessionId, setSessionId] = useState(null)
    const [questions, setQuestions] = useState([])
    const [currentIdx, setCurrentIdx] = useState(0)
    const [resolvedDifficulty, setResolvedDifficulty] = useState('')
    const [results, setResults] = useState([])
    const [quizLoading, setQuizLoading] = useState(false)
    const [quizComplete, setQuizComplete] = useState(false)

    // ── Adaptive state ────────────────────────────────────────────────────────
    const [currentQuestion, setCurrentQuestion] = useState(null)   // active question
    const [answeredCount, setAnsweredCount]     = useState(0)       // tracks how many answered
    const [liveDifficulty, setLiveDifficulty]   = useState('')      // shown in badge

    // ── Problem session state ────────────────────────────────────────────────
    const [problemLoading, setProblemLoading] = useState(false)
    const [problemSteps, setProblemSteps] = useState(null)

    // ── Validation ────────────────────────────────────────────────────────────
    const validate = () => {
        if (mode === 'topic' && !topic.trim()) {
            setValidationErr('Please enter a topic before starting.')
            return false
        }
        if (mode === 'problem' && !problem.trim()) {
            setValidationErr('Please enter a problem statement before starting.')
            return false
        }
        if (mode === 'pdf' && !file) {
            setValidationErr('Please upload a PDF before starting.')
            return false
        }
        setValidationErr('')
        return true
    }

    // ── Start Problem Mode ────────────────────────────────────────────────────
    const startProblem = async () => {
        if (!validate()) return
        setProblemLoading(true)
        try {
            const data = await api.post('/problem/solve', { problem })
            setProblemSteps(data.steps)
        } catch (err) {
            console.error('[ProblemMode]', err)
            alert(`Could not generate guidance: ${err.message}`)
        } finally {
            setProblemLoading(false)
        }
    }

    // ── Start Quiz ────────────────────────────────────────────────────────────
    const startQuiz = async () => {
        if (!validate()) return
        setQuizLoading(true)
        setQuizComplete(false)
        setResults([])
        setCurrentIdx(0)
        setAnsweredCount(0)
        setCurrentQuestion(null)

        let effectiveTopic = topic.trim()
        let sourcePdfText = null

        // PDF mode: upload first, use filename as display topic, raw text as source
        if (mode === 'pdf' && file) {
            setExtracting(true)
            try {
                const form = new FormData()
                form.append('file', file)
                const uploadData = await api.upload('/upload/pdf', form)
                // Clean filename becomes the topic (used as concept_tag title)
                effectiveTopic = file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ').trim()
                // Raw text goes to Gemini as reading material separately
                sourcePdfText = uploadData.text || null
            } catch (err) {
                console.error('[PDF Upload]', err)
                alert(`Could not process PDF: ${err.message}`)
                setQuizLoading(false)
                setExtracting(false)
                return
            } finally {
                setExtracting(false)
            }
        }

        try {
            const data = await api.post('/quiz/start', {
                topic: effectiveTopic,
                count: questionCount,
                difficulty: difficulty === 'adaptive' ? null : difficulty,
                question_type: questionType,
                question_format: questionFormat,
                source_type: mode,
                source_text: sourcePdfText,     // PDF text for Gemini context
            })
            console.log('[QuizPage] /quiz/start response:', data)

            if (!data.questions || data.questions.length === 0) {
                alert('No questions were generated. Try a different topic or try again.')
                setQuizLoading(false)
                return
            }

            // Normalize all questions from batch
            const normalized = data.questions.map(q => ({
                ...q,
                question_text: q.question_text || q.question || '',
                hint_1: q.hint_1 || '',
                hint_2: q.hint_2 || '',
                hint_3: q.hint_3 || '',
                concept_tags: (q.concept_tags && q.concept_tags.length > 0)
                    ? q.concept_tags
                    : [q.concept_tag].filter(Boolean),
            }))

            setSessionId(data.session_id)
            setResolvedDifficulty(data.difficulty)
            setLiveDifficulty(normalized[0]?.difficulty || data.difficulty)
            setQuestions(normalized)            // keep batch for non-adaptive modes
            setCurrentQuestion(normalized[0])   // seed first question
        } catch (err) {
            console.error('[StartQuiz]', err)
            alert(`Could not start quiz: ${err.message}`)
        } finally {
            setQuizLoading(false)
        }
    }

    // ── Evaluation result received from QuestionCard ──────────────────────────
    const handleEvaluated = (result) => {
        setResults(prev => [...prev, result])
    }

    // ── Complete session when quiz finishes ───────────────────────────────────
    // Calls /quiz/complete to set end_time — this activates adaptive difficulty
    // for the NEXT session (not within this one — all questions are pre-generated).
    const completedRef = useRef(false)   // guard against double-fire in StrictMode
    useEffect(() => {
        if (!quizComplete || !sessionId || completedRef.current) return
        completedRef.current = true
        const api = createApiClient(token, onUnauthorized)
        api.post('/quiz/complete', { session_id: sessionId })
            .catch(err => console.warn('[QuizComplete] non-fatal error:', err.message))
    }, [quizComplete, sessionId])

    // ── Advance through the prefetched batch (all modes, including adaptive) ─────
    // Adaptive difficulty is applied at session start based on last session accuracy.
    // Questions are pre-generated in one Gemini batch call — no mid-quiz fetching.
    const handleNext = () => {
        const nextAnswered = answeredCount + 1
        setAnsweredCount(nextAnswered)

        if (nextAnswered >= questionCount) {
            setQuizComplete(true)
            return
        }

        const nextIdx = nextAnswered
        if (nextIdx < questions.length) {
            setCurrentQuestion(questions[nextIdx])
            setLiveDifficulty(questions[nextIdx]?.difficulty || liveDifficulty)
            setCurrentIdx(nextIdx)
        } else {
            setQuizComplete(true)
        }
    }

    const resetAll = () => {
        setSessionId(null)
        setQuestions([])
        setCurrentQuestion(null)
        setTopic('')
        setProblem('')
        setFile(null)
        setProblemSteps(null)
        setQuizComplete(false)
        setResults([])
        setCurrentIdx(0)
        setAnsweredCount(0)
        setLiveDifficulty('')
        setResolvedDifficulty('')
        setValidationErr('')
    }

    const correctCount = results.filter(r => r.correct).length
    const score = results.length > 0
        ? (correctCount / results.length * 100).toFixed(0)
        : 0

    // ─────────────────────────────────────────────────────────────────────────
    // GENERATING PHASE — show creative loading screen while Gemini works
    // ─────────────────────────────────────────────────────────────────────────
    if (quizLoading || problemLoading) {
        return (
            <div className="container">
                <GeneratingScreen
                    topic={mode === 'problem' ? problem : topic}
                    mode={mode}
                    questionCount={questionCount}
                    difficulty={difficulty}
                />
            </div>
        )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SESSION REVIEW PHASE
    // ─────────────────────────────────────────────────────────────────────────
    if (reviewSessionId) {
        return (
            <SessionReviewPage
                sessionId={reviewSessionId}
                token={token}
                onUnauthorized={onUnauthorized}
                onBack={() => setReviewSessionId(null)}
            />
        )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PROBLEM SOLVER PHASE
    // ─────────────────────────────────────────────────────────────────────────
    if (problemSteps) {
        return (
            <ProblemSolver
                steps={problemSteps}
                problem={problem}
                onReset={resetAll}
                token={token}
                onUnauthorized={onUnauthorized}
            />
        )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // QUIZ IN-PROGRESS PHASE
    // ─────────────────────────────────────────────────────────────────────────
    if (sessionId && !quizComplete && currentQuestion) {
        const isLast = answeredCount + 1 >= questionCount
        const diffColor = liveDifficulty === 'easy' ? 'var(--success)'
            : liveDifficulty === 'hard' ? 'var(--error)'
            : 'var(--warning)'

        return (
            <div className="container">
                <div className="animate-fade-in" style={{ maxWidth: '700px', margin: '2rem auto' }}>
                    {/* Progress header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Question {answeredCount + 1} of {questionCount}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {/* Difficulty badge for current question */}
                            {liveDifficulty && (
                                <span style={{
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.78rem', fontWeight: 700,
                                    background: `${diffColor}18`,
                                    border: `1px solid ${diffColor}44`,
                                    color: diffColor,
                                    textTransform: 'capitalize',
                                }}>
                                    {liveDifficulty}
                                </span>
                            )}
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                {results.filter(r => r.correct).length}/{results.length} correct
                            </span>
                        </div>
                    </div>

                    {/* Progress bar — fills as answers are submitted */}
                    <div style={{ height: '4px', background: 'var(--bg-glass)', borderRadius: '2px', marginBottom: '2rem', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${(results.length / questionCount) * 100}%`,
                            background: 'var(--accent-gradient)',
                            borderRadius: '2px',
                            transition: 'width 0.4s ease',
                        }} />
                    </div>

                    <QuestionCard
                        key={currentQuestion?.id || answeredCount}
                        question={currentQuestion}
                        onEvaluated={handleEvaluated}
                        onNext={handleNext}
                        token={token}
                        onUnauthorized={onUnauthorized}
                        isLast={isLast}
                    />
                </div>
            </div>
        )
    }



    // ─────────────────────────────────────────────────────────────────────────
    // QUIZ COMPLETE PHASE
    // ─────────────────────────────────────────────────────────────────────────
    if (quizComplete) {
        // ── Compute concept mastery from results (client-side, deterministic) ──
        const masteryMap = {}
        const conceptAttempts = {}
        const conceptCorrect = {}

        results.forEach(r => {
            const tags = (r.concept_tags && r.concept_tags.length > 0)
                ? r.concept_tags
                : [r.concept_tag].filter(Boolean)
            tags.forEach(tag => {
                if (!tag) return
                conceptAttempts[tag] = (conceptAttempts[tag] || 0) + 1
                if (r.correct) conceptCorrect[tag] = (conceptCorrect[tag] || 0) + 1
            })
        })
        Object.keys(conceptAttempts).forEach(tag => {
            masteryMap[tag] = Math.round((conceptCorrect[tag] || 0) / conceptAttempts[tag] * 100)
        })

        const weakTopics      = Object.entries(masteryMap).filter(([, s]) => s < 50).map(([t]) => t)
        const developingTopics = Object.entries(masteryMap).filter(([, s]) => s >= 50 && s <= 75).map(([t]) => t)
        const strongTopics    = Object.entries(masteryMap).filter(([, s]) => s > 75).map(([t]) => t)

        const handleReinforce = async () => {
            const api = createApiClient(token, onUnauthorized)
            try {
                setQuizLoading(true)
                const data = await api.post('/quiz/reinforce', {
                    weak_topics: weakTopics,
                    question_format: questionFormat,
                    previous_difficulty: resolvedDifficulty || 'medium',
                })
                const normalized = (data.questions || []).map(q => ({
                    ...q,
                    question_text: q.question_text || q.question || '',
                    hint_1: q.hint_1 || '',
                    hint_2: q.hint_2 || '',
                    hint_3: q.hint_3 || '',
                    concept_tags: (q.concept_tags && q.concept_tags.length > 0) ? q.concept_tags : [q.concept_tag].filter(Boolean),
                }))
                completedRef.current = false   // allow /quiz/complete to fire for new session
                setSessionId(data.session_id)
                setResolvedDifficulty(data.difficulty)
                setLiveDifficulty(normalized[0]?.difficulty || data.difficulty)
                setQuestions(normalized)
                setCurrentQuestion(normalized[0])   // seed the first question
                setResults([])
                setCurrentIdx(0)
                setAnsweredCount(0)
                setQuizComplete(false)
            } catch (err) {
                alert(`Could not start reinforcement quiz: ${err.message}`)
            } finally {
                setQuizLoading(false)
            }
        }

        return (
            <div className="container">
                <div className="animate-fade-in-up" style={{ maxWidth: '640px', margin: '3rem auto', textAlign: 'center' }}>
                    {/* Score card */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <h2 style={{ marginBottom: '0.5rem' }}>Quiz Complete! 🎉</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Here's how you did on <strong>{questions[0]?.concept_tag || 'this topic'}</strong>
                        </p>
                        <div style={{
                            fontSize: '4.5rem', fontWeight: 800,
                            background: Number(score) >= 80
                                ? 'linear-gradient(135deg, #22c55e, #86efac)'
                                : Number(score) >= 65
                                    ? 'linear-gradient(135deg, #f59e0b, #fcd34d)'
                                    : 'linear-gradient(135deg, #ef4444, #fca5a5)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            margin: '0.5rem 0 1rem',
                        }}>{score}%</div>

                        {/* Stats row */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                            <div>
                                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{correctCount}</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Correct</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--error)' }}>{results.length - correctCount}</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Incorrect</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                    {results.reduce((sum, r) => sum + (r.hints_used || 0), 0)}
                                </p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Hints used</p>
                            </div>
                        </div>

                        {/* Adaptive nudge */}
                        <p style={{
                            marginTop: '1.25rem',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-glass)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.875rem',
                        }}>
                            {Number(score) >= 80
                                ? '🚀 Excellent work! Next session will challenge you with harder questions.'
                                : Number(score) >= 65
                                    ? '📈 Good effort! Keep going — you\'re building solid understanding.'
                                    : '📚 Review the feedback below and try again — learning takes practice!'}
                        </p>
                    </div>

                    {/* ── Concept Mastery Panel ───────────────────────────────── */}
                    {Object.keys(masteryMap).length > 0 && (
                        <div className="card animate-fade-in" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                            <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Concept Mastery
                            </h3>

                            {/* Mastery map bars */}
                            {Object.entries(masteryMap)
                                .sort(([, a], [, b]) => a - b)
                                .map(([tag, pct]) => {
                                    const color = pct < 50 ? 'var(--error)' : pct <= 75 ? 'var(--warning)' : 'var(--success)'
                                    const icon  = pct < 50 ? '⚠️' : pct <= 75 ? '📈' : '✅'
                                    return (
                                        <div key={tag} style={{ marginBottom: '0.65rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{icon} {tag}</span>
                                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color }}>{pct}%</span>
                                            </div>
                                            <div style={{ height: '5px', background: 'var(--bg-glass)', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                                            </div>
                                        </div>
                                    )
                                })}

                            {/* Weak / Developing / Strong summary chips */}
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                                {weakTopics.length > 0 && (
                                    <div style={{ padding: '0.4rem 0.8rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)' }}>
                                        <span style={{ color: 'var(--error)', fontSize: '0.75rem', fontWeight: 600 }}>⚠ Weak: {weakTopics.join(', ')}</span>
                                    </div>
                                )}
                                {developingTopics.length > 0 && (
                                    <div style={{ padding: '0.4rem 0.8rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-sm)' }}>
                                        <span style={{ color: 'var(--warning)', fontSize: '0.75rem', fontWeight: 600 }}>📈 Developing: {developingTopics.join(', ')}</span>
                                    </div>
                                )}
                                {strongTopics.length > 0 && (
                                    <div style={{ padding: '0.4rem 0.8rem', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-sm)' }}>
                                        <span style={{ color: 'var(--success)', fontSize: '0.75rem', fontWeight: 600 }}>✅ Strong: {strongTopics.join(', ')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Reinforcement CTA ───────────────────────────────────── */}
                    {weakTopics.length > 0 && (
                        <div className="card animate-fade-in" style={{
                            marginBottom: '1.5rem',
                            background: 'rgba(239,68,68,0.05)',
                            border: '1px solid rgba(239,68,68,0.15)',
                            textAlign: 'left',
                        }}>
                            <p style={{ color: 'var(--error)', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                                ⚠️ You struggled with:
                            </p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                {weakTopics.map(t => <strong key={t} style={{ color: 'var(--text-primary)', marginRight: '0.4rem' }}>{t}</strong>)}
                            </p>
                            <button
                                id="practice-weak-topics-btn"
                                className="btn btn-primary"
                                onClick={handleReinforce}
                                disabled={quizLoading}
                                style={{ width: '100%' }}
                            >
                                {quizLoading ? <><span className="btn-spinner" /> Generating…</> : '🎯 Practice Weak Topics'}
                            </button>
                        </div>
                    )}

                    {/* Per-question breakdown */}
                    <div className="stagger-children" style={{ textAlign: 'left' }}>
                        {results.map((r, i) => (
                            <div key={i} className="card" style={{
                                marginBottom: '0.75rem',
                                borderLeft: `3px solid ${r.correct ? 'var(--success)' : 'var(--error)'}`,
                            }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <span>{r.correct ? '✅' : '❌'}</span>
                                    <p style={{ fontWeight: 600, lineHeight: 1.5, flex: 1 }}>{r.question_text}</p>
                                </div>
                                {r.feedback && (
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.55, paddingLeft: '1.5rem' }}>
                                        {r.feedback}
                                    </p>
                                )}
                                {(r.misconceptions || []).length > 0 && (
                                    <p style={{ color: 'var(--error)', fontSize: '0.8rem', paddingLeft: '1.5rem', marginTop: '0.4rem' }}>
                                        Misconceptions: {r.misconceptions.join(', ')}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>

                    <button className="btn btn-primary" onClick={resetAll} style={{ marginTop: '1.5rem', width: '100%' }}>
                        Take Another Quiz
                    </button>
                </div>
            </div>
        )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SETUP PHASE
    // ─────────────────────────────────────────────────────────────────────────
    const quizStartDisabled = mode === 'topic' ? !topic.trim() : mode === 'pdf' ? !file : false

    return (
        <div className="container quiz-setup-container">
            <div className="quiz-setup-header animate-fade-in-up">
                <h1 className="quiz-setup-title"><span className="gradient-text">Configure Your Quiz</span></h1>
                <p className="quiz-setup-subtitle">Adaptive Socratic learning — questions evolve with your performance.</p>
            </div>

            <div className="quiz-setup-body animate-fade-in-up" style={{ animationDelay: '0.08s' }}>
                {/* Mode Toggle */}
                <div className="quiz-setup-section">
                    <label className="config-label">Input Source</label>
                    <ModeToggle mode={mode} onChange={(m) => { setMode(m); setValidationErr('') }} />
                </div>

                {/* Input based on mode */}
                <div className="quiz-setup-section">
                    {mode === 'topic' && (
                        <TopicInput value={topic} onChange={(v) => { setTopic(v); setValidationErr('') }} onEnter={startQuiz} />
                    )}
                    {mode === 'problem' && (
                        <ProblemInput value={problem} onChange={(v) => { setProblem(v); setValidationErr('') }} />
                    )}
                    {mode === 'pdf' && (
                        <PDFUploader file={file} onChange={(f) => { setFile(f); setValidationErr('') }} extracting={extracting} />
                    )}
                </div>

                {/* Config panel: only for quiz modes (not problem) */}
                {mode !== 'problem' && (
                    <div className="quiz-setup-section">
                        <QuizConfigPanel
                            difficulty={difficulty}
                            setDifficulty={setDifficulty}
                            count={questionCount}
                            setCount={setQuestionCount}
                            questionType={questionType}
                            setQuestionType={setQuestionType}
                            questionFormat={questionFormat}
                            setQuestionFormat={setQuestionFormat}
                        />
                    </div>
                )}

                {/* Validation error */}
                {validationErr && (
                    <p className="validation-error animate-fade-in">{validationErr}</p>
                )}

                {/* Start button */}
                {mode === 'problem' ? (
                    <GuideMeButton
                        loading={problemLoading}
                        disabled={!problem.trim()}
                        onClick={startProblem}
                    />
                ) : (
                    <StartQuizButton
                        loading={quizLoading}
                        disabled={quizStartDisabled}
                        onClick={startQuiz}
                    />
                )}
            </div>

            {/* Recent Sessions — live from Supabase */}
            <RecentSessionsList
                token={token}
                onUnauthorized={onUnauthorized}
                onResume={(t) => { setMode('topic'); setTopic(t) }}
                onReview={(sid) => setReviewSessionId(sid)}
            />
        </div>
    )
}

export default QuizPage
