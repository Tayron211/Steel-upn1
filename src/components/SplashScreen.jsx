import React, { useEffect } from 'react';
import { hideSplashScreenSmoothly } from '../utils/statusBarHelper';

/**
 * SplashScreen Controller
 * Controla la transición de salida suave del Splash Screen institucional
 * y la aparición cinematográfica tipo fade suave de la interfaz (sin golpes bruscos).
 */
export default function SplashScreen({ minDuration = 1800, onFinished }) {
  useEffect(() => {
    // Si estamos en entorno nativo Capacitor (Android APK), desvanecer el splash nativo suavemente
    hideSplashScreenSmoothly().catch(() => {});

    const splash = document.getElementById('upn-boot-splash');
    const root = document.getElementById('root');

    const makeInterfaceVisible = () => {
      if (root) {
        root.classList.add('app-ready');
      }
    };

    if (!splash) {
      makeInterfaceVisible();
      if (onFinished) onFinished();
      return;
    }

    const timer = setTimeout(() => {
      // 1. Iniciar aparición fluida con transición fade suave de la interfaz
      makeInterfaceVisible();

      // 2. Iniciar desvanecimiento cinematográfico ultra suave 120fps del splash con curva simétrica
      splash.style.transition = 'opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1)';
      splash.style.opacity = '0';
      splash.style.pointerEvents = 'none';

      // 3. Una vez completado el fade cruzado, remover el nodo
      const removeTimer = setTimeout(() => {
        try {
          if (splash && splash.parentNode) {
            splash.parentNode.removeChild(splash);
          }
        } catch (_) {}
        if (onFinished) onFinished();
      }, 750);

      return () => clearTimeout(removeTimer);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration, onFinished]);

  return null;
}
