const DEFAULT_REMOTE_BACKEND = 'https://workloop-tybb.onrender.com';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const REMOTE_FRONTEND_HOST_SUFFIXES = ['.vercel.app'];
const SAME_ORIGIN_PORTS = new Set(['3000', '4173', '5002']);

export const isAbsoluteUrl = (value = '') => /^(https?:|data:|blob:)/i.test(value);

export const getBackendOrigin = () => {
  const configured = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_ORIGIN || '';
  if (configured) return configured.replace(/\/+$/, '');

  if (typeof window === 'undefined') return '';

  const { hostname, port, protocol } = window.location;
  const isNativeShell = Boolean(window.Capacitor?.isNativePlatform?.()) ||
    protocol === 'capacitor:' ||
    protocol === 'ionic:';

  if (isNativeShell) return DEFAULT_REMOTE_BACKEND;

  const isLocalFrontend = LOCAL_HOSTS.has(hostname) || SAME_ORIGIN_PORTS.has(port);
  const isKnownRemoteFrontend = REMOTE_FRONTEND_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix));

  if (isLocalFrontend) return '';

  // Cloudflare/ngrok/localtunnel/custom tunnel domains should keep using the same
  // public origin so /api, /uploads, and /socket.io pass through the tunnel.
  if (!isKnownRemoteFrontend) return '';

  return DEFAULT_REMOTE_BACKEND;
};

export const resolveMediaUrl = (value) => {
  if (!value) return '';
  if (isAbsoluteUrl(value)) return value;

  const path = value.startsWith('/') ? value : `/${value}`;

  if (path.startsWith('/uploads')) {
    return `${getBackendOrigin()}${path}`;
  }

  return path;
};
