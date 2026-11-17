package edu.pe.upn.controldoc;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppInstaller")
public class AppInstallerPlugin extends Plugin {

    private static final String TAG = "AppInstaller";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private File lastDownloadedApk = null;

    @PluginMethod
    public void canRequestPackageInstalls(PluginCall call) {
        Context context = getContext();
        boolean canInstall = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            canInstall = context.getPackageManager().canRequestPackageInstalls();
        }
        JSObject ret = new JSObject();
        ret.put("value", canInstall);
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, 
                Uri.parse("package:" + context.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            String packageName = context.getPackageName();
            android.os.PowerManager pm = (android.os.PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + packageName));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                } catch (Exception e) {
                    try {
                        Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        context.startActivity(intent);
                    } catch (Exception ignored) {}
                }
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        Context context = getContext();
        boolean ignoring = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            android.os.PowerManager pm = (android.os.PowerManager) context.getSystemService(Context.POWER_SERVICE);
            ignoring = pm != null && pm.isIgnoringBatteryOptimizations(context.getPackageName());
        }
        JSObject ret = new JSObject();
        ret.put("value", ignoring);
        call.resolve(ret);
    }

    @PluginMethod
    public void launchInstaller(PluginCall call) {
        File apkFile = lastDownloadedApk;
        if (apkFile == null || !apkFile.exists()) {
            File cacheDir = getContext().getCacheDir();
            apkFile = new File(cacheDir, "control-doc-update.apk");
        }
        if (apkFile != null && apkFile.exists() && apkFile.length() > 0) {
            triggerInstallIntent(apkFile);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("El archivo de actualización no se encuentra disponible. Por favor, descargue de nuevo.");
        }
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String apkUrl = call.getString("url", "https://control-doc.pages.dev/control-doc.apk");
        Context context = getContext();

        JSObject ret = new JSObject();
        ret.put("started", true);
        call.resolve(ret);

        executor.execute(() -> {
            try {
                // Usar getCacheDir() para evitar bloqueos de Scoped Storage (/Android/data/) en Android 11+
                File cacheDir = context.getCacheDir();
                File destinationFile = new File(cacheDir, "control-doc-update.apk");
                if (destinationFile.exists()) {
                    destinationFile.delete();
                }

                URL url = new URL(apkUrl);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                connection.setRequestProperty("User-Agent", "Mozilla/5.0 UPNControlDoc Native");
                connection.connect();

                int fileLength = connection.getContentLength();
                InputStream input = connection.getInputStream();
                FileOutputStream output = new FileOutputStream(destinationFile);

                byte[] data = new byte[8192];
                long total = 0;
                int count;
                long lastNotify = 0;

                while ((count = input.read(data)) != -1) {
                    total += count;
                    output.write(data, 0, count);

                    long now = System.currentTimeMillis();
                    if (now - lastNotify > 200) {
                        lastNotify = now;
                        int percent = fileLength > 0 ? (int) ((total * 100) / fileLength) : 0;
                        JSObject progressObj = new JSObject();
                        progressObj.put("percent", Math.min(99, percent));
                        progressObj.put("bytesDownloaded", total);
                        progressObj.put("totalBytes", fileLength);
                        notifyListeners("downloadProgress", progressObj);
                    }
                }

                output.flush();
                output.close();
                input.close();

                destinationFile.setReadable(true, false);
                lastDownloadedApk = destinationFile;

                // Notificar 100% descarga completada
                JSObject doneObj = new JSObject();
                doneObj.put("percent", 100);
                doneObj.put("completed", true);
                notifyListeners("downloadProgress", doneObj);

                // Lanzar instalador en el hilo principal de la Activity (UI thread)
                triggerInstallIntent(destinationFile);

            } catch (Exception e) {
                Log.e(TAG, "Error durante la descarga o instalación del APK", e);
                JSObject errObj = new JSObject();
                errObj.put("error", e.getMessage());
                notifyListeners("downloadError", errObj);
            }
        });
    }

    public void triggerInstallIntent(File apkFile) {
        Activity activity = getActivity();
        Context context = activity != null ? activity : getContext();

        Runnable task = () -> {
            try {
                if (apkFile == null || !apkFile.exists() || apkFile.length() == 0) {
                    Log.e(TAG, "El archivo APK destino no existe o está vacío.");
                    return;
                }

                // Si Android 8+ requiere permiso para instalar paquetes de esta app
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    if (!context.getPackageManager().canRequestPackageInstalls()) {
                        Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, 
                            Uri.parse("package:" + context.getPackageName()));
                        settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        context.startActivity(settingsIntent);
                        return;
                    }
                }

                Uri fileUri;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    fileUri = FileProvider.getUriForFile(
                        context, 
                        context.getPackageName() + ".fileprovider", 
                        apkFile
                    );
                } else {
                    fileUri = Uri.fromFile(apkFile);
                }

                Intent installIntent = new Intent(Intent.ACTION_VIEW);
                installIntent.setDataAndType(fileUri, "application/vnd.android.package-archive");
                installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                installIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

                // Otorgar permisos de lectura a todos los instaladores registrados (MIUI/Google PackageInstaller)
                List<ResolveInfo> resolveInfos = context.getPackageManager().queryIntentActivities(installIntent, PackageManager.MATCH_DEFAULT_ONLY);
                for (ResolveInfo info : resolveInfos) {
                    if (info.activityInfo != null && info.activityInfo.packageName != null) {
                        context.grantUriPermission(info.activityInfo.packageName, fileUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    }
                }

                context.startActivity(installIntent);
                Log.d(TAG, "Intent de instalación lanzado exitosamente con URI: " + fileUri);

            } catch (Exception ex) {
                Log.e(TAG, "Fallo al lanzar el Intent de instalación:", ex);
            }
        };

        if (activity != null) {
            activity.runOnUiThread(task);
        } else {
            task.run();
        }
    }

    private boolean doScheduleExactAlarm(int notifId, String title, String body, long triggerAtMillis) {
        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return false;

        try {
            Intent intent = new Intent(context, UpnAlarmReceiver.class);
            intent.putExtra("notif_id", notifId);
            intent.putExtra("notif_title", title);
            intent.putExtra("notif_body", body);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                notifId,
                intent,
                flags
            );

            Intent showIntent = new Intent(context, MainActivity.class);
            PendingIntent showPendingIntent = PendingIntent.getActivity(
                context,
                notifId,
                showIntent,
                flags
            );

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(triggerAtMillis, showPendingIntent);
                alarmManager.setAlarmClock(clockInfo, pendingIntent);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }

            Log.d(TAG, "Alarma nativa tipo AlarmClock programada ID " + notifId + " para: " + triggerAtMillis);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Error programando alarma nativa", e);
            return false;
        }
    }

    @PluginMethod
    public void scheduleExactAlarm(PluginCall call) {
        int notifId = call.getInt("id", 1000);
        String title = call.getString("title", "🔔 UPN Control Docente");
        String body = call.getString("body", "Alerta de ronda docente");
        Long triggerAtMillis = call.getLong("timestamp");

        if (triggerAtMillis == null || triggerAtMillis <= System.currentTimeMillis()) {
            call.reject("Timestamp inválido o en el pasado");
            return;
        }

        boolean ok = doScheduleExactAlarm(notifId, title, body, triggerAtMillis);
        if (ok) {
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("id", notifId);
            call.resolve(ret);
        } else {
            call.reject("No se pudo programar la alarma nativa");
        }
    }

    @PluginMethod
    public void cancelExactAlarm(PluginCall call) {
        Context context = getContext();
        int notifId = call.getInt("id", 1000);
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                Intent intent = new Intent(context, UpnAlarmReceiver.class);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent pendingIntent = PendingIntent.getBroadcast(context, notifId, intent, flags);
                alarmManager.cancel(pendingIntent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void testAlarmInSeconds(PluginCall call) {
        int seconds = call.getInt("seconds", 10);
        long target = System.currentTimeMillis() + (seconds * 1000L);
        int notifId = 9999;
        String title = "🔔 Alarma UPN (App Cerrada / Segundo Plano)";
        String body = "¡Excelente! Las alarmas y notificaciones funcionan con la app cerrada o minimizada.";
        
        boolean ok = doScheduleExactAlarm(notifId, title, body, target);
        JSObject ret = new JSObject();
        ret.put("success", ok);
        ret.put("seconds", seconds);
        call.resolve(ret);
    }
}
