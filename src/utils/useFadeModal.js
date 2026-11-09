import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useFadeModal
 * Hook to manage silky-smooth enter AND exit fade animations for any modal, dialog, drawer or popup.
 *
 * @param {boolean|any} isOpen - Whether modal is open (boolean or item object)
 * @param {Function} [onClose] - Callback when modal is fully closed
 * @param {number} [duration=200] - Duration of exit fade animation in ms
 */
export function useFadeModal(isOpen, onClose, duration = 200) {
  const [shouldRender, setShouldRender] = useState(Boolean(isOpen));
  const [isClosing, setIsClosing] = useState(false);
  const [cachedData, setCachedData] = useState(isOpen || null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (Boolean(isOpen)) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setCachedData(isOpen);
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender && !isClosing) {
      setIsClosing(true);
      timerRef.current = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
        setCachedData(null);
      }, duration);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen, duration]);

  const requestClose = useCallback((callback) => {
    if (isClosing) return;
    setIsClosing(true);
    timerRef.current = setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
      setCachedData(null);
      if (callback) callback();
      if (onClose) onClose();
    }, duration);
  }, [isClosing, onClose, duration]);

  return {
    shouldRender,
    isClosing,
    cachedData: cachedData || isOpen,
    requestClose,
    backdropClass: isClosing ? 'animate-backdrop-fade-out pointer-events-none' : 'animate-backdrop-fade',
    modalClass: isClosing ? 'animate-modal-fade-out pointer-events-none' : 'animate-modal-fade',
    dropdownClass: isClosing ? 'animate-dropdown-fade-out pointer-events-none' : 'animate-dropdown-fade',
  };
}

