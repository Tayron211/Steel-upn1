import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export function isCapacitorNative() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    Capacitor.isNativePlatform() || 
    window.Capacitor?.isNativePlatform?.() || 
    window.Capacitor?.getPlatform?.() === 'android'
  );
}

export async function applyAdaptiveStatusBar(isDark) {
  // 1. Capacitor Native Android / iOS
  if (isCapacitorNative()) {
    try {
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setBackgroundColor({ color: '#00000000' });
      await StatusBar.setStyle({
        style: isDark ? Style.Dark : Style.Light
      });
    } catch (e) {
      console.warn('[StatusBar] Capacitor StatusBar update failed:', e);
    }
  }

  // 2. Web & PWA (iOS Safari / Android Chrome)
  if (typeof document !== 'undefined') {
    const bgHex = isDark ? '#09090B' : '#FFFFFF';
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute('content', bgHex);

    let metaApple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!metaApple) {
      metaApple = document.createElement('meta');
      metaApple.name = 'apple-mobile-web-app-status-bar-style';
      document.head.appendChild(metaApple);
    }
    metaApple.setAttribute('content', 'black-translucent');
  }
}

export async function hideSplashScreenSmoothly() {
  if (isCapacitorNative()) {
    try {
      await SplashScreen.hide({ fadeOutDuration: 400 });
    } catch (_) {}
  }
}
