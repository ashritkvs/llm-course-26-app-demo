const LoadingCard = ({ label = 'Loading…' }) => {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/90 p-5 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.45)]">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        <p className="text-sm text-slate-600">{label}</p>
      </div>
    </div>
  );
};

export default LoadingCard;
