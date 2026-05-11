import { useEffect, useMemo, useState } from 'react';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import InfoTooltip from '../components/InfoTooltip.jsx';
import useLocalStorage from '../hooks/useLocalStorage.js';
import AnimatedSection from '../components/AnimatedSection.jsx';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { calculateBurnoutRiskScore, MAX_BURNOUT_SCORE } from '../utils/burnoutModel.js';
import { getEntryWeekKey, isValidPastOrPresentDate } from '../utils/dateUtils.js';
import { getDashboardPatternInsight } from '../services/api.js';

const burnoutLevelToScore = (level) => {
  if (!level) return null;
  switch (level) {
    case 'Low':
      return 1;
    case 'Moderate':
      return 2;
    case 'High':
      return 3;
    case 'Critical':
      return 4;
    default:
      return null;
  }
};

const scoreToBurnoutLevel = (score) => {
  if (score == null) return null;
  if (score < 1.5) return 'Low';
  if (score < 2.5) return 'Moderate';
  if (score < 3.5) return 'High';
  return 'Critical';
};

const getBurnoutTrendData = (burnoutHistory) => {
  const entries = Array.isArray(burnoutHistory) ? burnoutHistory : [];
  const validEntries = entries.filter((entry) => getEntryWeekKey(entry));
  return validEntries
    .slice()
    .reverse()
    .map((entry) => {
    const fallbackScore =
      entry.result?.score ?? burnoutLevelToScore(entry.result?.level) ?? burnoutLevelToScore(entry.derivedLevel);
    return {
      date: getEntryWeekKey(entry) || entry.weekStart || entry.createdAt?.slice(0, 10),
      level: entry.result?.level || entry.burnoutLevel || null,
      score: fallbackScore
    };
  });
};

const getWorkoutStats = (workoutHistory) => {
  const entries = Array.isArray(workoutHistory) ? workoutHistory : [];
  if (entries.length === 0) {
    return {
      total: 0,
      mostFrequentType: null,
      recoveryCount: 0,
      trainingCount: 0
    };
  }

  let recoveryCount = 0;
  let trainingCount = 0;

  const typeCounts = new Map();

  entries.forEach((entry) => {
    const mode = entry.adaptationMode || '';
    const isRecovery = /recovery/i.test(mode);
    const isReduced = /reduced/i.test(mode) || /lighter/i.test(mode);

    if (isRecovery) {
      recoveryCount += 1;
    } else if (isReduced) {
      trainingCount += 1;
    } else {
      trainingCount += 1;
    }

    const key = isRecovery ? 'Recovery' : isReduced ? 'Reduced-load' : 'Standard training';
    typeCounts.set(key, (typeCounts.get(key) || 0) + 1);
  });

  let mostFrequentType = null;
  let maxCount = 0;
  typeCounts.forEach((count, key) => {
    if (count > maxCount) {
      mostFrequentType = key;
      maxCount = count;
    }
  });

  return {
    total: entries.length,
    mostFrequentType,
    recoveryCount,
    trainingCount
  };
};

const getWorkoutDistribution = (workoutHistory) => {
  const { recoveryCount, trainingCount } = getWorkoutStats(workoutHistory);
  if (recoveryCount === 0 && trainingCount === 0) return [];
  return [
    { name: 'Training', value: trainingCount },
    { name: 'Recovery', value: recoveryCount }
  ];
};

const getInterventionCompletionSummary = (burnoutHistory) => {
  if (!Array.isArray(burnoutHistory) || burnoutHistory.length === 0) return '';

  const recent = burnoutHistory.slice(0, 5);
  let totalSuggested = 0;
  let totalCompleted = 0;

  recent.forEach((entry) => {
    const deterministic = Array.isArray(entry.result?.interventions)
      ? entry.result.interventions
      : [];
    const detCompletedLabels = Array.isArray(
      entry.interventionProgress?.deterministicCompleted
    )
      ? entry.interventionProgress.deterministicCompleted
      : [];
    const detCompletedCount = deterministic.filter((label) =>
      detCompletedLabels.includes(label)
    ).length;

    const aiSuggestions = Array.isArray(entry.interventionProgress?.aiSuggestions)
      ? entry.interventionProgress.aiSuggestions
      : [];
    const aiCompletedLabels = Array.isArray(entry.interventionProgress?.aiCompleted)
      ? entry.interventionProgress.aiCompleted
      : [];
    const aiCompletedCount = aiSuggestions.filter((label) =>
      aiCompletedLabels.includes(label)
    ).length;

    totalSuggested += deterministic.length + aiSuggestions.length;
    totalCompleted += detCompletedCount + aiCompletedCount;
  });

  if (!totalSuggested) return '';
  const percent = Math.round((totalCompleted / totalSuggested) * 100);
  return `You’ve completed ${totalCompleted} of your last ${totalSuggested} suggested actions (${percent}% follow-through).`;
};

const getBurnoutTrendDirection = (trendData) => {
  const scores = trendData.map((d) => d.score).filter((v) => v != null);
  if (scores.length < 2) return 'stable';
  const first = scores[0];
  const last = scores[scores.length - 1];
  const delta = last - first;
  if (delta > 0.3) return 'up';
  if (delta < -0.3) return 'down';
  return 'stable';
};
const getRecoveryTrainingRatio = (workoutStats) => {
  const { recoveryCount, trainingCount, total } = workoutStats;
  if (!total) {
    return {
      bias: 'none',
      recoveryCount: 0,
      trainingCount: 0
    };
  }

  if (trainingCount >= recoveryCount * 2 && trainingCount >= 3) {
    return { bias: 'training', recoveryCount, trainingCount };
  }
  if (recoveryCount >= trainingCount * 2 && recoveryCount >= 2) {
    return { bias: 'recovery', recoveryCount, trainingCount };
  }
  return { bias: 'balanced', recoveryCount, trainingCount };
};

const generateInsightSummary = ({ burnoutTrendDirection, workoutStats, burnoutTrendData }) => {
  const levelNow = scoreToBurnoutLevel(
    burnoutTrendData.length ? burnoutTrendData[burnoutTrendData.length - 1].score : null
  );
  const levelStart = scoreToBurnoutLevel(
    burnoutTrendData.length ? burnoutTrendData[0].score : null
  );
  const { total, recoveryCount, trainingCount } = workoutStats;
  const ratio = getRecoveryTrainingRatio(workoutStats);

  if (total === 0 && !levelNow) {
    return 'Once you log a few check-ins and workouts, this dashboard will summarize how your burnout and workouts influence each other.';
  }

  if (burnoutTrendDirection === 'down' && levelStart && levelNow && levelStart !== levelNow) {
    return `Your burnout moved from ${levelStart.toLowerCase()} to ${levelNow.toLowerCase()} while you completed ${total} sessions (${trainingCount} training, ${recoveryCount} recovery) — your recent recovery seems to be helping.`;
  }

  if (burnoutTrendDirection === 'up' && levelStart && levelNow && levelStart !== levelNow) {
    return `Your burnout has climbed from ${levelStart.toLowerCase()} to ${levelNow.toLowerCase()} with ${trainingCount} training and ${recoveryCount} recovery sessions logged — consider easing volume this week.`;
  }

  if (ratio.bias === 'training') {
    return `You currently lean heavily toward training (${trainingCount} training vs ${recoveryCount} recovery sessions), which may increase fatigue if burnout keeps rising.`;
  }

  if (ratio.bias === 'recovery') {
    return `You have leaned into recovery lately (${recoveryCount} recovery vs ${trainingCount} training sessions), which can be helpful when burnout feels higher.`;
  }

  if (total >= 3 && burnoutTrendDirection === 'stable') {
    return `Your burnout has stayed fairly stable across recent check-ins while you completed ${total} sessions — a good sign that your current mix of training and recovery is sustainable.`;
  }

  if (levelNow === 'High' || levelNow === 'Critical') {
    return 'Recent check-ins show elevated burnout. Prioritize low-intensity movement, sleep, and recovery before adding more heavy training.';
  }

  return 'Your training and burnout look reasonably balanced so far. Keep noticing how different weeks feel and nudge duration or intensity up or down as needed.';
};

const generateRecommendation = ({ burnoutTrendDirection, workoutStats, avgBurnoutLevel }) => {
  const { total, recoveryCount, trainingCount } = workoutStats;
  const ratio = getRecoveryTrainingRatio(workoutStats);

  if (!total && !avgBurnoutLevel) {
    return 'Start by logging a weekly burnout check-in and generating 1–2 workouts so we can tailor recommendations to you.';
  }

  if ((avgBurnoutLevel === 'High' || avgBurnoutLevel === 'Critical') && burnoutTrendDirection === 'up') {
    return 'Shift this week toward recovery: add 1–2 dedicated recovery sessions, shorten training days, and pause new intensity increases.';
  }

  if (burnoutTrendDirection === 'up' && ratio.bias === 'training') {
    return 'Add at least one recovery-focused session and keep training sessions a bit shorter until burnout levels flatten or drop.';
  }

  if (burnoutTrendDirection === 'down' && total >= 2) {
    return 'Keep your current pattern of training and recovery — burnout is easing, so maintain this mix rather than ramping volume too quickly.';
  }

  if (ratio.bias === 'recovery' && (avgBurnoutLevel === 'Low' || avgBurnoutLevel === 'Moderate')) {
    return 'If you feel ready and burnout is low-to-moderate, you can gently reintroduce a bit more structured training while keeping at least one recovery day.';
  }

  return 'Continue with your current plan while checking in weekly. Adjust duration or intensity by small amounts if burnout or energy noticeably shift.';
};

const BURNOUT_COLORS = {
  Low: '#22c55e',
  Moderate: '#eab308',
  High: '#f97316',
  Critical: '#ef4444'
};

const renderBurnoutDot = (props) => {
  const { cx, cy, payload } = props;
  const level = scoreToBurnoutLevel(payload.score);
  const fill = BURNOUT_COLORS[level] || '#4f46e5';
  return <circle cx={cx} cy={cy} r={3} fill={fill} stroke="#ffffff" strokeWidth={1} />;
};

const Dashboard = () => {
  const [burnoutHistory] = useLocalStorage('saf_burnout_history', []);
  const [workoutHistory] = useLocalStorage('saf_workout_history', []);
  const [aiPattern, setAiPattern] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [actionAcknowledged, setActionAcknowledged] = useState(false);

  const burnoutTrendData = useMemo(() => getBurnoutTrendData(burnoutHistory), [burnoutHistory]);
  const workoutStats = useMemo(() => getWorkoutStats(workoutHistory), [workoutHistory]);
  const workoutDistribution = useMemo(
    () => getWorkoutDistribution(workoutHistory),
    [workoutHistory]
  );
  const burnoutTrendDirection = useMemo(
    () => getBurnoutTrendDirection(burnoutTrendData),
    [burnoutTrendData]
  );

  const avgBurnoutScore = useMemo(() => {
    const scores = burnoutTrendData
      .map((d) => d.score)
      .filter((v) => v != null)
      .slice(-7);
    if (!scores.length) return null;
    const sum = scores.reduce((acc, v) => acc + v, 0);
    return sum / scores.length;
  }, [burnoutTrendData]);

  const avgBurnoutLevel = scoreToBurnoutLevel(avgBurnoutScore);

  const latestRiskScore = useMemo(
    () => (Array.isArray(burnoutHistory) && burnoutHistory[0] ? calculateBurnoutRiskScore(burnoutHistory[0]) : null),
    [burnoutHistory]
  );

  const insightSummary = useMemo(
    () => generateInsightSummary({ burnoutTrendDirection, workoutStats, burnoutTrendData }),
    [burnoutTrendDirection, workoutStats, burnoutTrendData]
  );

  const recommendation = useMemo(
    () => generateRecommendation({ burnoutTrendDirection, workoutStats, avgBurnoutLevel }),
    [burnoutTrendDirection, workoutStats, avgBurnoutLevel]
  );

  const burnoutChartSummary = useMemo(() => {
    if (!burnoutTrendData.length) return '';
    const firstLevel = scoreToBurnoutLevel(burnoutTrendData[0].score);
    const lastLevel = scoreToBurnoutLevel(burnoutTrendData[burnoutTrendData.length - 1].score);
    if (!firstLevel || !lastLevel) return '';
    if (burnoutTrendDirection === 'up' && firstLevel !== lastLevel) {
      return `Burnout increased from ${firstLevel.toLowerCase()} to ${lastLevel.toLowerCase()} over recent check-ins.`;
    }
    if (burnoutTrendDirection === 'down' && firstLevel !== lastLevel) {
      return `Burnout decreased from ${firstLevel.toLowerCase()} to ${lastLevel.toLowerCase()} over recent check-ins.`;
    }
    return 'Burnout has stayed relatively stable across recent check-ins.';
  }, [burnoutTrendData, burnoutTrendDirection]);

  const totalSessions = workoutStats.total;
  const ratioText = totalSessions
    ? `${workoutStats.recoveryCount} recovery · ${workoutStats.trainingCount} training`
    : 'No sessions yet';

  const mostFrequentType = workoutStats.mostFrequentType || 'Not enough data yet';

  const workoutChartSummary = useMemo(() => {
    if (!totalSessions) return '';
    const ratio = getRecoveryTrainingRatio(workoutStats);
    if (ratio.bias === 'training') {
      return `Most sessions are training-focused so far (${ratio.trainingCount} training vs ${ratio.recoveryCount} recovery).`;
    }
    if (ratio.bias === 'recovery') {
      return `You have leaned into recovery lately (${ratio.recoveryCount} recovery vs ${ratio.trainingCount} training).`;
    }
    return `Training and recovery sessions are fairly balanced (${ratio.trainingCount} training and ${ratio.recoveryCount} recovery).`;
  }, [totalSessions, workoutStats]);

  const interventionCompletionSummary = useMemo(
    () => getInterventionCompletionSummary(burnoutHistory),
    [burnoutHistory]
  );

  useEffect(() => {
    if (!burnoutTrendData.length && !totalSessions) {
      setAiPattern(null);
      setAiError('');
      return;
    }

    let isCancelled = false;
    const run = async () => {
      setAiLoading(true);
      setAiError('');
      try {
        const recentScores = burnoutTrendData
          .map((d) => d.score)
          .filter((v) => v != null)
          .slice(-6);
        const recentLevels = burnoutTrendData
          .map((d) => scoreToBurnoutLevel(d.score))
          .filter((v) => v != null)
          .slice(-6);

        const durations = Array.isArray(workoutHistory)
          ? workoutHistory
              .map((w) => (w.adjustedDurationMinutes || w.duration))
              .filter((v) => typeof v === 'number')
          : [];
        const avgDuration = durations.length
          ? durations.reduce((acc, v) => acc + v, 0) / durations.length
          : null;

        const types = Array.isArray(workoutHistory)
          ? workoutHistory
              .map((w) => (w.adaptationMode || '').trim())
              .filter(Boolean)
              .slice(-6)
          : [];

        const ratio = getRecoveryTrainingRatio(workoutStats);

        const payload = {
          recent_burnout_scores: recentScores,
          recent_burnout_levels: recentLevels,
          burnout_trend_direction: burnoutTrendDirection,
          workouts_total: workoutStats.total,
          workouts_training: ratio.trainingCount,
          workouts_recovery: ratio.recoveryCount,
          avg_session_duration_minutes: avgDuration,
          common_session_types: types
        };

        const data = await getDashboardPatternInsight(payload);
        if (!isCancelled) {
          setAiPattern(data);
        }
      } catch (error) {
        if (!isCancelled) {
          setAiPattern(null);
          setAiError('AI pattern insight is temporarily unavailable.');
        }
      } finally {
        if (!isCancelled) {
          setAiLoading(false);
        }
      }
    };

    run();

    return () => {
      isCancelled = true;
    };
  }, [burnoutTrendData, workoutStats, workoutHistory, burnoutTrendDirection, totalSessions]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end text-xs text-slate-500">
        <InfoTooltip
          label="Dashboard help"
          message="These charts show how your burnout level and workouts change over time so you can notice patterns, not judge single days."
        />
      </div>
      <AnimatedSection>
      <Card title="Dashboard Overview">
        {(!burnoutTrendData.length && !totalSessions) ? (
          <EmptyState
            title="No data yet"
            description="Log a few burnout check-ins and generate workouts to unlock your dashboard insights."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-3 text-sm shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Avg burnout (recent)
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {avgBurnoutLevel || '—'}
              </p>
              {avgBurnoutLevel && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Based on your last few check-ins.
                </p>
              )}
              {typeof latestRiskScore === 'number' && (
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  Score: {Math.round(latestRiskScore)}/{MAX_BURNOUT_SCORE}
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-3 text-sm shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Workouts generated
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{totalSessions}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-3 text-sm shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Most frequent session type
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{mostFrequentType}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-3 text-sm shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recovery vs training
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{ratioText}</p>
            </div>
          </div>
        )}
      </Card>
      </AnimatedSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnimatedSection>
        <Card title="Burnout trend">
          {!burnoutTrendData.length ? (
            <EmptyState
              title="No burnout data"
              description="Complete at least one burnout check-in to see your trend."
            />
          ) : (
            <div className="space-y-3">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={burnoutTrendData}
                    margin={{ top: 16, right: 16, left: 0, bottom: 16 }}
                  >
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(score) => scoreToBurnoutLevel(score) || ''}
                      domain={[0.8, 4.2]}
                      allowDataOverflow
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(value) => scoreToBurnoutLevel(value) || value}
                      labelFormatter={(label) => `Week of ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#4f46e5"
                      strokeWidth={2}
                      dot={renderBurnoutDot}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                {['Low', 'Moderate', 'High', 'Critical'].map((level) => (
                  <span
                    key={level}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: BURNOUT_COLORS[level] }}
                    />
                    <span>{level}</span>
                  </span>
                ))}
              </div>
              {burnoutChartSummary && (
                <p className="text-[11px] text-slate-500">{burnoutChartSummary}</p>
              )}
            </div>
          )}
        </Card>
        </AnimatedSection>

        <AnimatedSection>
        <Card title="Workout activity">
          {!workoutDistribution.length ? (
            <EmptyState
              title="No workout data"
              description="Generate at least one workout plan to see activity here."
            />
          ) : (
            <div className="space-y-3">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={workoutDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    labelLine={false}
                    label={(entry) => `${entry.name}`}
                  >
                    {workoutDistribution.map((entry, index) => (
                      <Cell
                        // eslint-disable-next-line react/no-array-index-key
                        key={`cell-${index}`}
                        fill={entry.name === 'Recovery' ? '#22c55e' : '#6366f1'}
                      />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={24} />
                </PieChart>
              </ResponsiveContainer>
              </div>
              {workoutChartSummary && (
                <p className="text-[11px] text-slate-500">{workoutChartSummary}</p>
              )}
            </div>
          )}
        </Card>
        </AnimatedSection>
      </div>

      <AnimatedSection>
      <Card title="Insight summary">
        <div className="group flex items-start gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/80 px-4 py-4 text-sm text-indigo-950 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600/90 text-white shadow-sm">
            <span className="text-base font-semibold">i</span>
          </div>
          <div className="space-y-1">
            <p className="font-medium leading-snug">
              {insightSummary}
            </p>
            <div className="flex flex-wrap gap-1.5 text-[11px] text-indigo-700/80">
              {burnoutTrendDirection && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100/80 px-2 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  <span className="capitalize">Trend: {burnoutTrendDirection}</span>
                </span>
              )}
              {totalSessions > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100/60 px-2 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{ratioText}</span>
                </span>
              )}
            </div>
            {interventionCompletionSummary && (
              <p className="mt-1 text-[11px] text-slate-500">
                {interventionCompletionSummary}
              </p>
            )}
          </div>
        </div>
      </Card>
      </AnimatedSection>

      <AnimatedSection>
      <Card title="Recommended action">
        <div className="group flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-4 text-sm text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
              <span className="text-base font-semibold">✓</span>
            </div>
            <p className="leading-snug">{recommendation}</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-500">
              Pick this as your focus for the coming week.
            </span>
            <button
              type="button"
              onClick={() => setActionAcknowledged((prev) => !prev)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
                actionAcknowledged
                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {actionAcknowledged ? 'Marked for this week' : 'I will focus on this'}
            </button>
          </div>
        </div>
      </Card>
      </AnimatedSection>

      <AnimatedSection>
      <Card title="AI Pattern Insight">
        {aiLoading ? (
          <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-500" />
              <span>Analyzing your recent burnout and workout pattern…</span>
            </div>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
              AI
            </span>
          </div>
        ) : aiError ? (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-amber-400" />
            <p>{aiError}</p>
          </div>
        ) : aiPattern ? (
          <div className="space-y-3 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50/80 via-white to-indigo-50/80 px-4 py-4 text-sm text-slate-900 shadow-sm">
            <p className="text-sm leading-snug text-slate-900">{aiPattern.pattern_summary}</p>
            <div className="rounded-xl bg-violet-600/10 px-3 py-2 text-xs font-semibold text-violet-900">
              {aiPattern.recommendation}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-slate-300" />
            <p>
              Once you have a few check-ins and workouts, an AI summary of how your burnout and
              training patterns interact will appear here.
            </p>
          </div>
        )}
      </Card>
      </AnimatedSection>
    </div>
  );
};

export default Dashboard;
