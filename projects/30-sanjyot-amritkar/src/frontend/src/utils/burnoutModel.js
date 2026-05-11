export const MAX_BURNOUT_SCORE = 25;

export const BURNOUT_LEVELS = /** @type {const} */ ([
  'Low',
  'Moderate',
  'High',
  'Critical'
]);

const clampRating = (value) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  if (numberValue < 1 || numberValue > 5) return null;
  return numberValue;
};

export const calculateBurnoutRiskScore = (entry) => {
  if (!entry) return null;

  const stress = clampRating(entry.stress);
  const sleep = clampRating(entry.sleep);
  const energy = clampRating(entry.energy);
  const social = clampRating(entry.social);
  const enjoyment = clampRating(entry.enjoyment);

  if ([stress, sleep, energy, social, enjoyment].some((value) => value === null)) {
    return null;
  }

  return (
    stress + (6 - sleep) + (6 - energy) + (6 - social) + (6 - enjoyment)
  );
};

export const classifyBurnoutLevel = (riskScore) => {
  const score = Number(riskScore);
  if (!Number.isFinite(score)) return 'Low';
  if (score >= 20) return 'Critical';
  if (score >= 16) return 'High';
  if (score >= 11) return 'Moderate';
  return 'Low';
};

const summarizeTrend = (scores) => {
  const recent = Array.isArray(scores) ? scores.filter((v) => Number.isFinite(v)) : [];
  if (recent.length < 2) {
    return {
      label: 'Stable',
      direction: 'stable',
      delta: 0
    };
  }

  const latest = recent[0];
  const previousAvg =
    recent.slice(1, 3).reduce((acc, value) => acc + value, 0) /
    Math.max(1, Math.min(2, recent.length - 1));

  const delta = latest - previousAvg;

  if (delta >= 2) {
    return { label: 'Worsening', direction: 'up', delta: Math.round(delta * 10) / 10 };
  }
  if (delta <= -2) {
    return { label: 'Improving', direction: 'down', delta: Math.round(delta * 10) / 10 };
  }

  return { label: 'Stable', direction: 'stable', delta: Math.round(delta * 10) / 10 };
};

const levelCopy = {
  Low: {
    explanation: 'You look steady right now. You can train normally and keep recovery habits consistent.',
    adjustment: 'Low burnout — keep your planned workout as-is.'
  },
  Moderate: {
    explanation: 'You may be accumulating strain. Dial intensity back slightly and prioritize recovery.',
    adjustment: 'Moderate burnout — slightly reduced volume and intensity.'
  },
  High: {
    explanation: 'Your signals suggest high strain. Keep things simple, low-impact, and leave reps in reserve.',
    adjustment: 'High burnout — clear reduction in volume and intensity, simplified structure.'
  },
  Critical: {
    explanation: 'You’re showing critical strain. Today is about restoring: gentle mobility, breathing, and light movement only.',
    adjustment: 'Critical burnout — switched to a restorative recovery session.'
  }
};

export const getBurnoutState = (history) => {
  const safeHistory = Array.isArray(history) ? history : [];

  const latestEntry = safeHistory[0] || null;

  const recentScores = safeHistory
    .slice(0, 3)
    .map((entry) => calculateBurnoutRiskScore(entry))
    .filter((value) => Number.isFinite(value));

  const latestScore = recentScores[0] ?? null;
  const trend = summarizeTrend(recentScores);

  if (latestScore === null) {
    return {
      level: 'Low',
      score: null,
      trendLabel: 'Stable',
      trend,
      source: 'baseline',
      explanation: 'No burnout check-in yet — using a neutral baseline workout.',
      adaptationMessage: 'No burnout check-in yet — generating a neutral baseline workout.'
    };
  }

  const recentAvg = recentScores.reduce((acc, value) => acc + value, 0) / recentScores.length;
  const compositeScore = Math.round((0.7 * latestScore + 0.3 * recentAvg) * 10) / 10;

  const latestStoredLevel = latestEntry?.result?.level;
  const level = BURNOUT_LEVELS.includes(latestStoredLevel)
    ? latestStoredLevel
    : classifyBurnoutLevel(compositeScore);

  const trendSuffix =
    trend.label === 'Worsening'
      ? ' (trend: worsening)'
      : trend.label === 'Improving'
        ? ' (trend: improving)'
        : '';

  return {
    level,
    score: compositeScore,
    latestScore,
    trendLabel: trend.label,
    trend,
    source: safeHistory.length > 1 ? 'latest+trend' : 'latest',
    explanation: `${levelCopy[level].explanation}${trendSuffix}`,
    adaptationMessage: `${levelCopy[level].adjustment}${trendSuffix}`
  };
};
