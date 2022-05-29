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
  defaultState: T | null = null,
  parser?: (val: string) => void
): [T, (newState: T) => void] {
  const [stringState, setStringState] = useLocalStorageStringState(
    key,
    JSON.stringify(defaultState)
  );
  const parsedValue = parser ? parser(stringState) : JSON.parse(stringState);

  return [
    useMemo(() => stringState && parsedValue, [stringState]),
    (newState) => setStringState(JSON.stringify(newState)),
  ];
}

//parse array of key pair objects e.g
//input [{publicKey: {0: 33, 1: 55}}] => output [{publicKey: [33,55]}]
export const handleParseKeyPairArray = (val: string) => {
  const nativeParsedValue = JSON.parse(val);
  if (!nativeParsedValue.length) {
  }
  const customParsedValue = nativeParsedValue.map((obj) => {
    return parseKeyPairObj(obj);
  });
  return customParsedValue;
};

export const handleParseKeyPairObj = (val: string) => {
  const nativeParsedValue = JSON.parse(val);
  return parseKeyPairObj(nativeParsedValue);
};

export const parseKeyPairObj = (obj: nacl.BoxKeyPair) => {
  const newObj = {};
  const keys = Object.keys(obj);
  for (const key of keys) {
    newObj[key] = Object.values(obj[key]);
  }
  return newObj;
};
