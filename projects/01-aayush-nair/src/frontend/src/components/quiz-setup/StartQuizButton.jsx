const StartQuizButton = ({ loading, disabled, onClick }) => {
    return (
        <button
            id="start-quiz-btn"
            className={`btn btn-primary start-quiz-btn${loading ? ' start-quiz-btn--loading' : ''}`}
            onClick={onClick}
            disabled={disabled || loading}
            aria-busy={loading}
        >
            {loading ? (
                <>
                    <span className="btn-spinner" />
                    Generating questions…
                </>
            ) : (
                <>
                    <span>✦</span>
                    Start Quiz
                </>
            )}
        </button>
    )
}

export default StartQuizButton
