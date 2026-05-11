import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import Card from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import EmptyState from '../components/EmptyState.jsx';
import AnimatedSection from '../components/AnimatedSection.jsx';
import useLocalStorage from '../hooks/useLocalStorage.js';
import { getBurnoutState } from '../utils/burnoutModel.js';
import { generateAdaptiveWorkoutPlan } from '../utils/adaptiveWorkout.js';
import { generateWorkout } from '../services/api.js';

const WorkoutPlanner = () => {
  const emptyOnboarding = {
    name: '',
    fitnessLevel: '',
    weeklyGoal: '',
    equipment: ''
  };
  const [onboarding, , onboardingError] = useLocalStorage('saf_onboarding', emptyOnboarding);
  const [burnoutHistory, , historyError] = useLocalStorage('saf_burnout_history', []);
  const [workoutHistory, setWorkoutHistory] = useLocalStorage('saf_workout_history', []);
  const [savedPlan, setSavedPlan] = useLocalStorage('saf_latest_workout_plan', null);

  const [formValues, setFormValues] = useState({
    muscleGroup: '',
    duration: '',
    difficulty: 'Moderate',
    equipment: ''
  });
  const [errors, setErrors] = useState('');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(savedPlan || null);
  const [toastVisible, setToastVisible] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [debugBurnoutLevel, setDebugBurnoutLevel] = useState('');
  const [activeExerciseId, setActiveExerciseId] = useState(null);
  const [completedExerciseIds, setCompletedExerciseIds] = useState([]);
  const [skippedExerciseIds, setSkippedExerciseIds] = useState([]);
  const [showWhyPlan, setShowWhyPlan] = useState(false);

  const onboardingMissing =
    !onboarding ||
    !onboarding.name ||
    !onboarding.fitnessLevel ||
    !onboarding.weeklyGoal;

  const burnoutState = useMemo(() => getBurnoutState(burnoutHistory), [burnoutHistory]);

  const displayBurnoutLevel = debugBurnoutLevel || burnoutState.level;
  const usedPlanBurnoutLevel = plan?.burnoutLevelUsed || burnoutState.level;

  const flattenedExercises = useMemo(() => {
    if (!plan || !Array.isArray(plan.sections)) return [];
    const result = [];
    plan.sections.forEach((section, sectionIndex) => {
      (section.exercises || []).forEach((_, exerciseIndex) => {
        result.push({
          sectionIndex,
          exerciseIndex,
          id: `${sectionIndex}-${exerciseIndex}`
        });
      });
    });
    return result;
  }, [plan]);

  const adaptationModeByLevel = {
    Low: 'Standard training',
    Moderate: 'Lighter training',
    High: 'Reduced-load session',
    Critical: 'Recovery session'
  };

  const computeAdaptationMode = (level) =>
    adaptationModeByLevel[level] || 'Standard training';

  const getHeaderGradientClasses = (level) => {
    if (level === 'High' || level === 'Critical') {
      return 'from-amber-200/70 via-rose-50/80 to-transparent';
    }
    if (level === 'Moderate') {
      return 'from-indigo-500/15 via-sky-100/60 to-transparent';
    }
    return 'from-emerald-500/20 via-cyan-100/50 to-transparent';
  };

  const getBurnoutAccent = (level) => {
    switch (level) {
      case 'Low':
        return {
          border: 'border-emerald-200',
          badge: 'border-emerald-200 bg-emerald-50 text-emerald-800',
          dot: 'bg-emerald-500'
        };
      case 'Moderate':
        return {
          border: 'border-amber-200',
          badge: 'border-amber-200 bg-amber-50 text-amber-800',
          dot: 'bg-amber-500'
        };
      case 'High':
        return {
          border: 'border-orange-200',
          badge: 'border-orange-200 bg-orange-50 text-orange-800',
          dot: 'bg-orange-500'
        };
      case 'Critical':
        return {
          border: 'border-rose-200',
          badge: 'border-rose-200 bg-rose-50 text-rose-800',
          dot: 'bg-rose-500'
        };
      default:
        return {
          border: 'border-slate-200',
          badge: 'border-slate-200 bg-slate-50 text-slate-700',
          dot: 'bg-slate-400'
        };
    }
  };

  const handleChange = (field) => (event) => {
    setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors('');
  };

  const validate = () => {
    if (!formValues.muscleGroup.trim() || !formValues.duration || !formValues.equipment.trim()) {
      setErrors('Please complete all required fields before generating a plan.');
      return false;
    }

    const equipmentItems = formValues.equipment
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    if (equipmentItems.length === 0) {
      setErrors('Please list at least one equipment option.');
      return false;
    }

    if (onboardingMissing) {
      setErrors('Complete onboarding first so we can personalize your plan.');
      return false;
    }

    return true;
  };

  const handleGenerate = async () => {
    if (!validate()) return;
    setLoading(true);
    setPlan(null);

    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1600);

    const createdAt = new Date().toISOString();

    // Deterministic guardrail plan
    const effectiveLevel = debugBurnoutLevel || burnoutState.level;

    const burnoutForPlan = {
      ...burnoutState,
      level: effectiveLevel
    };

    const { plan: basePlan, adaptation } = generateAdaptiveWorkoutPlan({
      inputs: formValues,
      burnoutState: burnoutForPlan
    });

    let finalPlan = {
      ...basePlan,
      createdAt,
      burnoutLevelUsed: adaptation.burnoutLevelUsed,
      adaptationMode: adaptation.mode,
      adaptationMessage: adaptation.message,
      source: 'deterministic'
    };

    try {
      const payload = {
        muscle_group: formValues.muscleGroup,
        duration_minutes: Number(formValues.duration),
        difficulty: formValues.difficulty,
        equipment: formValues.equipment,
        burnout_state: {
          level: burnoutState.level,
          trend_label: burnoutState.trendLabel,
          score: burnoutState.score ?? burnoutState.latestScore ?? null
        },
        override_burnout_level: effectiveLevel,
        onboarding: onboarding || null,
        base_plan: basePlan
      };

      if (import.meta.env.DEV) {
        // Temporary debug logging to verify burnout flow.
        console.log('[WorkoutPlanner] generateWorkout payload', {
          debugBurnoutLevel,
          burnoutStateLevel: burnoutState.level,
          effectiveLevel,
          payloadBurnoutStateLevel: payload.burnout_state.level,
          override_burnout_level: payload.override_burnout_level
        });
      }

      const data = await generateWorkout(payload);
      if (data && data.plan && Array.isArray(data.plan.sections)) {
        const aiPlan = data.plan;
        const usedLevel = data.used_burnout_level || adaptation.burnoutLevelUsed;
        const adaptationMode = computeAdaptationMode(usedLevel);

        // Flatten AI exercises so we can overlay names/notes on deterministic structure.
        const aiExercisesFlat = [];
        aiPlan.sections.forEach((section) => {
          (section.exercises || []).forEach((exercise) => {
            aiExercisesFlat.push(exercise);
          });
        });

        let aiIndex = 0;
        const mergedSections = basePlan.sections.map((section) => ({
          sectionTitle: section.sectionTitle,
          exercises: section.exercises.map((exercise) => {
            const aiExercise = aiExercisesFlat[aiIndex] || null;
            if (aiExercise) aiIndex += 1;

            return {
              name: (aiExercise && aiExercise.name) || exercise.name,
              sets: exercise.sets,
              reps: exercise.reps,
              rest: exercise.rest,
              notes: (aiExercise && aiExercise.notes) || exercise.notes || aiPlan.adaptation_reason,
              intent: exercise.intent || (aiExercise && aiExercise.intent) || undefined
            };
          })
        }));

        finalPlan = {
          title: aiPlan.title || basePlan.title,
          duration: basePlan.duration,
          equipment: formValues.equipment,
          burnoutLevelUsed: usedLevel,
          adaptationMode,
          adaptationMessage: aiPlan.adaptation_reason || adaptation.message,
          createdAt,
          source: data.source || 'ai',
          sections: mergedSections
        };

        if (import.meta.env.DEV) {
          console.log('[WorkoutPlanner] workout result', {
            backendUsedLevel: data.used_burnout_level,
            finalPlanBurnoutLevel: finalPlan.burnoutLevelUsed
          });
        }
      }
    } catch {
      // Swallow AI errors; finalPlan remains deterministic
    }

    setPlan(finalPlan);
    setSavedPlan(finalPlan);

    setExpandedIndex(null);
    setCompletedExerciseIds([]);
    setSkippedExerciseIds([]);
    setActiveExerciseId(null);
    setShowWhyPlan(false);

    const totalExercises = finalPlan.sections?.reduce(
      (count, section) => count + (section.exercises?.length || 0),
      0
    ) || 0;

    const adjustedDurationMinutes = Number.parseInt(String(finalPlan.duration), 10) || 0;

    const historyEntry = {
      createdAt,
      title: finalPlan.title,
      status: 'Not started',
      muscleGroup: formValues.muscleGroup,
      duration: Number(formValues.duration),
      difficulty: formValues.difficulty,
      equipment: formValues.equipment,
      burnoutLevelUsed: finalPlan.burnoutLevelUsed,
      adaptationMode: finalPlan.adaptationMode,
      adaptationMessage: finalPlan.adaptationMessage,
      adjustedDurationMinutes,
      exerciseCount: totalExercises,
      workoutInputs: { ...formValues },
      burnoutState: burnoutState,
      plan: finalPlan
    };

    const safeHistory = Array.isArray(workoutHistory) ? workoutHistory : [];
    const updatedHistory = [historyEntry, ...safeHistory];
    setWorkoutHistory(updatedHistory);

    try {
      localStorage.setItem('saf_workout_history', JSON.stringify(updatedHistory));
    } catch {
      // ignore storage failures; useLocalStorage will surface an error banner
    }

    setLoading(false);
  };

  return (
    <>
      {(onboardingError || historyError) && (
        <div className="mb-4 rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-700">
          {onboardingError || historyError}
        </div>
      )}
      <div className="space-y-6">
        <div className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
          <span>Want to adjust your onboarding info?</span>
          <Link to="/" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Edit onboarding
          </Link>
        </div>

        {onboardingMissing && (
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-700">
            Complete onboarding to unlock a personalized workout plan.
          </div>
        )}

        <AnimatedSection>
        <Card title="Adaptive Workout Planner">
          <form className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Muscle group
              <input
                type="text"
                value={formValues.muscleGroup}
                onChange={handleChange('muscleGroup')}
                placeholder="Upper body, core, lower body…"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Duration (minutes)
              <input
                type="number"
                min="10"
                value={formValues.duration}
                onChange={handleChange('duration')}
                placeholder="30"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Difficulty
              <select
                value={formValues.difficulty}
                onChange={handleChange('difficulty')}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="Low">Low</option>
                <option value="Moderate">Moderate</option>
                <option value="High">High</option>
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Equipment
              <input
                type="text"
                value={formValues.equipment}
                onChange={handleChange('equipment')}
                placeholder="Bodyweight, dumbbells…"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Examples: bodyweight, dumbbells, bands, kettlebell, barbell, machines, yoga mat.
              </span>
            </label>

            {errors && (
              <p className="sm:col-span-2 text-sm text-rose-500">{errors}</p>
            )}

            <div className="sm:col-span-2">
              <Button type="button" onClick={handleGenerate}>
                Generate workout
              </Button>
            </div>

            <div className="sm:col-span-2 mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">Dev helper: override burnout level</p>
              <p className="mt-1">
                Use this to quickly preview plans for different burnout levels without changing your
                actual check-in history.
              </p>
              <select
                value={debugBurnoutLevel}
                onChange={(event) => setDebugBurnoutLevel(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Use latest burnout level</option>
                <option value="Low">Low 
                </option>
                <option value="Moderate">Moderate</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

          </form>
        </Card>
        </AnimatedSection>

        <AnimatedSection>
        {({ isVisible }) => (
        <Card title="Workout Plan">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="animate-pulse rounded-xl border border-slate-100 bg-white px-4 py-4">
                  <div className="h-3 w-24 rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-40 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          ) : plan && plan.sections?.length ? (
            <div className="space-y-6">
              {(() => {
                const totalExercises = flattenedExercises.length;
                const completedCount = completedExerciseIds.length;
                const progressPercent = totalExercises
                  ? Math.min(100, Math.round((completedCount / totalExercises) * 100))
                  : 0;
                const activeIndex = flattenedExercises.findIndex((item) => item.id === activeExerciseId);
                const currentStep = activeIndex >= 0 ? activeIndex + 1 : 0;

                if (!totalExercises) return null;

                return (
                  <div className="rounded-2xl border border-slate-100 bg-white/95 px-4 py-3 text-xs text-slate-600 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="text-[12px] font-semibold text-slate-900">
                          {currentStep > 0
                            ? `Exercise ${currentStep} of ${totalExercises}`
                            : `0 of ${totalExercises} exercises started`}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {progressPercent}% complete · {completedCount} done
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                        Guided mode · follow the highlighted card
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-300 ease-out"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const accent = getBurnoutAccent(usedPlanBurnoutLevel);
                const burnoutLabel = usedPlanBurnoutLevel || displayBurnoutLevel || 'your current';
                const trendLabel = burnoutState.trendLabel;
                const whyText = plan.adaptationMessage || burnoutState.adaptationMessage || plan.notes;

                return (
                  <div
                    className={
                      `rounded-2xl border bg-gradient-to-r px-5 py-4 shadow-sm ` +
                      `${accent.border} ` +
                      getHeaderGradientClasses(usedPlanBurnoutLevel)
                    }
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          Today’s adaptive plan
                        </p>
                        <p className="text-xl font-semibold text-slate-900 leading-snug">{plan.title}</p>
                        <p className="text-xs text-slate-600">
                          {plan.duration && <span className="font-medium">{plan.duration}</span>}
                          {plan.duration && plan.equipment && ' • '}
                          {plan.equipment && <span>Equipment: {plan.equipment}</span>}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-700">
                          Adapted for {burnoutLabel} burnout
                          {trendLabel ? ` (${trendLabel})` : ''}.
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-[11px]">
                        <div className="inline-flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${accent.badge}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                            <span>Burnout: {usedPlanBurnoutLevel || 'Unknown'}</span>
                          </span>
                          {plan.adaptationMode && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                              <span>{plan.adaptationMode}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {whyText && (
                      <div className="mt-3 text-xs text-slate-700">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-800 hover:text-indigo-700 focus:outline-none"
                          onClick={() => setShowWhyPlan((prev) => !prev)}
                        >
                          <span>{showWhyPlan ? 'Hide why this plan' : 'Why this plan?'}</span>
                          <span aria-hidden="true">{showWhyPlan ? '−' : '›'}</span>
                        </button>
                        {showWhyPlan && (
                          <p className="mt-2 leading-snug">
                            {whyText}
                          </p>
                        )}
                      </div>
                    )}

                    {plan.createdAt && (
                      <p className="mt-2 text-[11px] text-slate-500">
                        Generated on {new Date(plan.createdAt).toLocaleString()} using burnout level{' '}
                        {usedPlanBurnoutLevel}.
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white/90">
                {plan.sections.map((section, sectionIndex) => {
                  const stepNumber = sectionIndex + 1;
                  const exerciseCount = section.exercises?.length || 0;
                  const accent = getBurnoutAccent(usedPlanBurnoutLevel);
                  return (
                    <div
                      key={`${section.sectionTitle}-${sectionIndex}`}
                      className="rounded-2xl border border-slate-100 bg-white/95 px-4 py-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold text-white shadow-sm ${accent.dot}`}
                          >
                            {stepNumber}
                          </span>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Step {stepNumber}
                            </p>
                            <h3 className="text-sm font-semibold text-slate-900">
                              {section.sectionTitle}
                            </h3>
                          </div>
                        </div>
                        <span className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
                          {exerciseCount} exercise{exerciseCount === 1 ? '' : 's'}
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {section.exercises?.map((exercise, index) => {
                          const cardIndex = Number(`${sectionIndex}${index}`);
                          const isExpanded = expandedIndex === cardIndex;
                          const cardId = `${sectionIndex}-${index}`;
                          const isActive = activeExerciseId === cardId;
                          const isCompleted = completedExerciseIds.includes(cardId);
                          const isSkipped = skippedExerciseIds.includes(cardId);

                          const flatIndex = flattenedExercises.findIndex((ex) => ex.id === cardId);
                          let nextExerciseName = null;
                          if (flatIndex >= 0 && flatIndex < flattenedExercises.length - 1) {
                            const nextMeta = flattenedExercises[flatIndex + 1];
                            const nextSection = plan.sections[nextMeta.sectionIndex];
                            const nextExercise = nextSection?.exercises?.[nextMeta.exerciseIndex];
                            nextExerciseName = nextExercise?.name || null;
                          }

                          let intentBadgeClasses = 'bg-slate-200 text-slate-700';
                          if (exercise.intent) {
                            if (/breath|breathing/i.test(exercise.intent)) {
                              intentBadgeClasses = 'bg-sky-100 text-sky-700';
                            } else if (/stretch|mobility/i.test(exercise.intent)) {
                              intentBadgeClasses = 'bg-emerald-100 text-emerald-700';
                            } else {
                              intentBadgeClasses = 'bg-indigo-100 text-indigo-700';
                            }
                          }
                          const delayMs = flatIndex >= 0 ? flatIndex * 50 : index * 50;

                          return (
                            <div
                              key={`${section.sectionTitle}-${exercise.name}-${index}`}
                              className={`rounded-2xl border px-5 text-sm shadow-sm transition-transform transition-shadow transition-colors duration-200 ease-out saf-stagger-item ${
                                isVisible ? 'saf-stagger-item-visible' : ''
                              }
                                ${isCompleted ? 'py-3 border-emerald-200 bg-emerald-50/80 opacity-90' : 'py-4 border-slate-100 bg-slate-50/80'}
                                ${isActive && !isCompleted ? 'border-indigo-400 bg-white shadow-md ring-1 ring-indigo-100 scale-[1.01]' : ''}
                                ${!isActive && !isCompleted ? 'hover:-translate-y-0.5 hover:shadow-md' : ''}
                              `}
                              style={{ transitionDelay: `${delayMs}ms` }}
                            >
                              <div className="flex gap-3">
                                <div
                                  className={`mt-1 w-1 rounded-full
                                    ${isActive && !isCompleted ? 'bg-indigo-500' : ''}
                                    ${!isActive && !isCompleted ? 'bg-slate-200' : ''}
                                    ${isCompleted ? 'bg-emerald-400/80' : ''}
                                  `}
                                />
                                <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex items-start gap-3">
                                    <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-slate-50">
                                      <span>
                                        {exercise.intent && /breath|breathing/i.test(exercise.intent)
                                          ? '🫁'
                                          : exercise.intent && /stretch|mobility/i.test(exercise.intent)
                                            ? '🧘'
                                            : '🏋️'}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="text-[15px] font-semibold text-slate-900">
                                        {exercise.name}
                                      </p>
                                      <p className="mt-0.5 text-[11px] text-slate-600">
                                        {exercise.sets} sets · {exercise.reps} reps · Rest {exercise.rest}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-end gap-2 text-[11px]">
                                    {isActive && !isCompleted && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-1 text-[10px] font-semibold text-white">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                                        Current exercise
                                      </span>
                                    )}
                                    {exercise.intent && (
                                      <span
                                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium ${intentBadgeClasses}`}
                                      >
                                        {exercise.intent}
                                      </span>
                                    )}
                                    {isCompleted && !isSkipped && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[10px] font-semibold text-white">
                                        <span className="text-xs">✓</span>
                                        Done
                                      </span>
                                    )}
                                    {isSkipped && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-300 px-2.5 py-1 text-[10px] font-semibold text-slate-800">
                                        Skipped
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {isActive && !isCompleted && nextExerciseName && (
                                <p className="mt-2 text-[11px] text-slate-500">
                                  Next: <span className="font-medium">{nextExerciseName}</span>
                                </p>
                              )}

                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                                <div className="flex flex-wrap gap-2">
                                  {!isCompleted && !isActive && (
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 focus:outline-none"
                                      onClick={() => {
                                        setActiveExerciseId(cardId);
                                        setExpandedIndex(cardIndex);
                                      }}
                                    >
                                      <span>Start</span>
                                    </button>
                                  )}

                                  {isActive && !isCompleted && (
                                    <>
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 focus:outline-none"
                                        onClick={() => {
                                          setCompletedExerciseIds((prev) => {
                                            if (prev.includes(cardId)) return prev;
                                            const next = [...prev, cardId];
                                            const remaining = flattenedExercises.filter((ex) => !next.includes(ex.id));
                                            setActiveExerciseId(remaining[0]?.id || cardId);
                                            setSkippedExerciseIds((prevSkipped) => prevSkipped.filter((id) => id !== cardId));
                                            return next;
                                          });
                                        }}
                                      >
                                        <span>Mark as done</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-300 focus:outline-none"
                                        onClick={() => {
                                          setSkippedExerciseIds((prev) => (prev.includes(cardId) ? prev : [...prev, cardId]));
                                          setCompletedExerciseIds((prev) => {
                                            if (prev.includes(cardId)) return prev;
                                            const next = [...prev, cardId];
                                            const remaining = flattenedExercises.filter((ex) => !next.includes(ex.id));
                                            setActiveExerciseId(remaining[0]?.id || cardId);
                                            return next;
                                          });
                                        }}
                                      >
                                        <span>Skip</span>
                                      </button>
                                    </>
                                  )}

                                  {(isCompleted || isSkipped) && (
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 focus:outline-none"
                                      onClick={() => {
                                        setCompletedExerciseIds((prev) => prev.filter((id) => id !== cardId));
                                        setSkippedExerciseIds((prev) => prev.filter((id) => id !== cardId));
                                        setActiveExerciseId(cardId);
                                      }}
                                    >
                                      <span>Reset</span>
                                    </button>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 focus:outline-none"
                                  onClick={() => setExpandedIndex(isExpanded ? null : cardIndex)}
                                >
                                  <span>{isExpanded ? 'Hide details' : 'View details'}</span>
                                  <span aria-hidden="true">{isExpanded ? '−' : '›'}</span>
                                </button>
                              </div>

                              {isExpanded && (
                                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                  <div className="flex items-start gap-2">
                                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-semibold text-indigo-700">
                                      i
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-semibold text-slate-800">Coaching tip</p>
                                      {exercise.notes && (
                                        <p className="mt-0.5 leading-snug">
                                          {exercise.notes}
                                        </p>
                                      )}
                                    </div>
                                  </div>
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
            </div>
          ) : (
            <EmptyState
              title="No plan yet"
              description="Set your workout inputs above and generate a plan."
            />
          )}
        </Card>
        )}
        </AnimatedSection>
      </div>

      {toastVisible && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg"
          role="status"
          aria-live="polite"
        >
          Workout generated. Scroll to view your plan.
        </div>
      )}
    </>
  );
};

export default WorkoutPlanner;
