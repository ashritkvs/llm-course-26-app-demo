import { useState } from "react";

interface JournalFormProps {
  onAnalyze: (payload: { text: string; date: string }) => void;
  isBusy: boolean;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function JournalForm({ onAnalyze, isBusy }: JournalFormProps) {
  const [date, setDate] = useState(today);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!text.trim()) {
      setError("Please write something before analyzing.");
      return;
    }

    setError("");
    onAnalyze({ text: text.trim(), date });
  }

  return (
    <section className="panel panel-soft">
      <div className="section-heading">
        <p className="eyebrow">Daily Entry</p>
        <h2>Write your journal</h2>
      </div>

      <form className="journal-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Select date</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>

        <label className="field">
          <span>How was your day?</span>
          <textarea
            rows={8}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Write anything on your mind..."
          />
        </label>

        {error ? <p className="inline-message error">{error}</p> : null}

        <button className="primary-button" type="submit" disabled={isBusy}>
          {isBusy ? "Analyzing..." : "Analyze"}
        </button>
      </form>
    </section>
  );
}
