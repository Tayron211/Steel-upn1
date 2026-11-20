package edu.pe.upn.controldoc;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

/**
 * Receptor de Alarmas Nativas UPN activado por AlarmManager (AlarmClock).
 * Despierta el dispositivo y muestra la notificación con sonido y vibración
 * incluso si la aplicación está completamente cerrada o en segundo plano.
 */
public class UpnAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "UpnAlarmReceiver";
    public static final String CHANNEL_ID = "upn_rondas_urgente";

    @Override
    public void onReceive(Context context, Intent intent) {
        // Verificar en SharedPreferences nativo si la sesión sigue iniciada y corresponde al mismo usuario
        SharedPreferences prefs = context.getSharedPreferences("upn_session_prefs", Context.MODE_PRIVATE);
        boolean isSessionActive = prefs.getBoolean("is_session_active", false);
        String activeUser = prefs.getString("active_username", "");
        String notifUser = intent.getStringExtra("notif_username");
        if (!isSessionActive) {
            Log.d(TAG, "Sesión cerrada en Android: alarma ignorada y descartada.");
            return;
        }
        if (notifUser != null && !notifUser.isEmpty() && !activeUser.isEmpty() && !notifUser.equalsIgnoreCase(activeUser)) {
            Log.d(TAG, "Alarma pertenece a otro usuario (" + notifUser + " vs " + activeUser + "): descartada.");
            return;
        }

        Log.d(TAG, "Alarma recibida con la app en segundo plano o cerrada");

        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "UPNControlDoc:AlarmWakeLock");
            wakeLock.acquire(10000); // 10 segundos máx para procesar
        }

        try {
            int notifId = intent.getIntExtra("notif_id", 9999);
            String title = intent.getStringExtra("notif_title");
            String body = intent.getStringExtra("notif_body");

            if (title == null || title.isEmpty()) {
                title = "🔔 UPN Control Docente";
            }
            if (body == null || body.isEmpty()) {
                body = "Alerta de ronda docente o inicio de turno.";
            }

            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager == null) return;

            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = notificationManager.getNotificationChannel(CHANNEL_ID);
                if (channel == null) {
                    channel = new NotificationChannel(
                        CHANNEL_ID,
                        "Alarmas y Rondas Docentes UPN",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    channel.setDescription("Alarmas prioritarias para turnos y rondas docentes");
                    channel.enableVibration(true);
                    channel.setVibrationPattern(new long[]{0, 500, 250, 500});
                    channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .build();
                    channel.setSound(soundUri, audioAttributes);
                    notificationManager.createNotificationChannel(channel);
                }
            }

            // Intent para abrir MainActivity al presionar la notificación
            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            launchIntent.putExtra("from_notification", true);
            launchIntent.putExtra("notif_id", notifId);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent contentPendingIntent = PendingIntent.getActivity(
                context,
                notifId,
                launchIntent,
                flags
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setColor(0xFFFDBA30)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setSound(soundUri)
                .setVibrate(new long[]{0, 500, 250, 500})
                .setAutoCancel(true)
                .setContentIntent(contentPendingIntent);

            notificationManager.notify(notifId, builder.build());
            Log.d(TAG, "Notificación disparada con éxito ID: " + notifId);

        } catch (Exception e) {
            Log.e(TAG, "Error procesando alarma en segundo plano", e);
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                try { wakeLock.release(); } catch (Exception ignored) {}
            }
        }
    }
}
