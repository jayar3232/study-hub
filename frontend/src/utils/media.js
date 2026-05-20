const DEFAULT_REMOTE_BACKEND = 'https://study-hub-77ta.onrender.com';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const REMOTE_FRONTEND_HOST_SUFFIXES = ['.vercel.app'];
const TUNNEL_HOST_SUFFIXES = [
  '.trycloudflare.com',
  '.ngrok-free.app',
  '.ngrok.io',
  '.loca.lt',
  '.localtunnel.me',
  '.localhost.run',
  '.serveo.net',
  '.tunnelmole.net',
  '.devtunnels.ms'
];
const SAME_ORIGIN_PORTS = new Set(['3000', '4173', '5002']);

export const isAbsoluteUrl = (value = '') => /^(https?:|data:|blob:)/i.test(value);

const isNativeShell = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.Capacitor?.isNativePlatform?.()) ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:';
};

const encodeObjectPath = (value = '') => String(value || '')
  .split('/')
  .map(part => encodeURIComponent(part))
  .join('/');

const getLegacySupabaseProxyPath = (url) => {
  const markers = [
    '/storage/v1/object/public/',
    '/storage/v1/object/sign/',
    '/storage/v1/object/'
  ];
  const marker = markers.find(item => url.pathname.includes(item));
  if (!marker) return '';

  try {
    const afterMarker = decodeURIComponent(url.pathname.slice(url.pathname.indexOf(marker) + marker.length));
    const objectPath = afterMarker.split('/').slice(1).join('/');
    if (!objectPath || objectPath.includes('\0') || objectPath.split('/').some(part => part === '..')) return '';
    return `/uploads/r2/${encodeObjectPath(objectPath)}`;
  } catch {
    return '';
  }
};

export const getBackendOrigin = () => {
  const configured = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_ORIGIN || '';
  if (configured) return configured.replace(/\/+$/, '');

  if (typeof window === 'undefined') return '';

  const { hostname, port, protocol } = window.location;
  if (isNativeShell()) return DEFAULT_REMOTE_BACKEND;

  const isLocalFrontend = LOCAL_HOSTS.has(hostname) || SAME_ORIGIN_PORTS.has(port);
  const configuredRemoteHosts = (import.meta.env.VITE_REMOTE_FRONTEND_HOSTS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  const isKnownRemoteFrontend = REMOTE_FRONTEND_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix))
    || configuredRemoteHosts.includes(hostname.toLowerCase());
  const isTunnelFrontend = TUNNEL_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix));

  if (isLocalFrontend) return '';

  // Cloudflare/ngrok/localtunnel/custom tunnel domains should keep using the same
  // public origin so /api, /uploads, and /socket.io pass through the tunnel.
  if (isTunnelFrontend) return '';

  return isKnownRemoteFrontend || protocol === 'https:' ? DEFAULT_REMOTE_BACKEND : '';
};

export const resolveMediaUrl = (value) => {
  if (!value) return '';
  if (isAbsoluteUrl(value)) {
    try {
      const url = new URL(value);
      const legacySupabaseProxyPath = getLegacySupabaseProxyPath(url);
      if (legacySupabaseProxyPath) {
        return `${getBackendOrigin()}${legacySupabaseProxyPath}`;
      }
      if (url.pathname.startsWith('/uploads')) {
        const backendOrigin = getBackendOrigin();
        if (backendOrigin && (isNativeShell() || LOCAL_HOSTS.has(url.hostname))) {
          return `${backendOrigin}${url.pathname}`;
        }
      }
    } catch {
      return value;
    }
    return value;
  }

  const path = value.startsWith('/') ? value : `/${value}`;

  if (path.startsWith('/uploads')) {
    return `${getBackendOrigin()}${path}`;
  }

  return path;
};

export const optimizeImageFile = async (
  file,
  { maxDimension = 1600, quality = 0.82, minBytes = 900 * 1024 } = {}
) => {
  if (
    typeof window === 'undefined' ||
    !file?.type?.startsWith('image/') ||
    file.size < minBytes ||
    file.type === 'image/gif' ||
    file.type === 'image/svg+xml'
  ) {
    return file;
  }

  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });

    const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
    if (ratio >= 1 && file.size < minBytes * 1.5) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    const context = canvas.getContext('2d', { alpha: file.type === 'image/png' });
    if (!context) return file;

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise(resolve => canvas.toBlob(resolve, outputType, quality));
    if (!blob || blob.size >= file.size * 0.96) return file;

    return new File([blob], file.name, {
      type: outputType,
      lastModified: Date.now()
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};
