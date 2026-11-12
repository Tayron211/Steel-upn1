import { useState, useRef, useLayoutEffect, useCallback } from 'react';

/**
 * useSlidingIndicator
 * Provides a GPU-accelerated, iOS-style gliding pill style for any tab bar,
 * day strip, time-block selector, or segmented control.
 *
 * Usage:
 * - Attach `containerRef` to the `relative` wrapper element.
 * - Put `data-slide-active={isActive ? 'true' : undefined}` on the active button.
 * - Render `<span aria-hidden="true" style={pillStyle} className="pointer-events-none absolute top-0 left-0 z-0 ..." />` inside the container.
 * - Ensure buttons have `relative z-10`.
 */
export function useSlidingIndicator(activeKey, deps = []) {
  const containerRef = useRef(null);
  const hasMountedRef = useRef(false);
  const prevKeyRef = useRef(activeKey);
  const [pillStyle, setPillStyle] = useState({
    opacity: 0,
    transform: 'translate3d(0px, 0px, 0px)',
    width: '0px',
    height: '0px',
    transition: 'none',
  });

  const measure = useCallback((shouldAnimate, shouldCenterScroll) => {
    const container = containerRef.current;
    if (!container) return;

    const activeEl = container.querySelector('[data-slide-active="true"]');
    if (!activeEl) {
      setPillStyle((prev) => ({
        ...prev,
        opacity: 0,
        transition: shouldAnimate ? 'opacity 150ms ease' : 'none',
      }));
      return;
    }

    const left = activeEl.offsetLeft;
    const top = activeEl.offsetTop;
    const width = activeEl.offsetWidth;
    const height = activeEl.offsetHeight;

    if (width === 0 || height === 0) return;

    setPillStyle({
      opacity: 1,
      transform: `translate3d(${left}px, ${top}px, 0px)`,
      width: `${width}px`,
      height: `${height}px`,
      transition: shouldAnimate
        ? 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1), width 300ms cubic-bezier(0.22, 1, 0.36, 1), height 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease'
        : 'none',
    });

    if (shouldCenterScroll && container.scrollWidth > container.clientWidth + 2) {
      const targetLeft = left - container.clientWidth / 2 + width / 2;
      container.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: 'smooth',
      });
    }
  }, []);

  useLayoutEffect(() => {
    const isInitial = !hasMountedRef.current;
    const keyChanged = prevKeyRef.current !== activeKey;
    prevKeyRef.current = activeKey;

    measure(!isInitial, !isInitial && keyChanged);

    if (isInitial) {
      // Enable transitions right after first paint
      const raf = requestAnimationFrame(() => {
        hasMountedRef.current = true;
      });
      return () => cancelAnimationFrame(raf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, measure, ...deps]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(() => {
      measure(false, false);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [measure]);

  return { containerRef, pillStyle };
}

