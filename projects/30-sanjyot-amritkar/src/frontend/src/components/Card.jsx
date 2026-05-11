const Card = ({ title, children }) => {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/90 p-5 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.45)] backdrop-blur">
      {title && (
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
};

export default Card;
