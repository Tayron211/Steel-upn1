import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { isCapacitorNative } from './statusBarHelper';

export const CLASS_BLOCKS = [
  { id: 1, start: '07:30', end: '09:10', startMins: 7 * 60 + 30, label: '07:30 - 09:10' },
  { id: 2, start: '09:10', end: '10:50', startMins: 9 * 60 + 10, label: '09:10 - 10:50' },
  { id: 3, start: '10:50', end: '12:30', startMins: 10 * 60 + 50, label: '10:50 - 12:30' },
  { id: 4, start: '12:30', end: '14:30', startMins: 12 * 60 + 30, label: '12:30 - 14:30' },
  { id: 5, start: '14:30', end: '16:10', startMins: 14 * 60 + 30, label: '14:30 - 16:10' },
  { id: 6, start: '16:10', end: '17:50', startMins: 16 * 60 + 10, label: '16:10 - 17:50' },
  { id: 7, start: '17:50', end: '19:30', startMins: 17 * 60 + 50, label: '17:50 - 19:30' },
  { id: 8, start: '19:30', end: '21:10', startMins: 19 * 60 + 30, label: '19:30 - 21:10' },
  { id: 9, start: '21:10', end: '22:50', startMins: 21 * 60 + 10, label: '21:10 - 22:50' }
].map(b => ({
  ...b,
  notifyMins: b.startMins - 15
}));

// Horas intermedias de ronda para alarmas nativas en segundo plano (Android)
export const MIDPOINT_REMINDERS = [
  { id: 101, time: '08:35', mins: 8 * 60 + 35, label: '07:30 - 09:10' },
  { id: 102, time: '09:05', mins: 9 * 60 + 5, label: '07:30 - 10:40' },
  { id: 103, time: '10:00', mins: 10 * 60, label: '09:10 - 10:50' },
  { id: 104, time: '11:40', mins: 11 * 60 + 40, label: '10:50 - 12:30' },
  { id: 105, time: '13:30', mins: 13 * 60 + 30, label: '12:30 - 14:30' },
  { id: 106, time: '15:20', mins: 15 * 60 + 20, label: '14:30 - 16:10' },
  { id: 107, time: '17:00', mins: 17 * 60, label: '16:10 - 17:50' },
  { id: 108, time: '18:40', mins: 18 * 60 + 40, label: '17:50 - 19:30' },
  { id: 109, time: '20:20', mins: 20 * 60 + 20, label: '19:30 - 21:10' },
  { id: 110, time: '22:00', mins: 22 * 60, label: '21:10 - 22:50' }
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
  } catch (_) { }
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
 * Programa las notificaciones locales en Android para los próximos cambios de horario
 * y recordatorios en la mitad de cada ronda docente.
 */
async function scheduleNativeAlarms() {
  if (!isCapacitorNative()) return;

  try {
    // 1. Configurar canal de máxima prioridad
    await LocalNotifications.createChannel({
      id: 'upn_cambio_clases',
      name: 'Control y Rondas UPN',
      description: 'Alertas prioritarias 15 min antes de inicio y a mitad de cada ronda docente',
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
    } catch (_) { }

    const now = new Date();
    const notificationsToSchedule = [];

    // 3. Programación explícita para los próximos 7 días completos
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      // 3.1. Alertas 15 minutos antes de cada bloque
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
            title: `🔔 Próximo Turno en 15 min (${block.start})`,
            body: `El bloque ${block.label} inicia en 15 minutos. Revisa las aulas asignadas y ronda docente.`,
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

      // 3.2. Recordatorios a mitad de ronda (para verificar aulas pendientes)
      for (const mid of MIDPOINT_REMINDERS) {
        const midDate = new Date();
        midDate.setDate(now.getDate() + dayOffset);
        midDate.setHours(Math.floor(mid.mins / 60));
        midDate.setMinutes(mid.mins % 60);
        midDate.setSeconds(0);
        midDate.setMilliseconds(0);

        if (midDate.getTime() > now.getTime()) {
          notificationsToSchedule.push({
            id: (dayOffset + 1) * 10000 + mid.id,
            title: `⚠️ Recordatorio: Mitad de Ronda (${mid.time})`,
            body: `Mitad del turno ${mid.label}. Ingresa a la app para revisar si tienes aulas pendientes de marcar Puntual, Tarde o Falta.`,
            schedule: {
              at: midDate,
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
  } catch (_) { }
}

/**
 * Disparador de notificación inmediata para Web / iOS WebApp / Desktop (Windows 10 y 11)
 */
function fireWebNotification(block) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    playNotificationChime();

    const title = `🔔 Próximo Turno en 15 min (${block.start})`;
    const options = {
      body: `El bloque ${block.label} inicia en 15 minutos. Revisa las aulas asignadas y ronda docente.`,
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
        name: 'Control y Rondas UPN',
        description: 'Alertas prioritarias 15 min antes y a mitad de cada ronda',
        importance: 5,
        visibility: 1,
        vibration: true
      });
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 99999,
            title: '🔔 UPN Control Docente · Alerta Activa',
            body: '¡Notificaciones funcionando en tu teléfono! Recibirás avisos 15 min antes y a mitad de ronda si hay aulas pendientes.',
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
      body: '¡Notificaciones activadas! Recibirás avisos 15 min antes y a mitad de ronda si hay aulas pendientes.',
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
 * Revisa el reloj cada 20 segundos para verificar si estamos a 15 minutos del próximo bloque
 */
function checkScheduleTick() {
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  for (const block of CLASS_BLOCKS) {
    // Si estamos en la ventana de 15 a 0 minutos antes del inicio y no se ha notificado hoy
    const diff = block.startMins - currentMins;
    if (diff > 0 && diff <= 15 && !hasBeenNotifiedToday(block.id)) {
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

// Cache de asistencia de hoy para verificación rápida de hora intermedia sin sobrecargar la API
let cachedTodayAttendance = [];
let lastAttendanceFetchTs = 0;

async function getTodayAttendanceData() {
  const now = Date.now();
  if (cachedTodayAttendance.length > 0 && (now - lastAttendanceFetchTs < 35000)) {
    return cachedTodayAttendance;
  }
  try {
    const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    const today = days[new Date().getDay()];
    const res = await fetch(`/api/attendance?dia=${today}`);
    if (res.ok) {
      const json = await res.json();
      if (json?.data) {
        cachedTodayAttendance = json.data;
        lastAttendanceFetchTs = now;
        return cachedTodayAttendance;
      }
    }
  } catch (_) {}
  return cachedTodayAttendance;
}

/**
 * Chequeo de hora intermedia en cada ronda (ej: 07:30 a 10:30, mitad ~09:00).
 * Detecta si hay aulas que aún no han sido registradas (pendientes)
 * y emite una alerta sonora y notificación para recordar completarlas.
 */
async function checkMidpointPendingAttendance() {
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  const data = await getTodayAttendanceData();
  if (!data || data.length === 0) return;

  // Obtener usuario autenticado y su asignación de pabellón y pisos
  let assignedPab = '';
  let assignedPisos = [];
  try {
    const userRaw = localStorage.getItem('steel_auth_user');
    const u = userRaw ? JSON.parse(userRaw) : null;
    const assRaw = localStorage.getItem('steel_user_assignments');
    const ass = assRaw ? JSON.parse(assRaw) : {};
    const myAss = u?.username ? ass[u.username.toLowerCase()] : null;
    assignedPab = myAss?.pabellon || u?.assignedPabellon || '';
    assignedPisos = (myAss?.pisos && myAss.pisos.length > 0) ? myAss.pisos : (u?.assignedPisos || []);
  } catch (_) {}

  // Agrupar clases activas por bloque (hora_inicio_prog - hora_final_prog)
  const activeSchedules = new Map();

  data.forEach(item => {
    const ini = item.horaInicioProg;
    const fin = item.horaFinalProg;
    if (!ini || !fin) return;
    const [hI, mI] = ini.split(':').map(Number);
    const [hF, mF] = fin.split(':').map(Number);
    const iniMins = hI * 60 + mI;
    const finMins = hF * 60 + mF;

    // Verificar si la clase está actualmente en curso
    if (currentMins >= iniMins && currentMins <= finMins) {
      const key = `${ini}-${fin}`;
      if (!activeSchedules.has(key)) {
        activeSchedules.set(key, { ini, fin, iniMins, finMins, items: [] });
      }
      activeSchedules.get(key).items.push(item);
    }
  });

  for (const [key, group] of activeSchedules.entries()) {
    // Calcular punto medio de la ronda (ej: 07:30 - 10:30 -> mitad es 09:00)
    const midpointMins = Math.floor((group.iniMins + group.finMins) / 2);

    // Si estamos en la ventana de la mitad de la clase (desde el punto medio hasta +25 minutos)
    if (currentMins >= midpointMins && currentMins <= midpointMins + 25) {
      const todayKey = getTodayKey();
      const notifyStorageKey = `upn_midpoint_pending_${todayKey}_${key}`;
      if (localStorage.getItem(notifyStorageKey) === '1') {
        continue; // Ya notificado para este bloque hoy
      }

      // Filtrar aulas según la asignación del usuario (o todas si no tiene asignación)
      let targetItems = group.items;
      if (assignedPab) {
        targetItems = targetItems.filter(it => {
          const pp = (it.pisoPabellon || '').toUpperCase();
          const aula = (it.aula || '').toUpperCase();
          return pp.includes(`- ${assignedPab}`) || aula.startsWith(assignedPab);
        });
      }
      if (assignedPisos.length > 0) {
        targetItems = targetItems.filter(it => {
          const pp = (it.pisoPabellon || '').toUpperCase();
          return assignedPisos.some(p => pp.includes(p.toUpperCase()));
        });
      }

      // Buscar clases que aún no tienen registro (pendientes de marcar puntual, tarde o falta)
      const pendingItems = targetItems.filter(it => {
        const asis = String(it.asistencia || '').trim().toUpperCase();
        return !asis || asis === 'PENDIENTE' || asis === 'NULL' || asis === '#N/D';
      });

      if (pendingItems.length > 0) {
        localStorage.setItem(notifyStorageKey, '1');

        const pendingCount = pendingItems.length;
        const sampleAulas = pendingItems.slice(0, 4).map(it => it.aula).join(', ');
        const aulasText = pendingCount > 4 ? `${sampleAulas} y ${pendingCount - 4} más` : sampleAulas;

        const title = `⚠️ Aulas pendientes de registrar (${group.ini} - ${group.fin})`;
        const body = `Mitad de turno: Tienes ${pendingCount} aula(s) pendientes de registrar (${aulasText}). ¡Recuerda marcar Puntual, Tarde o Falta!`;

        // 1. Android Nativo APK
        if (isCapacitorNative()) {
          try {
            LocalNotifications.schedule({
              notifications: [
                {
                  id: 3000 + Math.floor(Math.random() * 800),
                  title,
                  body,
                  channelId: 'upn_cambio_clases',
                  smallIcon: 'ic_stat_notify',
                  iconColor: '#FDBA30',
                  schedule: { at: new Date(Date.now() + 500) }
                }
              ]
            }).catch(() => {});
          } catch (_) {}
        } else {
          // 2. Web Notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(title, {
                body,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: `upn_midpoint_${key}`
              });
            } catch (_) {}
          }
        }

        playNotificationChime();

        // 3. Evento visual dentro de la aplicación
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('upn:pending-attendance-alert', {
            detail: {
              pendingCount,
              aulas: aulasText,
              block: `${group.ini} - ${group.fin}`,
              items: pendingItems
            }
          }));
        }
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
          checkScheduleTick();
          checkMidpointPendingAttendance();
        }
      }).then(handle => { appStateListener = handle; }).catch(() => { });
    } catch (_) { }
  }

  const handleVisibility = () => {
    if (typeof document !== 'undefined' && !document.hidden && isCapacitorNative()) {
      scheduleNativeAlarms();
      checkScheduleTick();
      checkMidpointPendingAttendance();
    }
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
  }

  // 3. Programar chequeo periódico en primer plano (cada 20 segundos)
  const interval = setInterval(() => {
    checkScheduleTick();
    checkMidpointPendingAttendance();
  }, 20000);

  checkScheduleTick();
  checkMidpointPendingAttendance();

  return () => {
    clearInterval(interval);
    if (appStateListener?.remove) appStateListener.remove();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility);
    }
  };
}
