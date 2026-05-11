import { useState } from 'react';
import { MAX_BURNOUT_SCORE } from '../utils/burnoutModel.js';

const levelStyles = {
  Low: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
  Moderate: 'border-amber-200 bg-amber-50/70 text-amber-700',
  High: 'border-orange-200 bg-orange-50/70 text-orange-700',
  Critical: 'border-rose-200 bg-rose-50/70 text-rose-700'
};

const levelGradients = {
  Low: 'from-emerald-500/15 via-emerald-200/10 to-transparent',
  Moderate: 'from-amber-500/15 via-amber-200/10 to-transparent',
  High: 'from-orange-500/15 via-orange-200/10 to-transparent',
  Critical: 'from-rose-500/15 via-rose-200/10 to-transparent'
};

const levelCopy = {
  Low: 'Maintain your current rhythm.',
  Moderate: 'Give yourself extra recovery time.',
  High: 'Reduce intensity and prioritize rest.',
  Critical: 'Focus on recovery and support.'
};

// Optional extra detail for interventions. Not every label needs an entry here.
const interventionDescriptions = {
  'Keep a consistent sleep schedule':
    'Aim for a regular sleep and wake time, even on weekends, to help your body reset.',
  'Plan one energizing activity':
    'Choose a small activity you find genuinely enjoyable, like a short walk or hobby.',
  'Maintain light movement':
    'Gentle movement such as stretching or walking can support recovery without adding strain.',
  'Swap one workout for mobility':
    'Replace a demanding session with 10–20 minutes of mobility or yoga to reduce load.',
  'Add a 10-minute walk':
    'A brief walk can improve mood and circulation without significantly increasing fatigue.',
  'Block a restful evening':
    'Protect one evening from work and screens to unwind and recharge.',
  'Reduce workout intensity by 20%':
    'Dial back weights, sets, or speed so your body can recover while you stay consistent.',
  'Aim for early bedtime':
    'Try going to bed 30–60 minutes earlier to support deeper, higher-quality rest.',
  'Schedule a social check-in':
    'Plan a low-pressure chat with a friend or loved one to feel more supported.',
  'Take a full rest day':
    'Give your body and mind a complete break from structured training for at least one day.',
  'Hydrate and eat regularly':
    'Focus on regular meals and water intake to stabilize energy across the day.',
  'Ask for support if needed':
    'If burnout feels overwhelming, consider reaching out to a trusted person or professional.'
};

const BurnoutResultCard = ({ result, completedInterventions = [], onToggleComplete }) => {
  if (!result) return null;

  const [activeLabel, setActiveLabel] = useState(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)]">
      <div className={`bg-gradient-to-r ${levelGradients[result.level]} px-4 py-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Burnout level</p>
            <p className="text-xl font-semibold text-slate-900">{result.level}</p>
            <p className="mt-0.5 text-xs text-slate-600">{levelCopy[result.level]}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${levelStyles[result.level]}`}>
            {result.level}
          </span>
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        <p className="text-[13px] leading-relaxed text-slate-600">{result.explanation}</p>

        {typeof result.riskScore === 'number' && (
          <p className="mt-1 text-[11px] text-slate-500">
            Burnout score: {Math.round(result.riskScore)}/{MAX_BURNOUT_SCORE}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {result.interventions.map((item) => {
            const isActive = activeLabel === item;
            const isCompleted = completedInterventions.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => setActiveLabel((prev) => (prev === item ? null : item))}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-1 focus:ring-offset-white ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-50 text-slate-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-slate-900'
                }`}
                aria-pressed={isActive}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-indigo-500' : 'bg-slate-400'}`} />
                <span className={isCompleted ? 'line-through decoration-emerald-500/80 decoration-2' : ''}>
                  {item}
                </span>
                {isCompleted && (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-semibold text-white">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {activeLabel && interventionDescriptions[activeLabel] && (
          <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-700">
            <p>{interventionDescriptions[activeLabel]}</p>
            {onToggleComplete && (
              <button
                type="button"
                onClick={() => onToggleComplete(activeLabel)}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:ring-offset-1 focus:ring-offset-slate-50"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>
                  {completedInterventions.includes(activeLabel)
                    ? 'Mark as not done'
                    : 'Mark this as done'}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BurnoutResultCard;
