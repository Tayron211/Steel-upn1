import { App } from '@capacitor/app';
import { registerPlugin } from '@capacitor/core';
import { isCapacitorNative } from './statusBarHelper';

export const APP_CURRENT_VERSION = '1.0.125';
export const APP_CURRENT_BUILD = 126;

export const AppInstaller = registerPlugin('AppInstaller');

function parseVersionNumbers(v) {
  return String(v || '0')
    .replace(/[^0-9.]/g, '')
    .split('.')
    .map(n => parseInt(n, 10) || 0);
}

function isRemoteVersionNewer(localVer, localBuild, remoteVer, remoteBuild) {
  const rBuild = parseInt(remoteBuild, 10) || 0;
  const lBuild = parseInt(localBuild, 10) || 0;

  if (rBuild > lBuild) return true;
  if (rBuild < lBuild && lBuild > 0) return false;

  const [lMaj, lMin, lPat] = parseVersionNumbers(localVer);
  const [rMaj, rMin, rPat] = parseVersionNumbers(remoteVer);

  if (rMaj > lMaj) return true;
  if (rMaj === lMaj && rMin > lMin) return true;
  if (rMaj === lMaj && rMin === lMin && rPat > lPat) return true;

  return false;
}

export async function checkAppVersion(isManual = false) {
  try {
    // Los popups y chequeos de actualización SOLO operan en la app APK nativa (Android)
    // En navegadores web (PC o móvil) no se muestra ningún popup
    if (!isCapacitorNative()) {
      return null;
    }

    let localVersion = APP_CURRENT_VERSION;
    let localBuild = APP_CURRENT_BUILD;

    if (isCapacitorNative()) {
      try {
        const info = await App.getInfo();
        if (info) {
          localVersion = info.version || localVersion;
          localBuild = parseInt(info.build, 10) || localBuild;
        }
      } catch (e) {
        console.warn('[UpdateChecker] Could not read native App.getInfo():', e);
      }
    }

    // Always fetch fresh version metadata from server (absolute URL to avoid localhost in native APK)
    const endpoint = `https://control-doc.pages.dev/version.json?_t=${Date.now()}`;
    const res = await fetch(endpoint, { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data || !data.version) return null;

    const isNewer = isRemoteVersionNewer(localVersion, localBuild, data.version, data.versionCode);

    const updateInfo = {
      isAvailable: isNewer,
      isNative: isCapacitorNative(),
      currentVersion: localVersion,
      currentBuild: localBuild,
      latestVersion: data.version,
      latestBuild: data.versionCode || 1,
      releaseDate: data.releaseDate || '',
      notes: data.notes || 'Mejoras de rendimiento y estabilidad.',
      features: Array.isArray(data.features) ? data.features : [],
      apkUrl: data.apkUrl || 'https://control-doc.pages.dev/control-doc.apk',
      forceUpdate: Boolean(data.forceUpdate)
    };

    // El popup emergente SOLO se dispara dentro de la APK nativa (Android)
    if (isNewer && isCapacitorNative() && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('upn:app-update-available', {
        detail: updateInfo
      }));
    }

    return updateInfo;
  } catch (err) {
    console.warn('[UpdateChecker] Error checking for app updates:', err);
    return null;
  }
}

export function initAppUpdateChecker() {
  // El popup y chequeo de actualización solo opera en la app nativa (APK Android)
  if (!isCapacitorNative()) {
    return () => {};
  }

  // Check 3 seconds after launch
  const initialTimer = setTimeout(() => {
    checkAppVersion(false);
  }, 3000);

  // Periodic check every 5 minutes
  const interval = setInterval(() => {
    checkAppVersion(false);
  }, 5 * 60 * 1000);

  return () => {
    clearTimeout(initialTimer);
    clearInterval(interval);
  };
}

export async function triggerDirectApkInstall(apkUrl = 'https://control-doc.pages.dev/control-doc.apk', onProgress = null) {
  if (isCapacitorNative()) {
    try {
      if (typeof onProgress === 'function' && AppInstaller?.addListener) {
        await AppInstaller.addListener('downloadProgress', (data) => {
          onProgress(data);
        });
      }

      const res = await AppInstaller.installApk({ url: apkUrl });
      return { success: true, method: 'native', detail: res };
    } catch (e) {
      console.warn('[AppInstaller] Native AppInstaller error, fallback to system download:', e);
    }
  }

  // Fallback para navegador web o escritorio
  try {
    const a = document.createElement('a');
    a.href = apkUrl;
    a.setAttribute('download', 'control-doc.apk');
    a.setAttribute('target', '_blank');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { success: true, method: 'browser' };
  } catch (err) {
    window.open(apkUrl, '_blank');
    return { success: true, method: 'window.open' };
  }
}
