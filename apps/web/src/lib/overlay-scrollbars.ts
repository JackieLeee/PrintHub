const SCROLL_IDLE_MS = 1200;

function scrollingElement(target: EventTarget | null): Element {
  if (target instanceof Element) {
    if (target === document.body) {
      return document.scrollingElement ?? document.documentElement;
    }
    return target;
  }
  return document.scrollingElement ?? document.documentElement;
}

function markScrolling(el: Element, timers: WeakMap<Element, ReturnType<typeof setTimeout>>): void {
  el.classList.add("is-scrolling");
  const prev = timers.get(el);
  if (prev) clearTimeout(prev);
  timers.set(
    el,
    setTimeout(() => {
      el.classList.remove("is-scrolling");
      timers.delete(el);
    }, SCROLL_IDLE_MS),
  );
}

function findWheelScrollHost(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  let node: Element | null = target;
  while (node && node !== document.documentElement) {
    const style = getComputedStyle(node);
    const overflowY = style.overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  const root = document.scrollingElement ?? document.documentElement;
  return root.scrollHeight > root.clientHeight + 1 ? root : null;
}

/** Overlay-style scrollbars: hidden until scrolling, then fade out. */
export function installOverlayScrollbars(): () => void {
  const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
  let rootTimer: ReturnType<typeof setTimeout> | undefined;

  const pulse = (el: Element) => {
    markScrolling(el, timers);
    document.documentElement.classList.add("is-scrolling");
    if (rootTimer) clearTimeout(rootTimer);
    rootTimer = setTimeout(() => {
      document.documentElement.classList.remove("is-scrolling");
      rootTimer = undefined;
    }, SCROLL_IDLE_MS);
  };

  const onScroll = (event: Event) => {
    pulse(scrollingElement(event.target));
  };

  const onWheel = (event: WheelEvent) => {
    const host = findWheelScrollHost(event.target);
    if (host) pulse(host);
  };

  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  document.addEventListener("wheel", onWheel, { capture: true, passive: true });

  return () => {
    document.removeEventListener("scroll", onScroll, { capture: true });
    document.removeEventListener("wheel", onWheel, { capture: true });
    if (rootTimer) clearTimeout(rootTimer);
    document.documentElement.classList.remove("is-scrolling");
    timers.forEach((timer) => clearTimeout(timer));
  };
}

export function shouldUseOverlayScrollbars(): boolean {
  return window.printhubDesktop?.platform !== "darwin";
}
