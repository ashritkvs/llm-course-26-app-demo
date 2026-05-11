const DIFFICULTY_OPTIONS = [
    { value: 'adaptive', label: 'Adaptive', desc: 'Adjusts based on performance' },
    { value: 'easy', label: 'Easy', className: 'option-easy' },
    { value: 'medium', label: 'Medium', className: 'option-medium' },
    { value: 'hard', label: 'Hard', className: 'option-hard' },
]

const COUNT_OPTIONS = [5, 10, 15]

const TYPE_OPTIONS = [
    { value: 'conceptual', label: 'Conceptual' },
    { value: 'application', label: 'Application' },
    { value: 'mixed', label: 'Mixed' },
]

const FORMAT_OPTIONS = [
    { value: 'open', label: '✏️ Open-ended', desc: 'Free-text answer, Socratic evaluation' },
    { value: 'mcq', label: '🔘 MCQ', desc: 'Pick the correct option from 4 choices' },
]

const QuizConfigPanel = ({
    difficulty, setDifficulty,
    count, setCount,
    questionType, setQuestionType,
    questionFormat, setQuestionFormat,
}) => {
    return (
        <div className="config-panel card">
            {/* Format */}
            <div className="config-group">
                <label className="config-label">Question Format</label>
                <div className="config-options">
                    {FORMAT_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            className={`config-option${questionFormat === opt.value ? ' config-option--active' : ''}`}
                            onClick={() => setQuestionFormat(opt.value)}
                            aria-pressed={questionFormat === opt.value}
                            title={opt.desc}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                {questionFormat === 'mcq' && (
                    <p className="config-note animate-fade-in">
                        🔘 MCQ mode: select from 4 options. Evaluated instantly
                    </p>
                )}
                {questionFormat === 'open' && (
                    <p className="config-note animate-fade-in">
                        ✏️ Open-ended mode: typed answers evaluated by Gemini with qualitative feedback.
                    </p>
                )}
            </div>

            <div className="config-divider" />

            {/* Difficulty */}
            <div className="config-group">
                <label className="config-label">Difficulty</label>
                <div className="config-options">
                    {DIFFICULTY_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            className={`config-option${difficulty === opt.value ? ' config-option--active' : ''}${opt.className ? ` ${opt.className}` : ''}`}
                            onClick={() => setDifficulty(opt.value)}
                            aria-pressed={difficulty === opt.value}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                {difficulty === 'adaptive' && (
                    <p className="config-note animate-fade-in">
                        ✦ Difficulty adjusts automatically based on your performance.
                    </p>
                )}
            </div>

            <div className="config-divider" />

            {/* Question Count */}
            <div className="config-group">
                <label className="config-label">Number of Questions</label>
                <div className="config-options">
                    {COUNT_OPTIONS.map(n => (
                        <button
                            key={n}
                            className={`config-option${count === n ? ' config-option--active' : ''}`}
                            onClick={() => setCount(n)}
                            aria-pressed={count === n}
                        >
                            {n}
                        </button>
                    ))}
                </div>
            </div>

            <div className="config-divider" />

            {/* Question Type */}
            <div className="config-group">
                <label className="config-label">Question Type</label>
                <div className="config-options">
                    {TYPE_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            className={`config-option${questionType === opt.value ? ' config-option--active' : ''}`}
                            onClick={() => setQuestionType(opt.value)}
                            aria-pressed={questionType === opt.value}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default QuizConfigPanel
