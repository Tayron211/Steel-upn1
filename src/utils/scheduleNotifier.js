import { LocalNotifications } from '@capacitor/local-notifications';
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
      const res = await LocalNotifications.requestPermissions();
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
 * Programa las notificaciones locales en Android para los próximos cambios de horario de hoy.
 */
async function scheduleNativeAlarms() {
  if (!isCapacitorNative()) return;

  try {
    // Configurar canal de alta prioridad con sonido y vibración en Android
    await LocalNotifications.createChannel({
      id: 'upn_cambio_clases',
      name: 'Cambio de Clases UPN',
      description: 'Alertas 10 minutos antes del inicio de cada bloque horario',
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: 'beep.wav'
    });

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const pending = [];
    for (const block of CLASS_BLOCKS) {
      if (block.notifyMins > currentMins) {
        const notifDate = new Date();
        notifDate.setHours(Math.floor(block.notifyMins / 60));
        notifDate.setMinutes(block.notifyMins % 60);
        notifDate.setSeconds(0);
        notifDate.setMilliseconds(0);

        pending.push({
          id: 1000 + block.id,
          title: `🔔 Próximo Turno en 10 min (${block.start})`,
          body: `El bloque ${block.label} inicia en 10 minutos. Revisa las aulas asignadas y ronda docente.`,
          schedule: { at: notifDate, allowWhileIdle: true },
          channelId: 'upn_cambio_clases',
          smallIcon: 'ic_launcher_round'
        });
      }
    }

    if (pending.length > 0) {
      await LocalNotifications.schedule({ notifications: pending });
    }
  } catch (err) {
    console.warn('[Notifier] Error scheduling native notifications:', err);
  }
}

/**
 * Disparador de notificación inmediata para Web / iOS WebApp / Desktop
 */
function fireWebNotification(block) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const title = `🔔 Próximo Turno en 10 min (${block.start})`;
    const options = {
      body: `El bloque ${block.label} inicia en 10 minutos. Revisa las aulas asignadas y ronda docente.`,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `upn_shift_${block.id}`,
      renotify: true,
      requireInteraction: true
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, options);
      }).catch(() => {
        new Notification(title, options);
      });
    } else {
      new Notification(title, options);
    }
  } catch (err) {
    console.warn('[Notifier] Error showing web notification:', err);
  }
}

/**
 * Revisa el reloj cada 20 segundos para verificar si estamos a 10 minutos del próximo bloque
 */
function checkScheduleTick() {
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  for (const block of CLASS_BLOCKS) {
    // Si estamos en la ventana de 10 a 8 minutos antes del inicio y no se ha notificado hoy
    const diff = block.startMins - currentMins;
    if (diff > 0 && diff <= 10 && !hasBeenNotifiedToday(block.id)) {
      markNotifiedToday(block.id);
      fireWebNotification(block);

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
  // 1. Pedir permisos si aún no se han concedido
  requestNotificationPermission().then((granted) => {
    if (granted && isCapacitorNative()) {
      scheduleNativeAlarms();
    }
  });

  // 2. Programar chequeo periódico en background / foreground
  const interval = setInterval(checkScheduleTick, 20000);
  checkScheduleTick();

  return () => clearInterval(interval);
}
