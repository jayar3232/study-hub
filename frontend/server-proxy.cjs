const express = require('express');
const httpProxy = require('http-proxy');
const path = require('path');

const app = express();
const proxy = httpProxy.createProxyServer({ 
  changeOrigin: true,
  ws: true  // Enable WebSocket proxying
});

// Log all requests (including upgrade)
app.use((req, res, next) => {
  console.log(`[PROXY] ${req.method} ${req.url}`);
  next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'dist')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../backend/uploads')));

// Proxy API requests (HTTP)
app.use('/api', (req, res) => {
  req.url = req.originalUrl;
  console.log(`[PROXY] Forwarding API: ${req.method} ${req.url}`);
  proxy.web(req, res, { target: 'http://localhost:5000' }, (err) => {
    console.error('[PROXY ERROR]', err.message);
    if (!res.headersSent) res.status(500).json({ msg: 'Backend unreachable' });
  });
});

// Handle WebSocket upgrade requests
app.on('upgrade', (req, socket, head) => {
  console.log('[PROXY] Upgrade request for', req.url);
  // Forward the WebSocket upgrade to the backend
  proxy.ws(req, socket, head, { target: 'http://localhost:5000' });
});

// Catch-all for React Router
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = 5002;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Proxy server (with WebSocket support) running on http://localhost:${PORT}`);
});