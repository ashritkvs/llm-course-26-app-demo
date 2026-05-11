import { classifyBurnoutLevel } from './burnoutModel.js';

const clampInt = (value, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.floor(num));
};

const normalizeText = (value) => String(value || '').toLowerCase();

const inferMuscleCategory = (muscleGroup) => {
  const text = normalizeText(muscleGroup);
  if (/(lower|legs|glutes|hamstring|quad|calf)/.test(text)) return 'lower';
  if (/(core|abs|abdom|waist)/.test(text)) return 'core';
  if (/(upper|chest|back|shoulder|arm|arms|bicep|tricep)/.test(text)) return 'upper';
  return 'full';
};

const equipmentSupports = (equipment, keyword) => normalizeText(equipment).includes(keyword);

const getBaseMainExercises = ({ category, equipment }) => {
  const hasDumbbells = equipmentSupports(equipment, 'dumbbell');
  const hasBands = equipmentSupports(equipment, 'band');

  const rowExercise = hasDumbbells
    ? 'dumbbell row'
    : hasBands
      ? 'resistance band row'
      : 'backpack row';

  const pressExercise = 'push-up';

  if (category === 'lower') {
    return [
      { name: 'bodyweight squat', pattern: 'squat' },
      { name: hasDumbbells ? 'dumbbell Romanian deadlift' : 'hip hinge', pattern: 'hinge' }
    ];
  }

  if (category === 'core') {
    return [
      { name: 'dead bug', pattern: 'core' },
      { name: 'side plank', pattern: 'core' }
    ];
  }

  if (category === 'upper') {
    return [
      { name: pressExercise, pattern: 'push' },
      { name: rowExercise, pattern: 'pull' }
    ];
  }

  return [
    { name: 'bodyweight squat', pattern: 'squat' },
    { name: pressExercise, pattern: 'push' }
  ];
};

const getAccessoryExercises = ({ category, equipment }) => {
  const hasDumbbells = equipmentSupports(equipment, 'dumbbell');
  const hasBands = equipmentSupports(equipment, 'band');

  if (category === 'lower') {
    return [
      {
        name: 'glute bridge',
        notes: 'Pause at the top and breathe steadily.',
        intent: 'Accessory strength'
      }
    ];
  }

  if (category === 'core') {
    return [
      {
        name: 'bird dog',
        notes: 'Move slowly and keep ribs down.',
        intent: 'Core activation'
      }
    ];
  }

  // upper / full
  if (hasDumbbells) {
    return [
      {
        name: 'bicep curl',
        notes: 'Slow down the lowering phase.',
        intent: 'Accessory strength'
      }
    ];
  }

  if (hasBands) {
    return [
      {
        name: 'band bicep curl',
        notes: 'Keep shoulders relaxed.',
        intent: 'Accessory strength'
      }
    ];
  }

  return [
    {
      name: 'towel curl isometric',
      notes: 'Hold steady tension without straining.',
      intent: 'Isometric activation'
    }
  ];
};

const getWarmupExercises = (level) => {
  if (level === 'Critical') {
    return [
      {
        name: 'box breathing',
        sets: 1,
        reps: '3–5 rounds',
        rest: '—',
        notes: 'Inhale 4s, hold 4s, exhale 4s, hold 4s.',
        intent: 'Recovery breathing'
      }
    ];
  }

  if (level === 'High') {
    return [
      {
        name: 'march in place',
        sets: 1,
        reps: '60 sec',
        rest: '15 sec',
        notes: 'Keep it easy; aim for a gentle raise in heart rate.',
        intent: 'Gentle activation'
      }
    ];
  }

  return [
    {
      name: 'jumping jacks',
      sets: 1,
      reps: level === 'Moderate' ? '20 sec' : '30 sec',
      rest: '15 sec',
      notes: 'Start easy and raise heart rate gradually.',
      intent: 'Activation'
    }
  ];
};

const getCooldownExercises = (level) => {
  if (level === 'Critical') {
    return [
      {
        name: 'gentle neck + shoulder release',
        sets: 1,
        reps: '2 min',
        rest: '—',
        notes: 'Move slowly; stop before discomfort.',
        intent: 'Recovery stretch'
      },
      {
        name: 'supine breathing',
        sets: 1,
        reps: '2–3 min',
        rest: '—',
        notes: 'Let your ribs expand; exhale longer than inhale.',
        intent: 'Recovery breathing'
      }
    ];
  }

  if (level === 'High') {
    return [
      {
        name: 'seated forward fold',
        sets: 1,
        reps: '45–60 sec',
        rest: '—',
        notes: 'Breathe slowly and keep the stretch gentle.',
        intent: 'Recovery stretch'
      }
    ];
  }

  return [
    {
      name: 'child pose',
      sets: 1,
      reps: '45 sec',
      rest: '—',
      notes: 'Breathe deeply and relax shoulders.',
      intent: 'Recovery stretch'
    }
  ];
};

const volumeFactorByLevel = {
  Low: 1,
  Moderate: 0.8,
  High: 0.6,
  Critical: 0
};

const intensityHintByLevel = {
  Low: '[Strength] Push at controlled intensity; you can challenge yourself but keep form solid.',
  Moderate:
    '[Reduced-load strength] Keep 1–2 reps in reserve and prioritize good form over volume.',
  High:
    '[Recovery movement] Keep this light and focus on smooth, easy reps rather than effort.',
  Critical:
    '[Recovery] Do not push intensity; prioritize relaxation and gentle breathing throughout.'
};

const baseSetsByDifficulty = {
  Low: 2,
  Moderate: 3,
  High: 4
};

const adaptationModeByLevel = {
  Low: 'Standard training',
  Moderate: 'Lighter training',
  High: 'Reduced-load session',
  Critical: 'Recovery session'
};

const adjustDurationByLevel = (level, baseMinutes) => {
  const safe = clampInt(baseMinutes, 30);
  if (level === 'Moderate') {
    // Slight reduction but still a solid session (~80% of requested).
    return Math.max(15, Math.round(safe * 0.8));
  }
  if (level === 'High') {
    // Clearly shorter session (~60% of requested).
    return Math.max(10, Math.round(safe * 0.6));
  }
  if (level === 'Critical') {
    // Short, restorative window only: keep within 10–15 minutes.
    const target = Math.round(safe * 0.5) || 10;
    return Math.max(10, Math.min(15, target));
  }
  // Low burnout: keep planned duration.
  return safe;
};

const buildMainExerciseDetails = ({ name, sets, level }) => {
  if (level === 'Critical') {
    return {
      name,
      sets: 1,
      reps: 'Easy pace',
      rest: '—',
      notes: 'If this feels too much today, skip it.',
      intent: 'Recovery movement'
    };
  }

  const reps =
    level === 'High' ? '6–8' : level === 'Moderate' ? '6–10' : '8–12';

  const rest = level === 'High' ? '90 sec' : level === 'Moderate' ? '75 sec' : '60 sec';

  return {
    name,
    sets,
    reps,
    rest,
    notes: intensityHintByLevel[level],
    intent:
      level === 'High'
        ? 'Recovery movement'
        : 'Strength'
  };
};

export const generateAdaptiveWorkoutPlan = ({ inputs, burnoutState }) => {
  const safeInputs = inputs || {};
  const inferredDifficulty = ['Low', 'Moderate', 'High'].includes(safeInputs.difficulty)
    ? safeInputs.difficulty
    : 'Moderate';

  const category = inferMuscleCategory(safeInputs.muscleGroup);
  const rawLevel = burnoutState?.level || 'Low';
  const level = classifyBurnoutLevel(
    burnoutState?.score ?? burnoutState?.latestScore ?? null
  );

  // If burnoutState.level is already a valid label, prefer it.
  const effectiveLevel = ['Low', 'Moderate', 'High', 'Critical'].includes(rawLevel)
    ? rawLevel
    : level;

  const requestedDuration = clampInt(safeInputs.duration, 30);
  const durationMinutes = adjustDurationByLevel(effectiveLevel, requestedDuration);
  const equipment = String(safeInputs.equipment || '');

  const adaptation = {
    burnoutLevelUsed: effectiveLevel,
    mode: adaptationModeByLevel[effectiveLevel] || 'Standard training',
    message:
      burnoutState?.adaptationMessage ||
      `${adaptationModeByLevel[effectiveLevel] || 'Standard training'} for ${effectiveLevel} burnout.`,
    rationale: burnoutState?.explanation || ''
  };

  if (effectiveLevel === 'Critical') {
    const warmup = getWarmupExercises('Critical');
    const mobility = [
      {
        name: 'cat-cow',
        sets: 1,
        reps: '60–90 sec',
        rest: '—',
        notes: 'Move gently with breath.',
        intent: 'Recovery mobility'
      },
      {
        name: 'hip flexor stretch',
        sets: 1,
        reps: '45 sec / side',
        rest: '—',
        notes: 'Keep it mild; no forcing.',
        intent: 'Recovery stretch'
      }
    ];
    const cooldown = getCooldownExercises('Critical');

    const plan = {
      title: `Restorative Recovery Session`,
      duration: `${durationMinutes} min`,
      equipment,
      notes: adaptation.message,
      burnoutLevelUsed: effectiveLevel,
      adaptationMessage: adaptation.message,
      sections: [
        {
          sectionTitle: 'Recovery Session',
          exercises: [...warmup, ...mobility, ...cooldown]
        }
      ]
    };

    return { plan, adaptation };
  }

  const baseSets = baseSetsByDifficulty[inferredDifficulty] || 3;
  const sets = Math.max(1, Math.round(baseSets * (volumeFactorByLevel[effectiveLevel] || 1)));

  let mainExercises = getBaseMainExercises({ category, equipment }).map((exercise) =>
    buildMainExerciseDetails({ name: exercise.name, sets, level: effectiveLevel })
  );

  // For high burnout, keep fewer main lifts.
  if (effectiveLevel === 'High' && mainExercises.length > 1) {
    mainExercises = mainExercises.slice(0, 1);
  }

  const warmup = {
    sectionTitle: 'Warm-up',
    exercises: getWarmupExercises(effectiveLevel)
  };

  const main = {
    sectionTitle: 'Main Workout',
    exercises: mainExercises
  };

  const cooldown = {
    sectionTitle: 'Cooldown',
    exercises: getCooldownExercises(effectiveLevel)
  };

  const accessoryExercises = getAccessoryExercises({ category, equipment }).map((exercise) => ({
    name: exercise.name,
    sets: Math.max(1, Math.round(Math.max(1, sets - 1) * (effectiveLevel === 'High' ? 0.75 : 1))),
    reps: effectiveLevel === 'High' ? '10–12 (easy)' : '12–15',
    rest: effectiveLevel === 'High' ? '75 sec' : '45 sec',
    notes: exercise.notes || intensityHintByLevel[effectiveLevel],
    intent:
      exercise.intent || (effectiveLevel === 'High' ? 'Recovery movement' : 'Accessory strength')
  }));

  const sections = (() => {
    if (effectiveLevel === 'High') {
      // Very simplified: combine warm-up and main into one gentle movement block.
      return [
        {
          sectionTitle: 'Gentle Movement',
          exercises: [...warmup.exercises, ...main.exercises]
        },
        cooldown
      ];
    }

    return [
      warmup,
      main,
      {
        sectionTitle: 'Accessory Work',
        exercises: accessoryExercises
      },
      cooldown
    ];
  })();

  const titleByLevel = {
    Low: 'Performance Training Session',
    Moderate: 'Reduced Load Training',
    High: 'Light Recovery Workout',
    Critical: 'Restorative Recovery Session'
  };

  const baseTitle = titleByLevel[effectiveLevel] || 'Adaptive Workout';
  const muscleContext = safeInputs.muscleGroup
    ? ` — ${safeInputs.muscleGroup}`
    : inferredDifficulty
      ? ` (${inferredDifficulty})`
      : '';

  const plan = {
    title: `${baseTitle}${muscleContext}`,
    duration: `${durationMinutes} min`,
    equipment,
    notes: adaptation.message,
    burnoutLevelUsed: effectiveLevel,
    adaptationMessage: adaptation.message,
    sections
  };

  return { plan, adaptation };
};
