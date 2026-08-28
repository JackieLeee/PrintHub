import { useCallback, useLayoutEffect, type RefObject } from "react";

export function useAutoResizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  enabled: boolean,
) {
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, enabled]);

  useLayoutEffect(() => {
    resize();
  }, [value, enabled, resize]);

  return resize;
}
