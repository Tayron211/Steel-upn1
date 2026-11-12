import React, { useState, useEffect, useRef } from 'react';

/**
 * FadeCollapse
 * Envuelve cualquier sub-panel, bloque plegable o menú desplegable para que tanto
 * al abrir (despliegue) como al cerrar (pliegue) realice una transición fade suave.
 */
export function FadeCollapse({ show, duration = 220, className = '', children }) {
  const isOpen = Boolean(show);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [expanded, setExpanded] = useState(isOpen);
  const timerRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (isOpen) {
      setShouldRender(true);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setExpanded(true);
        });
      });
    } else if (shouldRender) {
      setExpanded(false);
      timerRef.current = setTimeout(() => {
        setShouldRender(false);
      }, duration);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isOpen, duration]);

  if (!shouldRender) return null;

  return (
    <div
      style={{ transitionDuration: `${duration}ms` }}
      className={`grid transition-[grid-template-rows,opacity] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
      } ${className}`}
    >
      <div className="overflow-hidden min-w-0">{children}</div>
    </div>
  );
}

/**
 * FadeDropdown
 * Envuelve menús flotantes absolutos (ej. opciones de tarjeta) para asegurar fade-in y fade-out suave.
 */
export function FadeDropdown({ show, duration = 180, className = '', onClick, children }) {
  const isOpen = Boolean(show);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
      timerRef.current = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, duration);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen, duration]);

  if (!shouldRender) return null;

  return (
    <div
      onClick={onClick}
      className={`${className} ${isClosing ? 'animate-dropdown-fade-out pointer-events-none' : 'animate-dropdown-fade'}`}
    >
      {children}
    </div>
  );
}

