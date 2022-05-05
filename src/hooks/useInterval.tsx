import { useRef, useEffect } from "react";

export const SECONDS = 1000;

export function useEffectAfterTimeout(effect: () => void, timeout: number) {
  useEffect(() => {
    const handle = setTimeout(effect, timeout);
    return () => clearTimeout(handle);
  });
}

export default function useInterval(callback: () => void, delay: number) {
  const savedCallback = useRef<() => void>();

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current && savedCallback.current();
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => {
        clearInterval(id);
      };
    }
  }, [delay]);
}
