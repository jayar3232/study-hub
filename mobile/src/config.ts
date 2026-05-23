import Constants from 'expo-constants';

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

const DEFAULT_BACKEND_ORIGIN = 'https://study-hub-app.onrender.com';
const extra = Constants.expoConfig?.extra || {};
const env = typeof process !== 'undefined' ? process.env || {} : {};

export const BACKEND_ORIGIN = String(
  env.EXPO_PUBLIC_BACKEND_ORIGIN || extra.backendOrigin || DEFAULT_BACKEND_ORIGIN
).replace(/\/+$/, '');

export const API_BASE_URL = String(
  env.EXPO_PUBLIC_API_BASE_URL || extra.apiBaseUrl || `${BACKEND_ORIGIN}/api`
).replace(/\/+$/, '');
