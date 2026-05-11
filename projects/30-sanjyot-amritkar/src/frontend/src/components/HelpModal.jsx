import { helpSections } from '../utils/helpContent.js';
import Button from './Button.jsx';

const HelpModal = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">How this app works</h2>
            <p className="mt-1 text-xs text-slate-600">
              Quick guidance on tracking burnout, adapting workouts, and reading your dashboard.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            aria-label="Close help"
          >
            ×
          </button>
        </div>

        <div className="mt-4 space-y-3 text-xs text-slate-700">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {helpSections.burnoutTracking.title}
            </h3>
            <p className="mt-1 leading-relaxed">{helpSections.burnoutTracking.body}</p>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {helpSections.workoutAdaptation.title}
            </h3>
            <p className="mt-1 leading-relaxed">{helpSections.workoutAdaptation.body}</p>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {helpSections.dashboardInsights.title}
            </h3>
            <p className="mt-1 leading-relaxed">{helpSections.dashboardInsights.body}</p>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {helpSections.quickTips.title}
            </h3>
            <ul className="mt-1 space-y-1 list-disc pl-4">
              {helpSections.quickTips.items.map((tip, index) => (
                <li key={index} className="leading-relaxed">
                  {tip}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-5 flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
