package com.nemsu.studenthub;

import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String PREFS_NAME = "syncrova_native";
    private static final String CACHE_VERSION_KEY = "last_cache_clear_version";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SyncrovaMediaLibraryPlugin.class);
        registerPlugin(SyncrovaNativeBridgePlugin.class);
        registerPlugin(SyncrovaUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        clearStaleWebCacheOnce();
        enableSafeFullscreen();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enableSafeFullscreen();
    }

    private void enableSafeFullscreen() {
        try {
            Window window = getWindow();
            if (window == null) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                window.setStatusBarColor(Color.TRANSPARENT);
                window.setNavigationBarColor(Color.BLACK);
            }

            View decorView = window.getDecorView();
            if (decorView == null) return;

            decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            );
        } catch (Exception ignored) {
            // Fullscreen is a nice-to-have; launching the app is more important.
        }
    }

    private void clearStaleWebCacheOnce() {
        try {
            long currentVersion = getCurrentVersionCode();
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            if (prefs.getLong(CACHE_VERSION_KEY, -1) == currentVersion) return;

            WebView webView = getBridge() == null ? null : getBridge().getWebView();
            if (webView != null) webView.clearCache(true);
            prefs.edit().putLong(CACHE_VERSION_KEY, currentVersion).apply();
        } catch (Exception ignored) {
            // Cache cleanup only removes stale bundled pages from old APK builds.
        }
    }

    private long getCurrentVersionCode() throws Exception {
        PackageInfo packageInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return packageInfo.getLongVersionCode();
        }
        return packageInfo.versionCode;
    }
}
