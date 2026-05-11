import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Button from '../components/Button.jsx';
import useLocalStorage from '../hooks/useLocalStorage.js';
import { getBurnoutState } from '../utils/burnoutModel.js';

const Results = () => {
  const [burnoutHistory, , burnoutError] = useLocalStorage('saf_burnout_history', []);
  const [latestPlan] = useLocalStorage('saf_latest_workout_plan', null);

  const burnoutState = useMemo(() => getBurnoutState(burnoutHistory), [burnoutHistory]);

  const latestBurnoutEntry =
    Array.isArray(burnoutHistory) && burnoutHistory.length > 0 ? burnoutHistory[0] : null;

  const hasPlan = latestPlan && Array.isArray(latestPlan.sections) && latestPlan.sections.length > 0;

  const planCreatedAt = latestPlan?.createdAt ? new Date(latestPlan.createdAt) : null;
  const burnoutCreatedAt = latestBurnoutEntry?.createdAt
    ? new Date(latestBurnoutEntry.createdAt)
    : null;

  // Consider a plan "out of date" if:
  // - There is a burnout history entry, and
  // - The plan was created before the latest burnout entry, OR
  // - The plan has no timestamp at all (older plans created before this metadata existed).
  const planIsOlderThanLatestCheckin =
    !!latestBurnoutEntry && (!!planCreatedAt ? !!burnoutCreatedAt && planCreatedAt < burnoutCreatedAt : true);

  return (
    <div className="space-y-6">
      <Card title="Burnout Score">
        {burnoutError ? (
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-700">
            {burnoutError}
          </div>
        ) : burnoutState.source === 'baseline' ? (
          <EmptyState
            title="No score yet"
            description="Complete a burnout check-in to view your latest score and trend."
          />
        ) : (
          <div className="space-y-2 text-sm text-slate-700">
            <p>
              <span className="font-semibold">Current level:</span> {burnoutState.level}
              {burnoutState.trendLabel ? ` · ${burnoutState.trendLabel}` : ''}
            </p>
            {Number.isFinite(burnoutState.score) && (
              <p className="text-xs text-slate-500">Composite score: {burnoutState.score}</p>
            )}
            <p className="text-sm text-slate-600">{burnoutState.explanation}</p>
          </div>
        )}
      </Card>

      <Card title="Workout Plan">
        {!hasPlan ? (
          <div className="space-y-4">
            <EmptyState
              title="No plan generated"
              description="Generate a workout that matches your current burnout level."
            />
            <Link to="/workout">
              <Button type="button" variant="primary">
                Generate workout with this burnout level
              </Button>
            </Link>
          </div>
        ) : planIsOlderThanLatestCheckin ? (
          <div className="space-y-4">
            <EmptyState
              title="Plan is out of date"
              description="Your last workout plan was created before your most recent burnout check-in. Generate a new plan so it matches your current burnout level."
            />
            <Link to="/workout">
              <Button type="button" variant="primary">
                Generate new workout from latest burnout
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Latest plan</p>
                <p className="text-base font-semibold text-slate-900">{latestPlan.title}</p>
              </div>
              <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700">
                {latestPlan.duration}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1">
                Equipment: {latestPlan.equipment}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1">
                Burnout: {latestPlan.burnoutLevelUsed || burnoutState.level}
              </span>
            </div>
            {latestPlan.createdAt && (
              <p className="text-xs text-slate-500">
                Generated on {new Date(latestPlan.createdAt).toLocaleString()} using burnout level{' '}
                {latestPlan.burnoutLevelUsed || burnoutState.level}.
              </p>
            )}
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 px-3 py-2 text-xs text-indigo-800">
              <p className="font-semibold">How this plan was adapted</p>
              <p className="mt-1 text-indigo-700">
                {latestPlan.adaptationMessage || latestPlan.notes || burnoutState.adaptationMessage}
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Results;
