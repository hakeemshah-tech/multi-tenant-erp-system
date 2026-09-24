import { useCallback, useRef } from "react";

export function useDebouncedAutosave<T>(
  fn: (val: T) => Promise<void> | void,
  delay = 600
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(
    (val: T) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fn(val);
      }, delay);
    },
    [fn, delay]
  );

  return run;
}
