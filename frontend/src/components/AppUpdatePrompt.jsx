import React, { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { getBackendOrigin } from '../utils/media';

const CURRENT_ANDROID_VERSION_CODE = Number(import.meta.env.VITE_ANDROID_VERSION_CODE || 5);
const CHECK_AFTER_MS = 1200;

const isNativeAndroid = () => {
  if (typeof window === 'undefined') return false;
  const capacitor = window.Capacitor;
  const platform = capacitor?.getPlatform?.();
  if (platform) return platform === 'android';
  return Boolean(capacitor?.isNativePlatform?.()) && /android/i.test(navigator.userAgent || '');
};

const getUpdateEndpoint = () => {
  const configured = import.meta.env.VITE_APP_UPDATE_URL || '';
  if (configured) return configured;
  const backendOrigin = getBackendOrigin();
  return `${backendOrigin || ''}/api/app/update`;
};

export default function AppUpdatePrompt() {
  const [update, setUpdate] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [checking, setChecking] = useState(false);

  const dismissKey = useMemo(() => (
    update?.versionCode ? `syncrova-update-dismissed-${update.versionCode}` : ''
  ), [update?.versionCode]);

  useEffect(() => {
    if (!isNativeAndroid()) return undefined;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setChecking(true);
      try {
        const response = await fetch(getUpdateEndpoint(), { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json();
        const nextVersionCode = Number(payload?.versionCode || 0);
        const apkUrl = String(payload?.apkUrl || '');
        const dismissed = localStorage.getItem(`syncrova-update-dismissed-${nextVersionCode}`) === '1';

        if (
          !cancelled &&
          payload?.available !== false &&
          apkUrl &&
          nextVersionCode > CURRENT_ANDROID_VERSION_CODE &&
          !dismissed
        ) {
          setUpdate({
            versionCode: nextVersionCode,
            versionName: payload.versionName || `v${nextVersionCode}`,
            notes: payload.notes || 'New SYNCROVA update is ready.',
            required: Boolean(payload.required),
            apkUrl
          });
        }
      } catch {
        // Update checks should never interrupt login or app usage.
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, CHECK_AFTER_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (!update || hidden) return null;

  const dismiss = () => {
    if (dismissKey && !update.required) localStorage.setItem(dismissKey, '1');
    setHidden(true);
  };

  const downloadUpdate = () => {
    window.open(update.apkUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-x-3 bottom-4 z-[120] mx-auto max-w-md sm:bottom-5">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#111827]/95 text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex items-start gap-3 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1877f2] text-white shadow-lg shadow-blue-500/20">
            <RefreshCw size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">New SYNCROVA update available</p>
            <p className="mt-1 text-xs font-semibold text-white/70">
              Version {update.versionName} is ready. Download the APK, then approve the Android installer.
            </p>
            {update.notes && (
              <p className="mt-2 rounded-2xl bg-white/10 px-3 py-2 text-xs font-semibold text-white/80">
                {update.notes}
              </p>
            )}
          </div>
          {!update.required && (
            <button
              type="button"
              onClick={dismiss}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Dismiss update"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="flex gap-2 border-t border-white/10 p-3">
          {!update.required && (
            <button
              type="button"
              onClick={dismiss}
              className="h-11 flex-1 rounded-2xl bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/20"
            >
              Later
            </button>
          )}
          <button
            type="button"
            onClick={downloadUpdate}
            disabled={checking}
            className="h-11 flex-[1.5] rounded-2xl bg-[#1877f2] px-4 text-sm font-black text-white transition hover:bg-[#0f63d5] disabled:opacity-60"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Download size={17} />
              Download update
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
