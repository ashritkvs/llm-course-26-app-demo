import ReactMarkdown from "react-markdown";

export default function Narrative({ markdown }) {
  if (!markdown) return null;

  return (
    <div className="narrative-box">
      <h2>Narrative</h2>
      <div className="md">
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}
