import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import Card from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import BurnoutResultCard from '../components/BurnoutResultCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingCard from '../components/LoadingCard.jsx';
import InfoTooltip from '../components/InfoTooltip.jsx';
import useLocalStorage from '../hooks/useLocalStorage.js';
import AnimatedSection from '../components/AnimatedSection.jsx';
import { analyzeBurnout } from '../services/api.js';
import { calculateBurnoutRiskScore, classifyBurnoutLevel } from '../utils/burnoutModel.js';
import { isValidPastOrPresentDate } from '../utils/dateUtils.js';

const BurnoutTracker = () => {
  const navigate = useNavigate();
  const [history, setHistory, historyError] = useLocalStorage('saf_burnout_history', []);
  const [aiCache, setAiCache] = useLocalStorage('saf_burnout_ai_insight', null);
  const [formValues, setFormValues] = useState({
    sleep: null,
    stress: null,
    energy: null,
    social: null,
    enjoyment: null
  });
  const [errors, setErrors] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiInsight, setAiInsight] = useState(null);
  const [completedTips, setCompletedTips] = useState([]);

  const currentWeek = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().slice(0, 10);
  }, []);

  const latestEntry = Array.isArray(history)
    ? history.find((entry) => isValidPastOrPresentDate(entry.createdAt || entry.weekStart)) || history[0]
    : null;

  const persistHistory = (updated) => {
    const safeUpdated = Array.isArray(updated) ? updated : [];
    setHistory(safeUpdated);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('saf_burnout_history', JSON.stringify(safeUpdated));
      }
    } catch (error) {
      // rely on useLocalStorage error handling
    }
  };

  const updateLatestInterventionProgress = (updater) => {
    if (!latestEntry || !Array.isArray(history)) return;
    const updated = history.map((entry, index) => {
      if (index !== 0 || entry.createdAt !== latestEntry.createdAt) return entry;
      const existing = entry.interventionProgress || {
        deterministicCompleted: [],
        aiCompleted: [],
        aiSuggestions: []
      };
      return {
        ...entry,
        interventionProgress: updater(existing)
      };
    });
    persistHistory(updated);
  };

  const updateValue = (key, value) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setErrors('');
  };

  useEffect(() => {
    const runAnalysis = async () => {
      if (!latestEntry) {
        setAiInsight(null);
        return;
      }
      setAiLoading(true);
      setAiError('');
      try {
        // If we already have an insight for this exact latest check-in, reuse it.
        if (aiCache && aiCache.latestCreatedAt === latestEntry.createdAt && aiCache.data) {
          setAiInsight(aiCache.data);
          setAiLoading(false);
          return;
        }

        const safeHistory = Array.isArray(history) ? history : [];

        const recentHistory = safeHistory.slice(0, 8).map((entry) => ({
          sleep: entry.sleep,
          stress: entry.stress,
          energy: entry.energy,
          social_connection: entry.social,
          enjoyment: entry.enjoyment,
          week_start: entry.weekStart,
          created_at: entry.createdAt,
          risk_score: calculateBurnoutRiskScore(entry)
        }));

        const payload = {
          sleep: latestEntry.sleep,
          stress: latestEntry.stress,
          energy: latestEntry.energy,
          social_connection: latestEntry.social,
          enjoyment: latestEntry.enjoyment,
          risk_score: calculateBurnoutRiskScore(latestEntry),
          recent_history: recentHistory
        };

        const data = await analyzeBurnout(payload);
        setAiInsight(data);
        setAiCache({ latestCreatedAt: latestEntry.createdAt, data });
      } catch (error) {
        setAiInsight(null);
        setAiError('AI insights are temporarily unavailable. Showing standard result only.');
      } finally {
        setAiLoading(false);
      }
    };

    runAnalysis();
  }, [history, latestEntry, aiCache, setAiCache]);

  useEffect(() => {
    if (!latestEntry || !aiInsight || !Array.isArray(aiInsight.micro_interventions)) return;

    const existingSuggestions =
      latestEntry.interventionProgress &&
      Array.isArray(latestEntry.interventionProgress.aiSuggestions)
        ? latestEntry.interventionProgress.aiSuggestions
        : [];

    const nextSuggestions = aiInsight.micro_interventions;

    const areSameLength = existingSuggestions.length === nextSuggestions.length;
    const areSameContent =
      areSameLength &&
      existingSuggestions.every((item, index) => item === nextSuggestions[index]);

    if (areSameContent) return;

    updateLatestInterventionProgress((progress) => ({
      ...progress,
      aiSuggestions: nextSuggestions
    }));
  }, [latestEntry, aiInsight]);

  useEffect(() => {
    const storedCompleted =
      latestEntry?.interventionProgress?.aiCompleted &&
      Array.isArray(latestEntry.interventionProgress.aiCompleted)
        ? latestEntry.interventionProgress.aiCompleted
        : [];
    setCompletedTips(storedCompleted);
  }, [latestEntry?.createdAt]);

  const handleSubmit = () => {
    const values = Object.values(formValues);
    if (values.some((value) => value === null)) {
      setErrors('Please rate all five dimensions before saving.');
      return;
    }
    const entry = {
      weekStart: currentWeek,
      createdAt: new Date().toISOString(),
      ...formValues,
      result: computeBurnoutResult({ ...formValues }),
      interventionProgress: {
        deterministicCompleted: [],
        aiCompleted: [],
        aiSuggestions: []
      }
    };
    const baseHistory = Array.isArray(history) ? history : [];
    const updated = [entry, ...baseHistory];
    persistHistory(updated);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1800);
    setFormValues({ sleep: null, stress: null, energy: null, social: null, enjoyment: null });
  };

  const ratingOptions = [1, 2, 3, 4, 5];

  const computeBurnoutResult = (entry) => {
    if (!entry) return null;
    const riskScore = calculateBurnoutRiskScore(entry);
    if (riskScore == null) return null;

    const level = classifyBurnoutLevel(riskScore);

    const copy = {
      Low: {
        explanation: 'You appear well-balanced this week. Keep steady routines and protect recovery time.',
        interventions: ['Keep a consistent sleep schedule', 'Plan one energizing activity', 'Maintain light movement']
      },
      Moderate: {
        explanation: 'You may be building some strain. Consider lighter workouts and more recovery breaks.',
        interventions: ['Swap one workout for mobility', 'Add a 10-minute walk', 'Block a restful evening']
      },
      High: {
        explanation: 'Your signals suggest elevated strain. Prioritize rest and low-intensity sessions.',
        interventions: ['Reduce workout intensity by 20%', 'Aim for early bedtime', 'Schedule a social check-in']
      },
      Critical: {
        explanation: 'You are showing high strain. Focus on recovery and gentle movement only.',
        interventions: ['Take a full rest day', 'Hydrate and eat regularly', 'Ask for support if needed']
      }
    };

    return {
      level,
      riskScore,
      maxScore: 25,
      explanation: copy[level].explanation,
      interventions: copy[level].interventions
    };
  };

  return (
    <>
      {historyError && (
        <div className="mb-4 rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-700">
          {historyError}
        </div>
      )}
      <div className="space-y-6">
      <AnimatedSection>
      <div className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
        <span>Need to update your profile details?</span>
        <Link to="/" className="font-semibold text-indigo-600 hover:text-indigo-500">
          Edit onboarding
        </Link>
      </div>
      </AnimatedSection>
      <AnimatedSection>
      <div className="flex justify-end text-xs text-slate-500">
        <InfoTooltip
          label="Burnout tracker help"
          message="Use this 1–5 check-in once a week so the app can estimate your burnout level and suggest gentle next steps."
        />
      </div>
      <Card title="Weekly Burnout Check-In">
        <form className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { key: 'sleep', label: 'Sleep quality', helper: '1 = poor sleep, 5 = deeply rested' },
              { key: 'stress', label: 'Stress level', helper: '1 = calm, 5 = overwhelmed' },
              { key: 'energy', label: 'Energy level', helper: '1 = drained, 5 = energized' },
              { key: 'social', label: 'Social connection', helper: '1 = isolated, 5 = supported' },
              { key: 'enjoyment', label: 'Daily enjoyment', helper: '1 = low joy, 5 = very joyful' }
            ].map((item) => (
              <div
                key={item.key}
                className="rounded-2xl border border-slate-100 bg-white/80 p-3 shadow-sm space-y-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{item.helper}</p>
                </div>
                <div className="flex items-center justify-between gap-1">
                  {ratingOptions.map((value) => {
                    const isActive = formValues[item.key] === value;
                    const colorClasses = 'border-indigo-600 bg-indigo-600 text-white';

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateValue(item.key, value)}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-transform transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-1 focus:ring-offset-slate-50 ${
                          isActive
                            ? `${colorClasses} scale-105 shadow-sm`
                            : `border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-slate-800`
                        }`}
                        aria-pressed={isActive}
                        aria-label={`${item.label} rating ${value}`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {errors && <p className="text-sm text-rose-500">{errors}</p>}
          <Button type="button" onClick={handleSubmit}>
            Save check-in
          </Button>
        </form>
      </Card>
      </AnimatedSection>
      <AnimatedSection>
      <Card title="Latest Result">
        {latestEntry ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Week of</p>
                <p className="text-sm font-semibold text-slate-800">{latestEntry.weekStart}</p>
              </div>
              <p className="text-xs text-slate-400">
                Saved on {new Date(latestEntry.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sleep</span>
                <span className="text-sm font-semibold text-slate-800">{latestEntry.sleep}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Stress</span>
                <span className="text-sm font-semibold text-slate-800">{latestEntry.stress}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Energy</span>
                <span className="text-sm font-semibold text-slate-800">{latestEntry.energy}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Social</span>
                <span className="text-sm font-semibold text-slate-800">{latestEntry.social}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Enjoyment</span>
                <span className="text-sm font-semibold text-slate-800">{latestEntry.enjoyment}</span>
              </span>
            </div>
            <BurnoutResultCard
              result={computeBurnoutResult(latestEntry)}
              completedInterventions={
                (latestEntry.interventionProgress &&
                  Array.isArray(latestEntry.interventionProgress.deterministicCompleted)
                  ? latestEntry.interventionProgress.deterministicCompleted
                  : [])
              }
              onToggleComplete={(label) => {
                updateLatestInterventionProgress((progress) => {
                  const existing = Array.isArray(progress.deterministicCompleted)
                    ? progress.deterministicCompleted
                    : [];
                  const isDone = existing.includes(label);
                  const updatedCompleted = isDone
                    ? existing.filter((item) => item !== label)
                    : [...existing, label];
                  return {
                    ...progress,
                    deterministicCompleted: updatedCompleted
                  };
                });
              }}
            />
            <p className="text-xs text-slate-500">
              The Workout Planner uses this <span className="font-semibold">latest burnout result</span> when
              generating new workout plans.
            </p>
          </div>
        ) : (
          <EmptyState
            title="No results yet"
            description="Submit a check-in to see your burnout score and micro-interventions."
          />
        )}
      </Card>
      </AnimatedSection>

      <AnimatedSection>
      <Card title="AI-Powered Insight">
        {!latestEntry ? (
          <EmptyState
            title="No check-ins yet"
            description="Once you save a check-in, an AI summary will appear here."
          />
        ) : aiLoading ? (
          <LoadingCard title="Analyzing your burnout trend" />
        ) : aiError ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {aiError}
          </div>
        ) : aiInsight ? (
          <div className="space-y-4 text-sm text-slate-700">
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-600/15 via-sky-100/40 to-transparent px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    AI insight based on your recent check-ins
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    Burnout: {aiInsight.burnout_level || 'Unknown'}
                    {aiInsight.trend_label ? ` · Trend: ${aiInsight.trend_label}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    A quick snapshot of how your week is trending.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 shadow-sm">
              <p className="text-[13px] leading-relaxed text-slate-700">{aiInsight.summary}</p>
            </div>

            {Array.isArray(aiInsight.micro_interventions) && aiInsight.micro_interventions.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Today’s gentle actions</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {completedTips.filter((label) =>
                      aiInsight.micro_interventions.includes(label)
                    ).length}
                    /{aiInsight.micro_interventions.length} marked for today
                  </span>
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-1">
                  {aiInsight.micro_interventions.map((item, index) => {
                    const isDone = completedTips.includes(item);
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setCompletedTips((prev) => {
                            const exists = prev.includes(item);
                            const next = exists
                              ? prev.filter((label) => label !== item)
                              : [...prev, item];
                            updateLatestInterventionProgress((progress) => ({
                              ...progress,
                              aiCompleted: next
                            }));
                            return next;
                          });
                        }}
                        className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-2 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-1 focus:ring-offset-slate-50 ${
                          isDone
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-white/90 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/40'
                        }`}
                      >
                        <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] font-semibold text-slate-500">
                          {index + 1}
                        </span>
                        <span className="flex-1 text-[13px] leading-relaxed">{item}</span>
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                            isDone
                              ? 'bg-emerald-500 text-white'
                              : 'bg-white text-slate-500 border border-slate-200'
                          }`}
                        >
                          {isDone ? '✓' : '+'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-slate-500">
              These suggestions are for general wellness only and are not medical advice.
            </p>
          </div>
        ) : (
          <div className="text-sm text-slate-600">
            <p>
              We will use your recent check-ins to summarize burnout trends and suggest gentle next steps.
            </p>
          </div>
        )}
      </Card>
      </AnimatedSection>
      </div>
      {toastVisible && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg"
          role="status"
          aria-live="polite"
        >
          Check-in saved. Updating your results…
        </div>
      )}
    </>
  );
};

export default BurnoutTracker;
