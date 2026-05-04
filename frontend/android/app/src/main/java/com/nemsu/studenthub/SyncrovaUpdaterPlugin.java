package com.nemsu.studenthub;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "SyncrovaUpdater")
public class SyncrovaUpdaterPlugin extends Plugin {
    private long activeDownloadId = -1;
    private BroadcastReceiver downloadReceiver;

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String apkUrl = call.getString("url", "");
        if (apkUrl == null || apkUrl.trim().isEmpty()) {
            call.reject("Missing update URL");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settingsIntent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName())
            );
            settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settingsIntent);

            JSObject result = new JSObject();
            result.put("needsInstallPermission", true);
            call.resolve(result);
            return;
        }

        File targetFile = getTargetFile(call.getString("fileName", "syncrova-latest.apk"));
        if (targetFile == null) {
            call.reject("Could not prepare update file");
            return;
        }

        if (targetFile.exists()) {
            // Ignore stale APKs; the installer should always point to the fresh download.
            targetFile.delete();
        }

        DownloadManager downloadManager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        if (downloadManager == null) {
            call.reject("Android Download Manager is unavailable");
            return;
        }

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(apkUrl.trim()));
        request.setTitle("SYNCROVA update");
        request.setDescription("Downloading SYNCROVA " + call.getString("versionName", "update"));
        request.setMimeType("application/vnd.android.package-archive");
        request.setAllowedOverMetered(true);
        request.setAllowedOverRoaming(true);
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationUri(Uri.fromFile(targetFile));

        activeDownloadId = downloadManager.enqueue(request);
        registerDownloadReceiver(targetFile);

        JSObject result = new JSObject();
        result.put("status", "downloading");
        result.put("downloadId", activeDownloadId);
        call.resolve(result);
    }

    private File getTargetFile(String requestedName) {
        String fileName = requestedName == null || !requestedName.endsWith(".apk")
                ? "syncrova-latest.apk"
                : requestedName.replaceAll("[^a-zA-Z0-9._-]", "");
        File downloadDir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (downloadDir == null) downloadDir = getContext().getCacheDir();
        if (downloadDir == null) return null;
        if (!downloadDir.exists()) downloadDir.mkdirs();
        return new File(downloadDir, fileName);
    }

    private void registerDownloadReceiver(File targetFile) {
        unregisterDownloadReceiver();
        downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long completedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (completedId != activeDownloadId) return;

                if (isDownloadSuccessful(completedId)) {
                    openInstaller(targetFile);
                } else {
                    Toast.makeText(context, "SYNCROVA update download failed", Toast.LENGTH_LONG).show();
                }

                unregisterDownloadReceiver();
                activeDownloadId = -1;
            }
        };

        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(downloadReceiver, filter);
        }
    }

    private void unregisterDownloadReceiver() {
        if (downloadReceiver == null) return;
        try {
            getContext().unregisterReceiver(downloadReceiver);
        } catch (Exception ignored) {
            // Receiver may already be gone after Activity recreation.
        }
        downloadReceiver = null;
    }

    private boolean isDownloadSuccessful(long downloadId) {
        DownloadManager downloadManager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        if (downloadManager == null) return false;

        Cursor cursor = null;
        try {
            cursor = downloadManager.query(new DownloadManager.Query().setFilterById(downloadId));
            if (cursor == null || !cursor.moveToFirst()) return false;
            int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
            return statusIndex >= 0 && cursor.getInt(statusIndex) == DownloadManager.STATUS_SUCCESSFUL;
        } catch (Exception ignored) {
            return false;
        } finally {
            if (cursor != null) cursor.close();
        }
    }

    private void openInstaller(File apkFile) {
        Context context = getContext();
        Uri apkUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                apkFile
        );

        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        try {
            context.startActivity(installIntent);
        } catch (ActivityNotFoundException err) {
            Toast.makeText(context, "No Android installer found for this update", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void handleOnDestroy() {
        unregisterDownloadReceiver();
        super.handleOnDestroy();
    }
}
