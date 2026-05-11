import { useEffect, useState } from 'react'

// Cycling messages for each generation phase — follows HCI principle of
// "Visibility of system status" (Nielsen #1) and "Match between system and real world"
const PHASES = [
    { icon: '🧠', message: 'Analysing your topic…',          detail: 'Gemini is reading the concept space' },
    { icon: '🔍', message: 'Identifying key sub-concepts…',  detail: 'Building a concept map for your questions' },
    { icon: '✍️', message: 'Crafting Socratic questions…',   detail: 'Each question guides thinking, never just tests recall' },
    { icon: '💡', message: 'Writing progressive hints…',     detail: 'Three hints per question — from broad to specific' },
    { icon: '⚖️', message: 'Calibrating difficulty…',       detail: 'Tuning each question to the right challenge level' },
    { icon: '✅', message: 'Almost ready…',                  detail: 'Finalising your personalised quiz' },
]

// Interval per phase in ms (total ≈ 12s which covers most Gemini calls)
const PHASE_DURATION = 2000

export default function GeneratingScreen({ topic, mode, questionCount, difficulty }) {
    const [phaseIdx, setPhaseIdx] = useState(0)
    const [progress, setProgress]  = useState(0)          // 0–100 for progress bar
    const [entered, setEntered]    = useState(false)

    // Tick through phases
    useEffect(() => {
        setEntered(true)
        const interval = setInterval(() => {
            setPhaseIdx(prev => Math.min(prev + 1, PHASES.length - 1))
        }, PHASE_DURATION)
        return () => clearInterval(interval)
    }, [])

    // Smooth progress animation — advances roughly in sync with phases
    useEffect(() => {
        const target = Math.min(((phaseIdx + 1) / PHASES.length) * 92, 92) // cap at 92% until done
        const step = (target - progress) / 20
        const t = setInterval(() => {
            setProgress(p => {
                const next = p + step
                if (Math.abs(next - target) < 0.5) { clearInterval(t); return target }
                return next
            })
        }, 30)
        return () => clearInterval(t)
    }, [phaseIdx])

    const phase = PHASES[phaseIdx]
    const diffLabel = difficulty === 'adaptive' ? 'Adaptive' : difficulty

    return (
        <div
            className="generating-screen"
            style={{
                opacity: entered ? 1 : 0,
                transform: entered ? 'none' : 'translateY(16px)',
                transition: 'opacity 0.4s ease, transform 0.4s ease',
            }}
            aria-live="polite"
            aria-label="Generating quiz, please wait"
            role="status"
        >
            {/* Ambient background orbs */}
            <div className="gen-orb gen-orb-1" aria-hidden="true" />
            <div className="gen-orb gen-orb-2" aria-hidden="true" />
            <div className="gen-orb gen-orb-3" aria-hidden="true" />

            <div className="gen-card">
                {/* Animated icon */}
                <div className="gen-icon-ring" aria-hidden="true">
                    <span className="gen-icon">{phase.icon}</span>
                </div>

                {/* Quiz metadata chips */}
                <div className="gen-chips" aria-label="Quiz configuration">
                    {topic && (
                        <span className="gen-chip gen-chip-topic" title="Topic">
                            📚 {topic.length > 28 ? topic.slice(0, 28) + '…' : topic}
                        </span>
                    )}
                    {mode === 'pdf' && (
                        <span className="gen-chip">📄 PDF</span>
                    )}
                    <span className="gen-chip">
                        {questionCount} question{questionCount !== 1 ? 's' : ''}
                    </span>
                    <span className="gen-chip gen-chip-diff" data-diff={difficulty}>
                        {diffLabel}
                    </span>
                </div>

                {/* Phase message — transitions smoothly */}
                <div className="gen-message-area">
                    <p
                        key={phaseIdx}                      /* remount triggers CSS animation */
                        className="gen-message animate-fade-in"
                    >
                        {phase.message}
                    </p>
                    <p
                        key={`d${phaseIdx}`}
                        className="gen-detail animate-fade-in"
                    >
                        {phase.detail}
                    </p>
                </div>

                {/* Progress bar */}
                <div className="gen-progress-track" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                    <div
                        className="gen-progress-fill"
                        style={{ width: `${progress}%` }}
                    />
                    <div className="gen-progress-shimmer" />
                </div>

                <p className="gen-footnote">
                    Socratic questions guide reasoning — not just right/wrong answers.
                </p>
            </div>
        </div>
    )
}
