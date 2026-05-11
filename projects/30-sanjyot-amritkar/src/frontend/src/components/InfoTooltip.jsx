import { useState } from 'react';

const InfoTooltip = ({ label = 'Info', message }) => {
  const [open, setOpen] = useState(false);

  if (!message) return null;

  const show = () => setOpen(true);
  const hide = () => setOpen(false);
  const toggle = () => setOpen((prev) => !prev);

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-semibold text-slate-500 shadow-sm hover:border-indigo-300 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-1 focus:ring-offset-slate-50"
        aria-label={label}
        onClick={toggle}
        onFocus={show}
        onBlur={hide}
      >
        i
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600 shadow-lg">
          {message}
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;
