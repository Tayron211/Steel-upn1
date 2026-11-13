import { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';

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
const buildTransition = (durationMs = 300) =>
  `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1), width ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1), height ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease`;

export function useSlidingIndicator(activeKey, deps = []) {
  const containerNodeRef = useRef(null);
  const [containerNode, setContainerNode] = useState(null);

  const containerRef = useCallback((node) => {
    containerNodeRef.current = node;
    setContainerNode(node);
  }, []);

  try {
    Object.defineProperty(containerRef, 'current', {
      configurable: true,
      get() {
        return containerNodeRef.current;
      },
      set(node) {
        containerNodeRef.current = node;
        setContainerNode(node);
      },
    });
  } catch (_) {
    containerRef.current = containerNodeRef.current;
  }

  const hasMountedRef = useRef(false);
  const prevKeyRef = useRef(activeKey);
  const lastRectRef = useRef({ opacity: 0, left: 0, top: 0, width: 0, height: 0 });
  const animatingUntilRef = useRef(0);
  const armRafRef = useRef(0);
  const retryRafRef = useRef(0);

  const [pillStyle, setPillStyle] = useState({
    opacity: 0,
    transform: 'translate3d(0px, 0px, 0px)',
    width: '0px',
    height: '0px',
    transition: 'none',
    willChange: 'transform, width',
  });

  useEffect(() => {
    return () => {
      if (armRafRef.current && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(armRafRef.current);
      }
      if (retryRafRef.current && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(retryRafRef.current);
      }
    };
  }, []);

  const measure = useCallback((shouldAnimate, shouldCenterScroll) => {
    const container = containerNodeRef.current;
    if (!container) return;

    const activeEl = container.querySelector('[data-slide-active="true"]');
    if (!activeEl) {
      if (typeof requestAnimationFrame !== 'undefined') {
        if (retryRafRef.current) cancelAnimationFrame(retryRafRef.current);
        retryRafRef.current = requestAnimationFrame(() => {
          retryRafRef.current = 0;
          const retryContainer = containerNodeRef.current;
          if (retryContainer && retryContainer.querySelector('[data-slide-active="true"]')) {
            measure(shouldAnimate, shouldCenterScroll);
          }
        });
      }
      if (lastRectRef.current.opacity === 0) return;
      lastRectRef.current = { ...lastRectRef.current, opacity: 0 };
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

    if (width === 0 || height === 0) {
      if (typeof requestAnimationFrame !== 'undefined') {
        if (retryRafRef.current) cancelAnimationFrame(retryRafRef.current);
        retryRafRef.current = requestAnimationFrame(() => {
          retryRafRef.current = 0;
          measure(shouldAnimate, shouldCenterScroll);
        });
      }
      return;
    }

    const prev = lastRectRef.current;
    const wasVisible = prev.opacity === 1;
    const sameRect =
      wasVisible &&
      prev.left === left &&
      prev.top === top &&
      prev.width === width &&
      prev.height === height;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const isAnimating = now < animatingUntilRef.current;

    // Evita que ResizeObserver (p. ej. al aparecer/desaparecer el scrollbar entre pestañas)
    // aborte una transición en curso o sobrescriba el estilo si las coordenadas no cambiaron.
    if (!shouldAnimate && (sameRect || isAnimating)) {
      if (!sameRect && isAnimating) {
        lastRectRef.current = { opacity: 1, left, top, width, height };
        setPillStyle((curr) => ({
          ...curr,
          opacity: 1,
          transform: `translate3d(${left}px, ${top}px, 0px)`,
          width: `${width}px`,
          height: `${height}px`,
        }));
      }
      return;
    }

    // Si la píldora aún no era visible (primer pintado o contenedor recién mostrado), posicionar sin deslizar desde (0,0)
    const canSlide = shouldAnimate && wasVisible;
    const distance = Math.hypot(left - prev.left, top - prev.top);
    const durationMs = canSlide
      ? Math.min(440, Math.max(280, Math.round(245 + distance * 0.34)))
      : 0;

    if (canSlide) {
      animatingUntilRef.current = now + durationMs + 50;
    } else if (!isAnimating) {
      animatingUntilRef.current = 0;
    }

    lastRectRef.current = { opacity: 1, left, top, width, height };

    setPillStyle({
      opacity: 1,
      transform: `translate3d(${left}px, ${top}px, 0px)`,
      width: `${width}px`,
      height: `${height}px`,
      transition: canSlide ? buildTransition(durationMs) : 'none',
      willChange: 'transform, width',
    });

    if (!canSlide && typeof requestAnimationFrame !== 'undefined') {
      if (armRafRef.current) cancelAnimationFrame(armRafRef.current);
      armRafRef.current = requestAnimationFrame(() => {
        armRafRef.current = 0;
        setPillStyle((curr) =>
          curr.opacity === 1 && curr.transition === 'none'
            ? { ...curr, transition: buildTransition(300) }
            : curr
        );
      });
    }

    if (shouldCenterScroll && container.scrollWidth > container.clientWidth + 2) {
      const targetLeft = left - container.clientWidth / 2 + width / 2;
      container.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: 'smooth',
      });
    }
  }, []);

  useLayoutEffect(() => {
    const container = containerNode;
    if (!container) return;

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        measure(false, false);
      });
      ro.observe(container);
    }

    let mo = null;
    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(() => {
        measure(false, false);
      });
      mo.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-slide-active', 'class', 'style'],
      });
    }

    // Measure on mount
    const hadVisiblePill = lastRectRef.current.opacity === 1;
    measure(hadVisiblePill, false);

    return () => {
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
    };
  }, [containerNode, measure]);

  useLayoutEffect(() => {
    const isInitial = !hasMountedRef.current;
    const keyChanged = prevKeyRef.current !== activeKey;
    prevKeyRef.current = activeKey;

    if (containerNode) {
      measure(!isInitial && keyChanged, !isInitial && keyChanged);
    }

    if (isInitial && containerNode) {
      const raf = requestAnimationFrame(() => {
        hasMountedRef.current = true;
      });
      return () => cancelAnimationFrame(raf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, containerNode, measure, ...deps]);

  return { containerRef, pillStyle };
}

