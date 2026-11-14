import { App } from '@capacitor/app';
import { isCapacitorNative } from './statusBarHelper';

export const APP_CURRENT_VERSION = '1.0.0';
export const APP_CURRENT_BUILD = 1;

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

export async function checkAppVersion() {
  try {
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

    // Always fetch fresh version metadata from server
    const endpoint = `/version.json?_t=${Date.now()}`;
    const res = await fetch(endpoint, { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data || !data.version) return null;

    const isNewer = isRemoteVersionNewer(localVersion, localBuild, data.version, data.versionCode);

    const updateInfo = {
      isAvailable: isNewer,
      currentVersion: localVersion,
      currentBuild: localBuild,
      latestVersion: data.version,
      latestBuild: data.versionCode || 1,
      releaseDate: data.releaseDate || '',
      notes: data.notes || 'Mejoras de rendimiento y estabilidad.',
      apkUrl: data.apkUrl || 'https://control-doc.pages.dev/control-doc.apk',
      forceUpdate: Boolean(data.forceUpdate)
    };

    if (isNewer && typeof window !== 'undefined') {
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
  // Check 3 seconds after launch
  const initialTimer = setTimeout(() => {
    checkAppVersion();
  }, 3000);

  // Periodic check every 5 minutes
  const interval = setInterval(() => {
    checkAppVersion();
  }, 5 * 60 * 1000);

  return () => {
    clearTimeout(initialTimer);
    clearInterval(interval);
  };
}
