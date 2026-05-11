import { useEffect, useState } from 'react';

const storageAvailable = () => {
  try {
    const testKey = '__saf_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
};

const useLocalStorage = (key, initialValue) => {
  const [error, setError] = useState('');
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined' || !storageAvailable()) {
      setError('Local storage is unavailable. Your data will not be saved.');
      return initialValue;
    }

    try {
      const stored = window.localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch (err) {
      setError('Saved data was corrupted and has been reset.');
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !storageAvailable()) {
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      setError('Unable to save changes locally.');
    }
  }, [key, value]);

  return [value, setValue, error];
};

export default useLocalStorage;
