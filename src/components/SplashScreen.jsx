import React, { useEffect } from 'react';

/**
 * SplashScreen Controller
 * Controla la transición de salida suave del Splash Screen institucional
 * que se renderiza directamente en index.html fuera de #root (0ms latency, sin glitches ni flash blanco).
 */
export default function SplashScreen({ minDuration = 1100, onFinished }) {
  useEffect(() => {
    const splash = document.getElementById('upn-boot-splash');
    if (!splash) {
      if (onFinished) onFinished();
      return;
    }

    const timer = setTimeout(() => {
      // Iniciar desvanecimiento cinematográfico ultra suave
      splash.style.transition = 'opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1), transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)';
      splash.style.opacity = '0';
      splash.style.transform = 'scale(1.02)';
      splash.style.pointerEvents = 'none';

      // Una vez desvanecido, restaurar el fondo del tema (si fuera light) y remover el nodo
      const removeTimer = setTimeout(() => {
        try {
          const isDark = document.documentElement.classList.contains('dark');
          document.documentElement.style.backgroundColor = isDark ? '#000000' : '';
          document.body.style.backgroundColor = isDark ? '#000000' : '';
          if (splash && splash.parentNode) {
            splash.parentNode.removeChild(splash);
          }
        } catch (_) {}
        if (onFinished) onFinished();
      }, 680);

      return () => clearTimeout(removeTimer);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration, onFinished]);

  return null;
}
