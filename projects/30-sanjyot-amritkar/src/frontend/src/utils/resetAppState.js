const APP_STORAGE_PREFIX = 'saf_';
const TEST_KEY = '__saf_test__';

export function resetAppState() {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    const storage = window.localStorage;
    const keysToRemove = [];

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) continue;
      if (key.startsWith(APP_STORAGE_PREFIX) || key === TEST_KEY) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      storage.removeItem(key);
    });
  } catch {
    // If clearing fails, fail silently; individual hooks will still use their defaults.
  }
}

export function getKnownAppStorageKeys() {
  return [
    'saf_onboarding',
    'saf_burnout_history',
    'saf_workout_history',
    'saf_latest_workout_plan',
    'saf_burnout_ai_insight'
  ];
}
