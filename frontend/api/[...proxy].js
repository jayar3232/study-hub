import http from 'http';
import https from 'https';

const BACKEND_URL = (
  process.env.BACKEND_URL ||
  process.env.VITE_BACKEND_URL ||
  process.env.RENDER_BACKEND_URL ||
  'https://workloop-tybb.onrender.com'
).replace(/\/+$/, '');

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false
  }
};

const getProxyPath = (req) => {
  const proxyParts = Array.isArray(req.query?.proxy) ? req.query.proxy : [];
  const pathname = `/api/${proxyParts.map(part => encodeURIComponent(part)).join('/')}`.replace(/\/+$/, '') || '/api';
  const rawSearch = String(req.url || '').includes('?') ? String(req.url).slice(String(req.url).indexOf('?')) : '';
  return `${pathname}${rawSearch}`;
};

export default function handler(req, res) {
  const target = new URL(`${BACKEND_URL}${getProxyPath(req)}`);
  const transport = target.protocol === 'http:' ? http : https;
  const headers = { ...req.headers, host: target.host };

  delete headers.connection;
  delete headers['x-forwarded-host'];
  delete headers['x-forwarded-proto'];

  const upstream = transport.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || undefined,
    method: req.method,
    path: `${target.pathname}${target.search}`,
    headers
  }, (upstreamRes) => {
    res.statusCode = upstreamRes.statusCode || 500;

    Object.entries(upstreamRes.headers).forEach(([key, value]) => {
      if (typeof value === 'undefined' || key.toLowerCase() === 'transfer-encoding') return;
      res.setHeader(key, value);
    });

    upstreamRes.pipe(res);
  });

  upstream.on('error', (error) => {
    console.error('[PROXY ERROR]', error.message);
    if (!res.headersSent) {
      res.status(500).json({ msg: 'Backend unreachable', error: error.message });
    } else {
      res.end();
    }
  });

  req.pipe(upstream);
}
