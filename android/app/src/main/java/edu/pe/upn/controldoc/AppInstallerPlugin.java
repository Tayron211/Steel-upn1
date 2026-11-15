package edu.pe.upn.controldoc;

import android.app.Activity;
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
}
