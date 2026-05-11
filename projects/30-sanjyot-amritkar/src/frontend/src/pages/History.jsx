import { useMemo, useState } from 'react';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import useLocalStorage from '../hooks/useLocalStorage.js';
import { calculateBurnoutRiskScore, classifyBurnoutLevel } from '../utils/burnoutModel.js';
import { getEntryWeekKey, isValidPastOrPresentDate } from '../utils/dateUtils.js';

const History = () => {
  const [burnoutHistory, , burnoutError] = useLocalStorage('saf_burnout_history', []);
  const [workoutHistory, , workoutError] = useLocalStorage('saf_workout_history', []);
  const [openBurnoutId, setOpenBurnoutId] = useState(null);
  const [openWorkoutId, setOpenWorkoutId] = useState(null);

  const burnoutWeekGroups = useMemo(() => {
    if (!Array.isArray(burnoutHistory) || burnoutHistory.length === 0) return [];

    const groupsMap = new Map();

    burnoutHistory.forEach((entry) => {
      const weekKey = getEntryWeekKey(entry);
      if (!weekKey) return;
      if (!groupsMap.has(weekKey)) {
        groupsMap.set(weekKey, []);
      }
      groupsMap.get(weekKey).push(entry);
    });

    const groups = Array.from(groupsMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    return groups;
  }, [burnoutHistory]);

  return (
    <div className="space-y-6">
      {(burnoutError || workoutError) && (
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-700">
          {burnoutError || workoutError}
        </div>
      )}
      <Card title="Weekly Check-ins">
        {burnoutWeekGroups.length === 0 ? (
          <EmptyState
            title="No history yet"
            description="Complete your first burnout check-in to see weekly trends here."
          />
        ) : (
          <div className="space-y-3 text-sm text-slate-600">
            <p className="text-xs text-slate-500">
              These entries are snapshots from the past. The app uses your{' '}
              <span className="font-semibold">most recent</span> burnout check-in for new workout plans.
            </p>
            {burnoutWeekGroups.map(([weekKey, entries]) => {
              const checkInCount = entries.length;
              const weekLabel = weekKey;
              return (
                <div
                  key={weekKey}
                  className="rounded-2xl border border-white/60 bg-white/90 px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Week of {weekLabel}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {checkInCount === 1
                          ? '1 check-in this week'
                          : `${checkInCount} check-ins this week`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {entries.map((entry, index) => {
                      const riskScore = calculateBurnoutRiskScore(entry);
                      const derivedLevel = Number.isFinite(riskScore)
                        ? classifyBurnoutLevel(riskScore)
                        : null;
                      const burnoutLevel = entry.result?.level || derivedLevel;
                      const entryId = `${weekKey}-${entry.createdAt || index}`;
                      const isOpen = openBurnoutId === entryId;
                      const createdAtLabel =
                        entry.createdAt && isValidPastOrPresentDate(entry.createdAt)
                          ? new Date(entry.createdAt).toLocaleDateString()
                          : 'Unknown date';

                      return (
                        <div
                          key={entryId}
                          className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs sm:text-sm"
                        >
                          <button
                            type="button"
                            onClick={() => setOpenBurnoutId(isOpen ? null : entryId)}
                            className="flex w-full items-center justify-between gap-3 text-left"
                          >
                            <div>
                              <p className="text-xs font-semibold text-slate-800">
                                Check-in {checkInCount > 1 ? `#${index + 1}` : ''}
                              </p>
                              {burnoutLevel && (
                                <p className="mt-0.5 text-[11px] text-slate-500">
                                  Burnout level:{' '}
                                  <span className="font-semibold">{burnoutLevel}</span>
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                              <span>{createdAtLabel}</span>
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
                                  isOpen
                                    ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                                    : 'border-slate-200 bg-slate-50 text-slate-500'
                                }`}
                                aria-hidden="true"
                              >
                                {isOpen ? '−' : '+'}
                              </span>
                            </div>
                          </button>
                          {isOpen && (
                            <div className="mt-3 space-y-3 text-[11px] sm:text-sm">
                              <div className="grid grid-cols-2 gap-2">
                                <span>Sleep: {entry.sleep}</span>
                                <span>Stress: {entry.stress}</span>
                                <span>Energy: {entry.energy}</span>
                                <span>Social: {entry.social}</span>
                                <span>Enjoyment: {entry.enjoyment}</span>
                              </div>
                              {Array.isArray(entry.result?.interventions) &&
                                entry.result.interventions.length > 0 && (
                                  <div className="space-y-1.5">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                      Suggested interventions
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {entry.result.interventions.map((label) => {
                                        const completed =
                                          entry.interventionProgress &&
                                          Array.isArray(
                                            entry.interventionProgress.deterministicCompleted
                                          )
                                            ? entry.interventionProgress.deterministicCompleted.includes(
                                                label
                                              )
                                            : false;
                                        return (
                                          <span
                                            key={label}
                                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] ${
                                              completed
                                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                : 'bg-slate-50 text-slate-700 border border-slate-200'
                                            }`}
                                          >
                                            {completed && (
                                              <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-semibold text-white">
                                                ✓
                                              </span>
                                            )}
                                            <span
                                              className={
                                                completed
                                                  ? 'line-through decoration-emerald-400/80'
                                                  : ''
                                              }
                                            >
                                              {label}
                                            </span>
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <Card title="Saved Workouts">
        {workoutHistory.length === 0 ? (
          <EmptyState
            title="No saved workouts"
            description="Generated workouts can be saved for quick access later."
          />
        ) : (
          <div className="space-y-3 text-sm text-slate-600">
            {Array.isArray(workoutHistory) &&
              workoutHistory.map((entry, index) => {
              const workoutId = `${entry.createdAt}-${index}`;
              const isOpen = openWorkoutId === workoutId;
              const duration = (entry.adjustedDurationMinutes || entry.duration) ?? '—';
              return (
                <div
                  key={workoutId}
                  className="rounded-2xl border border-white/60 bg-white/90 px-4 py-3 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setOpenWorkoutId(isOpen ? null : workoutId)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {entry.title || 'Workout plan'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {duration} min • {entry.muscleGroup || '—'} • {entry.difficulty || '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>
                        {entry.createdAt && isValidPastOrPresentDate(entry.createdAt)
                          ? new Date(entry.createdAt).toLocaleDateString()
                          : 'Unknown date'}
                      </span>
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
                          isOpen
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                            : 'border-slate-200 bg-slate-50 text-slate-500'
                        }`}
                        aria-hidden="true"
                      >
                        {isOpen ? '−' : '+'}
                      </span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="mt-3 space-y-3 text-xs sm:text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span>Muscle group: {entry.muscleGroup}</span>
                        <span>Duration: {duration} min</span>
                        <span>Difficulty: {entry.difficulty}</span>
                        <span>Equipment: {entry.equipment}</span>
                      </div>
                      {(entry.burnoutLevelUsed || entry.adaptationMessage || entry.adaptationMode) && (
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-3 py-2 text-xs text-indigo-700">
                          {entry.burnoutLevelUsed && (
                            <p>
                              <span className="font-semibold">Burnout at generation:</span>{' '}
                              {entry.burnoutLevelUsed}
                            </p>
                          )}
                          {entry.adaptationMode && (
                            <p className="mt-1">
                              <span className="font-semibold">Adaptation mode:</span> {entry.adaptationMode}
                            </p>
                          )}
                          {entry.adaptationMessage && <p className="mt-1">{entry.adaptationMessage}</p>}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                          Status: {entry.status || 'Not started'}
                        </span>
                        {Number.isFinite(entry.exerciseCount) && entry.exerciseCount > 0 && (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                            {entry.exerciseCount} exercises
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
              })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default History;
