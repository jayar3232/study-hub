package com.nemsu.studenthub;

import android.content.Context;
import android.content.SharedPreferences;

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
}
