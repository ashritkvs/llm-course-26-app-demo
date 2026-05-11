const TopicInput = ({ value, onChange, onEnter }) => {
    return (
        <div className="topic-input-wrapper animate-fade-in">
            <input
                id="topic-input"
                className="input topic-input"
                placeholder="Enter topic (e.g., 'Operating Systems — Deadlocks')"
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onEnter?.()}
                autoFocus
            />
            <p className="input-helper">
                We generate adaptive Socratic questions with progressive hints tailored to your level.
            </p>
        </div>
    )
}

export default TopicInput
