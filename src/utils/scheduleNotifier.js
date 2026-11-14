import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { isCapacitorNative } from './statusBarHelper';

export const CLASS_BLOCKS = [
  { id: 1, start: '07:30', end: '09:10', startMins: 7 * 60 + 30, notifyMins: 7 * 60 + 20, label: '07:30 - 09:10' },
  { id: 2, start: '09:10', end: '10:50', startMins: 9 * 60 + 10, notifyMins: 9 * 60 + 0,  label: '09:10 - 10:50' },
  { id: 3, start: '10:50', end: '12:30', startMins: 10 * 60 + 50, notifyMins: 10 * 60 + 40, label: '10:50 - 12:30' },
  { id: 4, start: '12:30', end: '14:30', startMins: 12 * 60 + 30, notifyMins: 12 * 60 + 20, label: '12:30 - 14:30' },
  { id: 5, start: '14:30', end: '16:10', startMins: 14 * 60 + 30, notifyMins: 14 * 60 + 20, label: '14:30 - 16:10' },
  { id: 6, start: '16:10', end: '17:50', startMins: 16 * 60 + 10, notifyMins: 16 * 60 + 0,  label: '16:10 - 17:50' },
  { id: 7, start: '17:50', end: '19:30', startMins: 17 * 60 + 50, notifyMins: 17 * 60 + 40, label: '17:50 - 19:30' },
  { id: 8, start: '19:30', end: '21:10', startMins: 19 * 60 + 30, notifyMins: 19 * 60 + 20, label: '19:30 - 21:10' },
  { id: 9, start: '21:10', end: '22:50', startMins: 21 * 60 + 10, notifyMins: 21 * 60 + 0,  label: '21:10 - 22:50' }
];

const NOTIFIED_KEY_PREFIX = 'upn_notified_';

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function hasBeenNotifiedToday(blockId) {
  try {
    const key = `${NOTIFIED_KEY_PREFIX}${getTodayKey()}_block_${blockId}`;
    return localStorage.getItem(key) === '1';
  } catch (_) {
    return false;
  }
}

function markNotifiedToday(blockId) {
  try {
    const key = `${NOTIFIED_KEY_PREFIX}${getTodayKey()}_block_${blockId}`;
    localStorage.setItem(key, '1');
  } catch (_) {}
}

/**
 * Solicita permisos de notificación tanto en Android Nativo (Capacitor) como en Web/iOS PWA.
 */
export async function requestNotificationPermission() {
  if (isCapacitorNative()) {
    try {
      let res = await LocalNotifications.checkPermissions();
      if (res.display !== 'granted') {
        res = await LocalNotifications.requestPermissions();
      }
      return res.display === 'granted';
    } catch (err) {
      console.warn('[Notifier] LocalNotifications permission error:', err);
      return false;
    }
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    } catch (err) {
      console.warn('[Notifier] Web Notification permission error:', err);
      return false;
    }
  }

  return false;
}

/**
 * Programa las notificaciones locales en Android para los próximos cambios de horario.
 * Soporta ejecución 100% autónoma en segundo plano y con la app cerrada:
 * 1. Canal de alta prioridad (IMPORTANCE_HIGH = 5) con sonido, vibración y heads-up banner.
 * 2. Alarmas exactas con allowWhileIdle: true que despiertan el procesador en Doze mode.
 * 3. Cobertura completa: programación para los próximos 7 días continuos.
 */
async function scheduleNativeAlarms() {
  if (!isCapacitorNative()) return;

  try {
    // 1. Configurar canal de máxima prioridad
    await LocalNotifications.createChannel({
      id: 'upn_cambio_clases',
      name: 'Cambio de Clases UPN',
      description: 'Alertas prioritarias 10 minutos antes del inicio de cada bloque horario',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#FDBA30'
    });

    // 2. Limpiar alarmas pendientes anteriores para evitar duplicados
    try {
      const existing = await LocalNotifications.getPending();
      if (existing.notifications && existing.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: existing.notifications });
      }
    } catch (_) {}

    const now = new Date();
    const notificationsToSchedule = [];

    // 3. Programación explícita para los próximos 7 días completos
    // Esto asegura que incluso con el teléfono bloqueado o la app cerrada por días, las alertas lleguen siempre a la hora exacta
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      for (const block of CLASS_BLOCKS) {
        const notifDate = new Date();
        notifDate.setDate(now.getDate() + dayOffset);
        notifDate.setHours(Math.floor(block.notifyMins / 60));
        notifDate.setMinutes(block.notifyMins % 60);
        notifDate.setSeconds(0);
        notifDate.setMilliseconds(0);

        if (notifDate.getTime() > now.getTime()) {
          notificationsToSchedule.push({
            id: (dayOffset + 1) * 1000 + block.id,
            title: `🔔 Próximo Turno en 10 min (${block.start})`,
            body: `El bloque ${block.label} inicia en 10 minutos. Revisa las aulas asignadas y ronda docente.`,
            schedule: {
              at: notifDate,
              allowWhileIdle: true
            },
            channelId: 'upn_cambio_clases',
            smallIcon: 'ic_stat_notify',
            iconColor: '#FDBA30',
            autoCancel: true
          });
        }
      }
    }

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: notificationsToSchedule });
    }
  } catch (err) {
    console.warn('[Notifier] Error scheduling native notifications:', err);
  }
}

/**
 * Reproduce un tono de campana / chime institucional suave vía Web Audio API.
 * Funciona completamente offline y sin archivos externos en Windows 10/11, Mac y móvil.
 */
export function playNotificationChime() {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    // Tono 1 (880 Hz - Nota La5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tono 2 armónico superior (1174.66 Hz - Nota Re6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.12);
    gain2.gain.setValueAtTime(0.15, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch (_) {}
}

/**
 * Disparador de notificación inmediata para Web / iOS WebApp / Desktop (Windows 10 y 11)
 */
function fireWebNotification(block) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    playNotificationChime();

    const title = `🔔 Próximo Turno en 10 min (${block.start})`;
    const options = {
      body: `El bloque ${block.label} inicia en 10 minutos. Revisa las aulas asignadas y ronda docente.`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `upn_shift_${block.id}`,
      renotify: true,
      requireInteraction: true,
      silent: false
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, options);
      }).catch(() => {
        const notif = new Notification(title, options);
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      });
    } else {
      const notif = new Notification(title, options);
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    }
  } catch (err) {
    console.warn('[Notifier] Error showing web notification:', err);
  }
}

/**
 * Envía una notificación de prueba directa para verificar en Android APK o Windows/Web
 */
export async function sendTestDesktopNotification() {
  playNotificationChime();

  // 1. Android Nativo (Capacitor)
  if (isCapacitorNative()) {
    try {
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        perm = await LocalNotifications.requestPermissions();
      }
      if (perm.display !== 'granted') {
        return { success: false, reason: 'denied' };
      }
      await LocalNotifications.createChannel({
        id: 'upn_cambio_clases',
        name: 'Cambio de Clases UPN',
        description: 'Alertas 10 minutos antes del inicio de cada bloque horario',
        importance: 5,
        visibility: 1,
        vibration: true
      });
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 99999,
            title: '🔔 UPN Control Docente · Alerta Activa',
            body: '¡Notificaciones funcionando en tu teléfono! Recibirás avisos sonoros 10 min antes de cada clase.',
            channelId: 'upn_cambio_clases',
            smallIcon: 'ic_stat_notify',
            iconColor: '#FDBA30',
            schedule: { at: new Date(Date.now() + 500) }
          }
        ]
      });
      return { success: true };
    } catch (e) {
      console.warn('Local notification test error:', e);
      return { success: false, error: e.message };
    }
  }

  // 2. Web / Desktop (Windows 10/11)
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { success: false, reason: 'unsupported' };
  }

  let perm = Notification.permission;
  if (perm !== 'granted') {
    perm = await Notification.requestPermission();
  }

  if (perm !== 'granted') {
    return { success: false, reason: 'denied' };
  }

  try {
    const title = '🔔 UPN Control Docente · Alerta de Turno';
    const options = {
      body: '¡Notificaciones activadas! Recibirás avisos sonoros y en pantalla 10 min antes de cada clase.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'upn_test_alert',
      renotify: true,
      requireInteraction: false
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, options);
      }).catch(() => {
        const notif = new Notification(title, options);
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      });
    } else {
      const notif = new Notification(title, options);
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Revisa el reloj cada 20 segundos para verificar si estamos a 10 minutos del próximo bloque
 */
function checkScheduleTick() {
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  for (const block of CLASS_BLOCKS) {
    // Si estamos en la ventana de 10 a 0 minutos antes del inicio y no se ha notificado hoy
    const diff = block.startMins - currentMins;
    if (diff > 0 && diff <= 10 && !hasBeenNotifiedToday(block.id)) {
      markNotifiedToday(block.id);

      // Disparar en Android APK vía LocalNotifications
      if (isCapacitorNative()) {
        try {
          LocalNotifications.schedule({
            notifications: [
              {
                id: 2000 + block.id,
                title: `🔔 Próximo Turno en ${diff} min (${block.start})`,
                body: `El bloque ${block.label} inicia en ${diff} minutos. Revisa las aulas asignadas y ronda docente.`,
                channelId: 'upn_cambio_clases',
                schedule: { at: new Date(Date.now() + 500) }
              }
            ]
          }).catch(e => console.warn('Native notification tick error:', e));
        } catch (err) {
          console.warn('Native schedule tick exception:', err);
        }
      } else {
        fireWebNotification(block);
      }

      playNotificationChime();

      // Despachar evento para Toast / Banner visual en la interfaz de la app
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('upn:class-block-warning', {
          detail: { block, diff }
        }));
      }
    }
  }
}

/**
 * Inicializa el sistema de notificaciones en el ciclo de vida de la aplicación
 */
export function initScheduleNotifier() {
  // 1. Pedir permisos si aún no se han concedido y programar alarmas nativas
  requestNotificationPermission().then((granted) => {
    if (granted && isCapacitorNative()) {
      scheduleNativeAlarms();
    }
  });

  // 2. Re-verificar y re-programar automáticamente cada vez que el usuario regresa a la app
  let appStateListener = null;
  if (isCapacitorNative()) {
    try {
      App.addListener('appStateChange', (state) => {
        if (state.isActive) {
          scheduleNativeAlarms();
        }
      }).then(handle => { appStateListener = handle; }).catch(() => {});
    } catch (_) {}
  }

  const handleVisibility = () => {
    if (typeof document !== 'undefined' && !document.hidden && isCapacitorNative()) {
      scheduleNativeAlarms();
    }
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
  }

  // 3. Programar chequeo periódico en primer plano
  const interval = setInterval(checkScheduleTick, 20000);
  checkScheduleTick();

  return () => {
    clearInterval(interval);
    if (appStateListener?.remove) appStateListener.remove();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility);
    }
  };
}
