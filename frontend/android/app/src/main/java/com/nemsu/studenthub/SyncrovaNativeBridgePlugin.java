package com.nemsu.studenthub;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SyncrovaNativeBridge")
public class SyncrovaNativeBridgePlugin extends Plugin {
    static final String PREFS_NAME = "syncrova_native";
    static final String AUTH_TOKEN_KEY = "auth_token";
    static final String API_BASE_URL_KEY = "api_base_url";
    static final String USER_ID_KEY = "user_id";
    static final String CHAT_HEADS_ENABLED_KEY = "chat_heads_enabled";
    private static final String MESSENGER_PACKAGE = "com.nemsu.studenthub.messenger";
    private static final String MESSENGER_SCHEME = "syncrova-messenger";

    @PluginMethod
    public void syncAuth(PluginCall call) {
        String token = call.getString("token", "");
        String apiBaseUrl = call.getString("apiBaseUrl", "");
        String userId = call.getString("userId", "");

        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(AUTH_TOKEN_KEY, token == null ? "" : token)
            .putString(API_BASE_URL_KEY, apiBaseUrl == null ? "" : apiBaseUrl)
            .putString(USER_ID_KEY, userId == null ? "" : userId)
            .apply();

        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void clearAuth(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .remove(AUTH_TOKEN_KEY)
            .remove(API_BASE_URL_KEY)
            .remove(USER_ID_KEY)
            .apply();

        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void openExternalUrl(PluginCall call) {
        String url = call.getString("url", "");
        if (url == null || url.trim().isEmpty()) {
            call.reject("Missing URL");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url.trim()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);

        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void getMessengerStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("installed", isMessengerInstalled());
        call.resolve(result);
    }

    @PluginMethod
    public void openMessenger(PluginCall call) {
        String path = normalizeMessengerPath(call.getString("path", "/messages"));
        JSObject result = new JSObject();
        boolean installed = isMessengerInstalled();
        result.put("installed", installed);

        if (!installed) {
            result.put("opened", false);
            call.resolve(result);
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(MESSENGER_SCHEME + "://open" + path));
            intent.setPackage(MESSENGER_PACKAGE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception firstError) {
            try {
                Intent launchIntent = getContext().getPackageManager().getLaunchIntentForPackage(MESSENGER_PACKAGE);
                if (launchIntent == null) {
                    result.put("opened", false);
                    call.resolve(result);
                    return;
                }
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(launchIntent);
                result.put("opened", true);
                call.resolve(result);
            } catch (Exception secondError) {
                call.reject("Could not open Syncrova Messenger", secondError);
            }
        }
    }

    @PluginMethod
    public void getChatHeadsStatus(PluginCall call) {
        call.resolve(createChatHeadsStatus());
    }

    @PluginMethod
    public void setChatHeadsEnabled(PluginCall call) {
        Boolean enabledValue = call.getBoolean("enabled");
        boolean enabled = enabledValue != null && enabledValue;

        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(CHAT_HEADS_ENABLED_KEY, enabled).apply();

        if (!enabled) {
            SyncrovaChatHeadService.hide(getContext());
        } else if (!Settings.canDrawOverlays(getContext())) {
            openOverlaySettings();
        }

        call.resolve(createChatHeadsStatus());
    }

    @PluginMethod
    public void openChatHeadSettings(PluginCall call) {
        openOverlaySettings();
        call.resolve(createChatHeadsStatus());
    }

    private boolean isMessengerInstalled() {
        try {
            getContext().getPackageManager().getPackageInfo(MESSENGER_PACKAGE, 0);
            return true;
        } catch (PackageManager.NameNotFoundException ignored) {
            return false;
        } catch (Exception ignored) {
            return false;
        }
    }

    private JSObject createChatHeadsStatus() {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        JSObject result = new JSObject();
        result.put("supported", true);
        result.put("enabled", prefs.getBoolean(CHAT_HEADS_ENABLED_KEY, true));
        result.put("canDrawOverlays", Settings.canDrawOverlays(getContext()));
        return result;
    }

    private void openOverlaySettings() {
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + getContext().getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }

    private String normalizeMessengerPath(String rawPath) {
        String value = rawPath == null || rawPath.trim().isEmpty() ? "/messages" : rawPath.trim();
        if (!value.startsWith("/")) value = "/" + value;
        if (!value.startsWith("/messages")) return "/messages";
        return value.replaceAll("[\\r\\n]", "");
    }
}
