const ProblemInput = ({ value, onChange, onSubmit }) => {
    return (
        <div className="topic-input-wrapper animate-fade-in">
            <textarea
                id="problem-input"
                className="input problem-textarea"
                placeholder={"Paste a problem statement\n\ne.g. 'Prove that √2 is irrational'\nor 'A train leaves Chicago at 60 mph...'"}
                value={value}
                onChange={e => onChange(e.target.value)}
                rows={5}
            />
            <p className="input-helper">
                We'll guide you step-by-step using Socratic questions — never giving away the answer.
            </p>
        </div>
    )
}

export default ProblemInput
