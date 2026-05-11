const EmptyState = ({ title, description }) => {
  return (
    <div
      className="rounded-2xl border border-dashed border-indigo-200/70 bg-indigo-50/40 px-4 py-6 text-center"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </div>
  );
};

export default EmptyState;
