import { useMemo, useState, useEffect, useCallback } from "react";

const localStorageListeners: { [key: string]: any[] } = {};

export function useLocalStorageStringState(
  key: string,
  defaultState: string | null = null
): [string | null, (newState: string | null) => void] {
  const state =
    typeof window !== "undefined"
      ? localStorage.getItem(key) || defaultState
      : defaultState || "";

  if (typeof window !== "undefined" && !localStorage.getItem(key)) {
    if (state) {
      localStorage.setItem(key, state);
    } else {
      localStorage.removeItem(key);
    }
  }
  const [, notify] = useState(key + "\n" + state);

  useEffect(() => {
    if (!localStorageListeners[key]) {
      localStorageListeners[key] = [];
    }
    localStorageListeners[key].push(notify);
    return () => {
      localStorageListeners[key] = localStorageListeners[key].filter(
        (listener) => listener !== notify
      );
      if (localStorageListeners[key].length === 0) {
        delete localStorageListeners[key];
      }
    };
  }, [key]);

  const setState = useCallback<(newState: string | null) => void>(
    (newState) => {
      if (!localStorageListeners[key]) {
        localStorageListeners[key] = [];
      }
      const changed = state !== newState;
      if (!changed) {
        return;
      }

      if (newState === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, newState);
      }
      localStorageListeners[key].forEach((listener) =>
        listener(key + "\n" + newState)
      );
    },
    [state, key]
  );

  return [state, setState];
}

export default function useLocalStorageState<T = any>(
  key: string,
  defaultState: T | null = null
): [T, (newState: T) => void] {
  const [stringState, setStringState] = useLocalStorageStringState(
    key,
    JSON.stringify(defaultState)
  );

  return [
    useMemo(() => stringState && JSON.parse(stringState), [stringState]),
    (newState) => setStringState(JSON.stringify(newState)),
  ];
}
