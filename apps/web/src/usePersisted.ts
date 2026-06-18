import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * useState backed by localStorage: reads the saved value on init (with an
 * optional validator to reject corrupt data) and writes back on every change.
 */
export function usePersisted<T>(
  key: string,
  fallback: T,
  isValid?: (v: unknown) => boolean,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      const parsed = JSON.parse(raw) as unknown;
      if (isValid && !isValid(parsed)) return fallback;
      return parsed as T;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota / private mode */
    }
  }, [key, value]);

  return [value, setValue];
}
