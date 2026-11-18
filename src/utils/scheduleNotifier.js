import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { isCapacitorNative } from './statusBarHelper';
import { AppInstaller } from './appUpdateChecker';
import { getAuthUser, getUserAssignments } from './auth';

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
  { id: 101, time: '08:20', mins: 8 * 60 + 20, label: '07:30 - 09:10' },
  { id: 102, time: '09:05', mins: 9 * 60 + 5, label: '07:30 - 10:40' },
  { id: 103, time: '10:00', mins: 10 * 60, label: '09:10 - 10:50' },
  { id: 104, time: '11:40', mins: 11 * 60 + 40, label: '10:50 - 12:30' },
  { id: 105, time: '13:30', mins: 13 * 60 + 30, label: '12:30 - 14:30' },
  { id: 106, time: '15:05', mins: 15 * 60 + 5, label: '13:30 - 16:40' },
  { id: 107, time: '15:20', mins: 15 * 60 + 20, label: '14:30 - 16:10' },
  { id: 108, time: '17:00', mins: 17 * 60, label: '16:10 - 17:50' },
  { id: 109, time: '18:40', mins: 18 * 60 + 40, label: '17:50 - 19:30' },
  { id: 110, time: '20:15', mins: 20 * 60 + 15, label: '19:30 - 21:00' },
  { id: 111, time: '20:20', mins: 20 * 60 + 20, label: '19:30 - 21:10' },
  { id: 112, time: '21:05', mins: 21 * 60 + 5, label: '19:30 - 22:40' },
  { id: 113, time: '22:00', mins: 22 * 60, label: '21:10 - 22:50' }
];

export const UPN_NOTIF_CHANNEL_ID = 'upn_rondas_urgente';
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
 * Solicita y fuerza permisos de notificación en Android Nativo (Capacitor),
 * configurando permisos de Alarmas Exactas y Exclusión de Ahorro de Batería.
 */
export async function requestNotificationPermission() {
  if (isCapacitorNative()) {
    try {
      let res = await LocalNotifications.checkPermissions();
      if (res.display !== 'granted') {
        res = await LocalNotifications.requestPermissions();
      }

      // 1. Forzar verificación de permisos para Alarmas Exactas (Android 12+ / API 31+)
      try {
        if (typeof LocalNotifications.checkExactNotificationSetting === 'function') {
          const exactSetting = await LocalNotifications.checkExactNotificationSetting();
          if (exactSetting && exactSetting.exact_alarm !== 'granted' && typeof LocalNotifications.changeExactNotificationSetting === 'function') {
            await LocalNotifications.changeExactNotificationSetting();
          }
        }
      } catch (errExact) {
        console.warn('[Notifier] Exact alarm setting check:', errExact);
      }

      // 2. Solicitar ignorar optimización de batería para que el sistema operativo no congele las alarmas
      try {
        if (AppInstaller?.requestIgnoreBatteryOptimizations) {
          await AppInstaller.requestIgnoreBatteryOptimizations();
        }
      } catch (_) {}

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
 * Obtiene la asignación activa del usuario (pabellón y pisos).
 * Si no hay sesión activa (no autenticado), retorna null.
 */
export function getActiveAssistantAssignment() {
  const user = getAuthUser();
  if (!user) return null;
  const assignments = getUserAssignments();
  const cleanUser = String(user.username || '').toLowerCase();
  const myAss = assignments[cleanUser] || {};
  const pabellon = myAss.pabellon !== undefined ? myAss.pabellon : (user.assignedPabellon || '');
  const pisos = (Array.isArray(myAss.pisos) && myAss.pisos.length > 0) ? myAss.pisos : (user.assignedPisos || []);
  const isAdminUser = user.role === 'admin';
  return {
    user,
    pabellon: String(pabellon || '').trim().toUpperCase(),
    pisos: Array.isArray(pisos) ? pisos : [],
    isAdmin: isAdminUser
  };
}

/**
 * Determina si una clase pertenece a las aulas / pabellón / pisos asignados al usuario.
 */
export function isClassAssignedToAssistant(item, assignment) {
  if (!assignment || !assignment.user || !item) return false;

  // Si es Administrador y NO tiene restricción de pabellón ni pisos, supervisa todo el campus
  if (assignment.isAdmin && !assignment.pabellon && (!assignment.pisos || assignment.pisos.length === 0)) {
    return true;
  }

  // Si es Asistente y NO tiene asignación configurada, NO tiene aulas asignadas
  if (!assignment.isAdmin && !assignment.pabellon && (!assignment.pisos || assignment.pisos.length === 0)) {
    return false;
  }

  const itemUbi = String(item.pisoPabellon || '').toUpperCase();
  const itemAula = String(item.aula || '').toUpperCase();

  // 1. Filtrado de Pabellón
  if (assignment.pabellon) {
    const p = assignment.pabellon;
    const matchesPab = itemUbi.includes(`- ${p}`) ||
      itemUbi.includes(`PABELLÓN ${p}`) ||
      itemUbi.includes(`PABELLON ${p}`) ||
      itemUbi.includes(`PAB. ${p}`) ||
      itemAula.startsWith(p);
    if (!matchesPab) return false;
  }

  // 2. Filtrado de Pisos
  if (assignment.pisos && assignment.pisos.length > 0) {
    const matchesPiso = assignment.pisos.some(p => {
      const pUpper = String(p).toUpperCase();
      const targetDigit = pUpper.includes('1') || pUpper.includes('PRIMER') ? '1' :
        pUpper.includes('2') || pUpper.includes('SEGUNDO') ? '2' :
          pUpper.includes('3') || pUpper.includes('TERCER') ? '3' :
            pUpper.includes('4') || pUpper.includes('CUARTO') ? '4' :
              pUpper.includes('5') || pUpper.includes('QUINTO') ? '5' : '';

      if (targetDigit === '1' && (itemUbi.includes('1ER') || itemUbi.includes('PRIMER') || itemUbi.includes('PISO 1') || itemUbi.includes('1°'))) return true;
      if (targetDigit === '2' && (itemUbi.includes('2DO') || itemUbi.includes('SEGUNDO') || itemUbi.includes('PISO 2') || itemUbi.includes('2°'))) return true;
      if (targetDigit === '3' && (itemUbi.includes('3ER') || itemUbi.includes('TERCER') || itemUbi.includes('PISO 3') || itemUbi.includes('3°'))) return true;
      if (targetDigit === '4' && (itemUbi.includes('4TO') || itemUbi.includes('CUARTO') || itemUbi.includes('PISO 4') || itemUbi.includes('4°'))) return true;
      if (targetDigit === '5' && (itemUbi.includes('5TO') || itemUbi.includes('QUINTO') || itemUbi.includes('PISO 5') || itemUbi.includes('5°'))) return true;
      if (pUpper.includes('SOT') && (itemUbi.includes('SOT') || itemUbi.includes('SÓT'))) return true;

      // Si el piso_pabellon no tiene el texto, extraer dígito del aula (ej: A102 -> 1, B305 -> 3)
      if (targetDigit && /^[A-Z]\d{2,4}/.test(itemAula)) {
        const digitMatch = itemAula.match(/^[A-Z](\d)/);
        if (digitMatch && digitMatch[1] === targetDigit) return true;
      }

      return itemUbi.includes(pUpper);
    });
    if (!matchesPiso) return false;
  }

  return true;
}

/**
 * Cancela todas las notificaciones locales y alarmas programadas en el APK / dispositivo.
 */
export async function clearAllScheduledNotifications() {
  if (isCapacitorNative()) {
    // 1. Bloquear de inmediato el receptor nativo (UpnAlarmReceiver) y limpiar notificaciones mostradas
    try {
      if (AppInstaller?.setSessionActive) {
        await AppInstaller.setSessionActive({ active: false });
      }
    } catch (_) {}

    // 2. Cancelar todas las notificaciones pendientes en Capacitor LocalNotifications
    try {
      const existing = await LocalNotifications.getPending();
      if (existing.notifications && existing.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: existing.notifications.map(n => ({ id: n.id }))
        });
      }
      if (typeof LocalNotifications.removeAllDeliveredNotifications === 'function') {
        await LocalNotifications.removeAllDeliveredNotifications();
      }
    } catch (_) {}

    // 3. Cancelar alarmas exactas en AlarmManager
    try {
      if (AppInstaller?.cancelAllAlarms) {
        await AppInstaller.cancelAllAlarms();
      }
    } catch (_) {}
  }
}
if (typeof window !== 'undefined') {
  window.clearAllScheduledNotifications = clearAllScheduledNotifications;
}

/**
 * Programa las notificaciones locales en Android para los próximos cambios de horario
 * y recordatorios en la mitad de cada ronda docente de manera directa en el AlarmManager del sistema.
 * 
 * REGLAS ESTRICTAS:
 * 1. Solo se programan si la sesión está iniciada (getAuthUser() != null).
 * 2. Solo se programan para las aulas/pabellón/pisos asignados al asistente.
 */
export async function scheduleNativeAlarms() {
  if (!isCapacitorNative()) return;

  const assignment = getActiveAssistantAssignment();

  // 1. Si no hay sesión iniciada, cancelar de inmediato cualquier alarma previa y salir
  if (!assignment) {
    await clearAllScheduledNotifications();
    return;
  }

  // 2. Si es asistente y no tiene aulas/pabellón asignado, cancelar alarmas y salir
  if (!assignment.isAdmin && !assignment.pabellon && (!assignment.pisos || assignment.pisos.length === 0)) {
    await clearAllScheduledNotifications();
    return;
  }

  try {
    // 3. Limpiar alarmas pendientes anteriores para sincronizar exactamente las del asistente
    await clearAllScheduledNotifications();

    // 4. Crear canal de máxima prioridad con sonido nativo y vibración
    await LocalNotifications.createChannel({
      id: UPN_NOTIF_CHANNEL_ID,
      name: 'Alarmas de Rondas y Cambio de Turno UPN',
      description: 'Avisos prioritarios a mitad de ronda y 15 min antes de inicio de clases',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#FDBA30'
    });

    const now = new Date();
    const notificationsToSchedule = [];

    // 5. Obtener clases de HOY y filtrar estrictamente por las aulas asignadas al asistente
    let myClassesToday = [];
    try {
      const dataToday = await getTodayAttendanceData();
      if (dataToday && dataToday.length > 0) {
        myClassesToday = dataToday.filter(it => isClassAssignedToAssistant(it, assignment));
      }
    } catch (_) {}

    if (myClassesToday.length > 0) {
      const blockMap = new Map();
      myClassesToday.forEach(item => {
        const ini = item.horaInicioProg;
        const fin = item.horaFinalProg;
        if (!ini || !fin) return;
        const [hI, mI] = ini.split(':').map(Number);
        const [hF, mF] = fin.split(':').map(Number);
        if (isNaN(hI) || isNaN(mI) || isNaN(hF) || isNaN(mF)) return;
        const iniMins = hI * 60 + mI;
        const finMins = hF * 60 + mF;
        const key = `${ini}-${fin}`;
        if (!blockMap.has(key)) {
          blockMap.set(key, { ini, fin, iniMins, finMins, aulas: new Set() });
        }
        if (item.aula) blockMap.get(key).aulas.add(item.aula);
      });

      let idx = 0;
      for (const [key, b] of blockMap.entries()) {
        idx++;
        const aulasArr = Array.from(b.aulas);
        const sampleAulas = aulasArr.slice(0, 4).join(', ');
        const aulasText = aulasArr.length > 4 ? `${sampleAulas} y ${aulasArr.length - 4} más` : sampleAulas;

        // Alerta 15 min antes de iniciar
        const shiftMins = b.iniMins - 15;
        const shiftDate = new Date();
        shiftDate.setHours(Math.floor(shiftMins / 60), shiftMins % 60, 0, 0);

        if (shiftDate.getTime() > now.getTime()) {
          notificationsToSchedule.push({
            id: 1000 + idx,
            title: `🔔 Próximo Turno en 15 min (${b.ini})`,
            body: `Bloque ${b.ini} - ${b.fin} inicia en 15 min. Aulas asignadas (${aulasArr.length}): ${aulasText}. Prepara la ronda.`,
            schedule: {
              at: shiftDate,
              allowWhileIdle: true
            },
            channelId: UPN_NOTIF_CHANNEL_ID,
            sound: 'default',
            smallIcon: 'ic_stat_notify',
            iconColor: '#FDBA30',
            autoCancel: true,
            isExactNotification: true
          });
        }

        // Alerta a MITAD DE RONDA exacta de las aulas asignadas
        const midMins = Math.floor((b.iniMins + b.finMins) / 2);
        const midDate = new Date();
        midDate.setHours(Math.floor(midMins / 60), midMins % 60, 0, 0);

        if (midDate.getTime() > now.getTime()) {
          notificationsToSchedule.push({
            id: 5000 + idx,
            title: `⚠️ Mitad de Ronda • Aulas Asignadas (${b.ini} - ${b.fin})`,
            body: `Mitad de turno (${b.ini} - ${b.fin}). Ingresa a registrar la asistencia de tus aulas asignadas (${aulasText}).`,
            schedule: {
              at: midDate,
              allowWhileIdle: true
            },
            channelId: UPN_NOTIF_CHANNEL_ID,
            sound: 'default',
            smallIcon: 'ic_stat_notify',
            iconColor: '#FDBA30',
            autoCancel: true,
            isExactNotification: true
          });
        }
      }
    }

    // 6. Obtener clases de MAÑANA y filtrar estrictamente por las aulas asignadas al asistente
    try {
      const DAYS_NAMES = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
      const tomorrowDay = DAYS_NAMES[(now.getDay() + 1) % 7];
      const dataTomorrow = await getAttendanceDataForDay(tomorrowDay);
      let myClassesTomorrow = [];
      if (dataTomorrow && dataTomorrow.length > 0) {
        myClassesTomorrow = dataTomorrow.filter(item => isClassAssignedToAssistant(item, assignment));
      }

      if (myClassesTomorrow.length > 0) {
        const tomorrowBlockMap = new Map();
        myClassesTomorrow.forEach(item => {
          const ini = item.horaInicioProg;
          const fin = item.horaFinalProg;
          if (!ini || !fin) return;
          const [hI, mI] = ini.split(':').map(Number);
          const [hF, mF] = fin.split(':').map(Number);
          if (isNaN(hI) || isNaN(mI) || isNaN(hF) || isNaN(mF)) return;
          const iniMins = hI * 60 + mI;
          const finMins = hF * 60 + mF;
          const key = `${ini}-${fin}`;
          if (!tomorrowBlockMap.has(key)) {
            tomorrowBlockMap.set(key, { ini, fin, iniMins, finMins, aulas: new Set() });
          }
          if (item.aula) tomorrowBlockMap.get(key).aulas.add(item.aula);
        });

        let idxT = 0;
        for (const [key, b] of tomorrowBlockMap.entries()) {
          idxT++;
          const aulasArr = Array.from(b.aulas);
          const sampleAulas = aulasArr.slice(0, 4).join(', ');
          const aulasText = aulasArr.length > 4 ? `${sampleAulas} y ${aulasArr.length - 4} más` : sampleAulas;

          const shiftMins = b.iniMins - 15;
          const shiftDate = new Date();
          shiftDate.setDate(now.getDate() + 1);
          shiftDate.setHours(Math.floor(shiftMins / 60), shiftMins % 60, 0, 0);

          notificationsToSchedule.push({
            id: 20000 + idxT,
            title: `🔔 Próximo Turno en 15 min (${b.ini})`,
            body: `Bloque ${b.ini} - ${b.fin} inicia en 15 min. Aulas asignadas (${aulasArr.length}): ${aulasText}. Prepara la ronda.`,
            schedule: {
              at: shiftDate,
              allowWhileIdle: true
            },
            channelId: UPN_NOTIF_CHANNEL_ID,
            sound: 'default',
            smallIcon: 'ic_stat_notify',
            iconColor: '#FDBA30',
            autoCancel: true,
            isExactNotification: true
          });

          const midMins = Math.floor((b.iniMins + b.finMins) / 2);
          const midDate = new Date();
          midDate.setDate(now.getDate() + 1);
          midDate.setHours(Math.floor(midMins / 60), midMins % 60, 0, 0);

          notificationsToSchedule.push({
            id: 25000 + idxT,
            title: `⚠️ Mitad de Ronda • Aulas Asignadas (${b.ini} - ${b.fin})`,
            body: `Mitad de turno (${b.ini} - ${b.fin}). Ingresa a registrar la asistencia de tus aulas asignadas (${aulasText}).`,
            schedule: {
              at: midDate,
              allowWhileIdle: true
            },
            channelId: UPN_NOTIF_CHANNEL_ID,
            sound: 'default',
            smallIcon: 'ic_stat_notify',
            iconColor: '#FDBA30',
            autoCancel: true,
            isExactNotification: true
          });
        }
      }
    } catch (_) {}

    // Re-verificar que la sesión siga iniciada después de las consultas de red (evita condiciones de carrera al cerrar sesión)
    if (!getAuthUser()) {
      await clearAllScheduledNotifications();
      return;
    }

    // Habilitar bandera nativa en Android antes de programar las alarmas exactas
    try {
      if (AppInstaller?.setSessionActive) {
        await AppInstaller.setSessionActive({ active: true });
      }
    } catch (_) {}

    // 7. Enviar programación a LocalNotifications y AlarmManager de Android
    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: notificationsToSchedule });

      // Doble garantía nativa: registrar en AlarmManager de Android vía AlarmClock
      if (AppInstaller?.scheduleExactAlarm) {
        for (const notif of notificationsToSchedule.slice(0, 20)) {
          if (notif.schedule?.at && notif.schedule.at instanceof Date) {
            try {
              await AppInstaller.scheduleExactAlarm({
                id: notif.id,
                title: notif.title,
                body: notif.body,
                timestamp: notif.schedule.at.getTime()
              });
            } catch (_) {}
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Notifier] Error scheduling native notifications:', err);
  }
}

/**
 * Reproduce un tono de campana / chime institucional de alta potencia y nitidez vía Web Audio API.
 * Optimizado con compresor de dinámica y armónicos brillantes para sonar potente y claro
 * en altavoces de teléfonos móviles y computadoras.
 */
export function playNotificationChime() {
  try {
    if (typeof window === 'undefined') return;

    // Vibración háptica instantánea en dispositivos móviles compatibles
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([120, 60, 180]);
      } catch (_) {}
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    // Compresor de dinámica maestro: maximiza el volumen percibido sin saturar ni distorsionar
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-10, now);
    compressor.knee.setValueAtTime(24, now);
    compressor.ratio.setValueAtTime(14, now);
    compressor.attack.setValueAtTime(0.002, now);
    compressor.release.setValueAtTime(0.2, now);
    compressor.connect(ctx.destination);

    // Ganancia maestra con volumen potente (0.85)
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.85, now);
    masterGain.connect(compressor);

    // Función interna para crear notas cristalinas con armónicos audibles
    const playTone = (freq, startTime, duration, peakGain) => {
      // Oscilador principal (onda senoidal pura)
      const oscSine = ctx.createOscillator();
      const gainSine = ctx.createGain();
      oscSine.type = 'sine';
      oscSine.frequency.setValueAtTime(freq, startTime);
      gainSine.gain.setValueAtTime(0.001, startTime);
      gainSine.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
      gainSine.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      oscSine.connect(gainSine);
      gainSine.connect(masterGain);
      oscSine.start(startTime);
      oscSine.stop(startTime + duration);

      // Oscilador armónico secundario (onda triangular: aporta presencia y brillo en altavoces pequeños)
      const oscTri = ctx.createOscillator();
      const gainTri = ctx.createGain();
      oscTri.type = 'triangle';
      oscTri.frequency.setValueAtTime(freq * 2, startTime); // Octava superior
      gainTri.gain.setValueAtTime(0.001, startTime);
      gainTri.gain.exponentialRampToValueAtTime(peakGain * 0.45, startTime + 0.015);
      gainTri.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.7);
      oscTri.connect(gainTri);
      gainTri.connect(masterGain);
      oscTri.start(startTime);
      oscTri.stop(startTime + duration);
    };

    // Secuencia de alerta institucional nítida y ascendente (Do6 -> Mi6 -> Sol6 resonante)
    playTone(1046.50, now, 0.22, 0.70);          // C6 (~1046 Hz)
    playTone(1318.51, now + 0.11, 0.26, 0.82);   // E6 (~1318 Hz)
    playTone(1567.98, now + 0.24, 0.65, 0.95);   // G6 (~1567 Hz - Nota final brillante y expansiva)
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
        id: UPN_NOTIF_CHANNEL_ID,
        name: 'Alarmas de Rondas y Cambio de Turno UPN',
        description: 'Alertas prioritarias 15 min antes y a mitad de cada ronda',
        importance: 5,
        visibility: 1,
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#FDBA30'
      });
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 99999,
            title: '🔔 UPN Control Docente · Alerta Activa',
            body: '¡Notificaciones funcionando en tu teléfono! Recibirás avisos 15 min antes y a mitad de ronda así la app esté cerrada o minimizada.',
            channelId: UPN_NOTIF_CHANNEL_ID,
            sound: 'default',
            smallIcon: 'ic_stat_notify',
            iconColor: '#FDBA30',
            schedule: { at: new Date(Date.now() + 500) },
            autoCancel: true,
            isExactNotification: true
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
 * Programa una alarma nativa de prueba en 10 segundos para verificar que llega
 * incluso si la aplicación es cerrada o minimizada inmediatamente por el usuario.
 */
export async function triggerTestAlarmClosed(seconds = 10) {
  playNotificationChime();

  if (isCapacitorNative()) {
    try {
      if (AppInstaller?.testAlarmInSeconds) {
        await AppInstaller.testAlarmInSeconds({ seconds });
      }
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 9999,
            title: '🔔 Alarma UPN (App Cerrada / Segundo Plano)',
            body: '¡Excelente! Las notificaciones y alarmas funcionan con la app cerrada o minimizada.',
            channelId: UPN_NOTIF_CHANNEL_ID,
            sound: 'default',
            smallIcon: 'ic_stat_notify',
            iconColor: '#FDBA30',
            schedule: {
              at: new Date(Date.now() + seconds * 1000),
              allowWhileIdle: true
            },
            autoCancel: true,
            isExactNotification: true
          }
        ]
      });
      return { success: true, native: true };
    } catch (err) {
      console.warn('Test alarm error:', err);
    }
  }

  // Fallback para Web / Desktop: disparar después de N segundos
  setTimeout(() => {
    sendTestDesktopNotification();
  }, seconds * 1000);

  return { success: true, native: false };
}

/**
 * Revisa el reloj cada 20 segundos para verificar si estamos a 15 minutos del próximo bloque
 * ESTRICTO: Solo notifica si la sesión está activa y si hay clases en las aulas asignadas al asistente.
 */
async function checkScheduleTick() {
  const assignment = getActiveAssistantAssignment();
  // 1. Si la sesión no está iniciada, no emitir ninguna notificación
  if (!assignment) return;

  // 2. Si es asistente y no tiene aulas asignadas, no emitir notificaciones de otras aulas
  if (!assignment.isAdmin && !assignment.pabellon && (!assignment.pisos || assignment.pisos.length === 0)) {
    return;
  }

  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  const data = await getTodayAttendanceData();
  if (!getAuthUser()) return;
  if (!data || data.length === 0) return;

  const assignedClassesToday = data.filter(item => isClassAssignedToAssistant(item, assignment));
  if (assignedClassesToday.length === 0) return;

  // Agrupar clases asignadas por bloque de horario
  const assignedBlocksMap = new Map();
  assignedClassesToday.forEach(item => {
    const ini = item.horaInicioProg;
    const fin = item.horaFinalProg;
    if (!ini || !fin) return;
    const [hI, mI] = ini.split(':').map(Number);
    if (isNaN(hI) || isNaN(mI)) return;
    const iniMins = hI * 60 + mI;
    const key = `${ini}-${fin}`;
    if (!assignedBlocksMap.has(key)) {
      assignedBlocksMap.set(key, { ini, fin, iniMins, aulas: new Set() });
    }
    if (item.aula) assignedBlocksMap.get(key).aulas.add(item.aula);
  });

  for (const [key, b] of assignedBlocksMap.entries()) {
    const diff = b.iniMins - currentMins;
    if (diff > 0 && diff <= 15 && !hasBeenNotifiedToday(key)) {
      markNotifiedToday(key);

      const aulasList = Array.from(b.aulas);
      const sampleAulas = aulasList.slice(0, 4).join(', ');
      const aulasText = aulasList.length > 4 ? `${sampleAulas} y ${aulasList.length - 4} más` : sampleAulas;

      const title = `🔔 Próximo Turno en ${diff} min (${b.ini})`;
      const body = `El bloque ${b.ini} - ${b.fin} inicia en ${diff} min. Aulas asignadas (${aulasList.length}): ${aulasText}. Prepara la ronda.`;

      // Disparar en Android APK vía LocalNotifications
      if (isCapacitorNative()) {
        try {
          LocalNotifications.schedule({
            notifications: [
              {
                id: 2000 + Math.floor(Math.random() * 800),
                title,
                body,
                channelId: UPN_NOTIF_CHANNEL_ID,
                sound: 'default',
                smallIcon: 'ic_stat_notify',
                iconColor: '#FDBA30',
                schedule: { at: new Date(Date.now() + 500) },
                autoCancel: true,
                isExactNotification: true
              }
            ]
          }).catch(e => console.warn('Native notification tick error:', e));
        } catch (err) {
          console.warn('Native schedule tick exception:', err);
        }
      } else {
        fireWebNotification({ label: `${b.ini} - ${b.fin}`, start: b.ini, id: key }, body);
      }

      playNotificationChime();

      // Despachar evento para Toast / Banner visual en la interfaz de la app
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('upn:class-block-warning', {
          detail: { block: { start: b.ini, end: b.fin, label: `${b.ini} - ${b.fin}` }, diff, aulas: aulasText }
        }));
      }
    }
  }
}

// Cache de asistencia por día para verificación rápida sin sobrecargar la API
const dayAttendanceCache = new Map();
const DAYS_NAMES_LIST = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

export async function getAttendanceDataForDay(dayName) {
  if (!dayName) return [];
  const key = dayName.toUpperCase();
  const cached = dayAttendanceCache.get(key);
  const now = Date.now();
  if (cached && (now - cached.ts < 35000)) {
    return cached.data;
  }
  try {
    const res = await fetch(`/api/attendance?dia=${encodeURIComponent(key)}`);
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data)) {
        dayAttendanceCache.set(key, { ts: now, data: json.data });
        return json.data;
      }
    }
  } catch (_) {}
  return cached?.data || [];
}

export async function getTodayAttendanceData() {
  const todayName = DAYS_NAMES_LIST[new Date().getDay()];
  return getAttendanceDataForDay(todayName);
}

/**
 * Chequeo de hora intermedia en cada ronda (ej: 07:30 a 10:30, mitad ~09:00).
 * Detecta si hay aulas que aún no han sido registradas (pendientes)
 * y emite una alerta sonora y notificación para recordar completarlas.
 * 
 * ESTRICTO: Solo evalúa las aulas asignadas al asistente y solo mientras la sesión esté activa.
 */
async function checkMidpointPendingAttendance() {
  const assignment = getActiveAssistantAssignment();
  // 1. Si no hay sesión iniciada, salir inmediatamente
  if (!assignment) return;

  // 2. Si es asistente sin aulas asignadas, salir inmediatamente
  if (!assignment.isAdmin && !assignment.pabellon && (!assignment.pisos || assignment.pisos.length === 0)) {
    return;
  }

  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  const data = await getTodayAttendanceData();
  if (!getAuthUser()) return;
  if (!data || data.length === 0) return;

  // Filtrar ÚNICAMENTE las aulas asignadas al asistente
  const assignedItems = data.filter(item => isClassAssignedToAssistant(item, assignment));
  if (assignedItems.length === 0) return;

  // Agrupar clases activas por bloque (hora_inicio_prog - hora_final_prog)
  const activeSchedules = new Map();

  assignedItems.forEach(item => {
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

      // Buscar clases que aún no tienen registro (pendientes de marcar puntual, tarde o falta) en sus aulas asignadas
      const pendingItems = group.items.filter(it => {
        const asis = String(it.asistencia || '').trim().toUpperCase();
        return !asis || asis === 'PENDIENTE' || asis === 'NULL' || asis === '#N/D';
      });

      if (pendingItems.length > 0) {
        localStorage.setItem(notifyStorageKey, '1');

        const pendingCount = pendingItems.length;
        const sampleAulas = pendingItems.slice(0, 4).map(it => it.aula).join(', ');
        const aulasText = pendingCount > 4 ? `${sampleAulas} y ${pendingCount - 4} más` : sampleAulas;

        const title = `⚠️ Aulas asignadas pendientes (${group.ini} - ${group.fin})`;
        const body = `Mitad de turno: Tienes ${pendingCount} aula(s) asignadas pendientes (${aulasText}). ¡Recuerda marcar Puntual, Tarde o Falta!`;

        // 1. Android Nativo APK
        if (isCapacitorNative()) {
          try {
            LocalNotifications.schedule({
              notifications: [
                {
                  id: 3000 + Math.floor(Math.random() * 800),
                  title,
                  body,
                  channelId: UPN_NOTIF_CHANNEL_ID,
                  sound: 'default',
                  smallIcon: 'ic_stat_notify',
                  iconColor: '#FDBA30',
                  schedule: { at: new Date(Date.now() + 500) },
                  autoCancel: true,
                  isExactNotification: true
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
  // Registrar Service Worker para PWA / Web si no es nativo
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !isCapacitorNative()) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Si la sesión no está iniciada en el arranque, asegurar que no haya alarmas pendientes en el APK
  if (!getAuthUser()) {
    clearAllScheduledNotifications();
  } else {
    // 1. Pedir permisos si aún no se han concedido y programar alarmas nativas para el usuario
    requestNotificationPermission().then((granted) => {
      if (granted && isCapacitorNative()) {
        scheduleNativeAlarms();
      }
    });
  }

  // Escuchar cuando el usuario inicia sesión, cierra sesión o cambian las asignaciones
  const handleAuthOrDataChange = () => {
    const user = getAuthUser();
    if (!user) {
      // Sesión cerrada: cancelar de inmediato todas las alarmas
      clearAllScheduledNotifications();
    } else if (isCapacitorNative()) {
      // Sesión iniciada: reprogramar alarmas filtradas exclusivamente para este usuario
      scheduleNativeAlarms();
      checkScheduleTick();
      checkMidpointPendingAttendance();
    }
  };
  window.addEventListener('steel:auth-changed', handleAuthOrDataChange);
  window.addEventListener('steel:assignments-updated', handleAuthOrDataChange);

  // 2. Re-verificar y re-programar automáticamente cada vez que el usuario regresa a la app
  let appStateListener = null;
  if (isCapacitorNative()) {
    try {
      App.addListener('appStateChange', (state) => {
        if (state.isActive) {
          if (!getAuthUser()) {
            clearAllScheduledNotifications();
          } else {
            scheduleNativeAlarms();
            checkScheduleTick();
            checkMidpointPendingAttendance();
          }
        }
      }).then(handle => { appStateListener = handle; }).catch(() => { });
    } catch (_) { }
  }

  const handleVisibility = () => {
    if (typeof document !== 'undefined' && !document.hidden && isCapacitorNative()) {
      if (!getAuthUser()) {
        clearAllScheduledNotifications();
      } else {
        scheduleNativeAlarms();
        checkScheduleTick();
        checkMidpointPendingAttendance();
      }
    }
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
  }

  // 3. Programar chequeo periódico en primer plano (cada 20 segundos)
  const interval = setInterval(() => {
    if (getAuthUser()) {
      checkScheduleTick();
      checkMidpointPendingAttendance();
    }
  }, 20000);

  if (getAuthUser()) {
    checkScheduleTick();
    checkMidpointPendingAttendance();
  }

  return () => {
    clearInterval(interval);
    window.removeEventListener('steel:auth-changed', handleAuthOrDataChange);
    window.removeEventListener('steel:assignments-updated', handleAuthOrDataChange);
    if (appStateListener?.remove) appStateListener.remove();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility);
    }
  };
}
