const EXERCISEDB_BASE =
  import.meta.env.VITE_EXERCISEDB_BASE || 'https://exercisedb.p.rapidapi.com';

const EXERCISEDB_KEY = import.meta.env.VITE_EXERCISEDB_API_KEY || '';
const EXERCISEDB_HOST = import.meta.env.VITE_EXERCISEDB_HOST || 'exercisedb.p.rapidapi.com';

const cache = new Map();

const synonyms = {
  'jumping jacks': ['jumping jack', 'jumping'],
  'dumbbell row': ['row', 'dumbbell bent over row', 'bent over row'],
  'bicep curl': ['biceps curl', 'curl', 'dumbbell curl'],
  'child pose': ['child pose stretch', 'pose', 'child']
};

const normalizeName = (value) => {
  if (!value) return '';
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/-+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '');
};

const normalizeForMatch = (value) =>
  normalizeName(value).replace(/\s+/g, ' ').trim();

const singularize = (token) => {
  if (token.endsWith('s') && token.length > 3) {
    return token.slice(0, -1);
  }
  return token;
};

const buildQueries = (name) => {
  const normalized = normalizeName(name);
  if (!normalized) return [];

  const hyphenated = normalized.replace(/\s+/g, '-');
  const tokens = normalized.split(' ').filter(Boolean);
  const firstToken = tokens[0];
  const lastToken = tokens[tokens.length - 1];
  const joined = tokens.slice(0, 2).join(' ');
  const spacedOriginal = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/-+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalizedKey = normalizeForMatch(name);
  const synonymQueries = (synonyms[normalizedKey] || []).map((value) => normalizeName(value));

  const queries = [
    ...synonymQueries,
    spacedOriginal,
    normalized,
    joined,
    hyphenated,
    firstToken,
    singularize(firstToken || ''),
    lastToken,
    singularize(lastToken || '')
  ].filter(Boolean);

  return [...new Set(queries)];
};

const fetchExerciseDb = async (path) => {
  if (cache.has(path)) {
    return cache.get(path);
  }
  const url = `${EXERCISEDB_BASE}${path}`;
  console.info('[ExerciseDB] Request:', url);
  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': EXERCISEDB_KEY,
      'X-RapidAPI-Host': EXERCISEDB_HOST
    },
    cache: 'no-store'
  });

  console.info('[ExerciseDB] Status:', response.status);

  if (response.status === 429) {
    console.error('[ExerciseDB] Rate limited (429).');
    throw new Error('ExerciseDB rate limit (429)');
  }

  if (!response.ok) {
    console.error('[ExerciseDB] Response error:', response.status, response.statusText);
    throw new Error(`ExerciseDB request failed (${response.status})`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    console.warn('[ExerciseDB] Non-array response:', data);
  } else {
    console.debug('[ExerciseDB] Response data:', data.slice(0, 2));
  }
  cache.set(path, data);
  return data;
};

const findBestMatch = (list, name) => {
  if (!Array.isArray(list)) return null;
  const normalized = normalizeForMatch(name);
  const rawTokens = normalized.split(' ').filter(Boolean);
  const tokens = Array.from(
    new Set(rawTokens.flatMap((token) => [token, singularize(token)]))
  ).filter(Boolean);

  const exact = list.find((item) => normalizeForMatch(item.name) === normalized);
  if (exact) return exact;

  let best = null;
  let bestScore = 0;

  for (const item of list) {
    const candidate = normalizeForMatch(item.name);
    const score = tokens.reduce(
      (acc, token) => (candidate.includes(token) ? acc + 1 : acc),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  if (best) return best;

  return list.find((item) => normalizeForMatch(item.name).includes(tokens[0] || '')) || null;
};

export const fetchExerciseByName = async (name) => {
  if (!name || !EXERCISEDB_KEY || !EXERCISEDB_HOST) {
    console.warn('[ExerciseDB] Missing API key or host.');
    return null;
  }

  const queries = buildQueries(name);
  console.debug('[ExerciseDB] Queries:', queries);
  for (const query of queries) {
    try {
      const data = await fetchExerciseDb(`/exercises/name/${encodeURIComponent(query)}`);
      const match = findBestMatch(data, name);
      if (match) return match;
      console.info('[ExerciseDB] No match for query:', query);
    } catch (error) {
      console.error('[ExerciseDB] Fetch error:', error);
    }
  }

  console.info('[ExerciseDB] No exercise match found for:', name);
  return null;
};

export const testExerciseDb = async () => {
  try {
    console.info('[ExerciseDB] Test: /exercises/name/push-up');
    const data = await fetchExerciseDb('/exercises/name/push-up');
    console.info('[ExerciseDB] Test response:', data);
    return data;
  } catch (error) {
    console.error('[ExerciseDB] Test error:', error);
    throw error;
  }
};
