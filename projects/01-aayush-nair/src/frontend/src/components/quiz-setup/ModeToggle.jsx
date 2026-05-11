const ModeToggle = ({ mode, onChange }) => {
    const modes = [
        { value: 'topic', icon: '✦', label: 'Topic' },
        { value: 'problem', icon: '🧩', label: 'Problem' },
        { value: 'pdf', icon: '📄', label: 'Upload PDF' },
    ]

    return (
        <div className="mode-toggle" role="group" aria-label="Input mode">
            {modes.map(m => (
                <button
                    key={m.value}
                    className={`mode-toggle-btn${mode === m.value ? ' mode-toggle-btn--active' : ''}`}
                    onClick={() => onChange(m.value)}
                    aria-pressed={mode === m.value}
                >
                    <span className="mode-toggle-icon">{m.icon}</span> {m.label}
                </button>
            ))}
        </div>
    )
}

export default ModeToggle
