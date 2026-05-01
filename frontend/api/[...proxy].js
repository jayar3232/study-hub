import axios from 'axios';

const BACKEND_URL = (
  process.env.BACKEND_URL ||
  process.env.VITE_BACKEND_URL ||
  process.env.RENDER_BACKEND_URL ||
  'https://workloop-tybb.onrender.com'
).replace(/\/+$/, '');

export default async function handler(req, res) {
  const { proxy } = req.query;
  const path = proxy ? `/${proxy.join('/')}` : '/';

  try {
    const url = `${BACKEND_URL}${path}`;

    console.log(`[PROXY] ${req.method} ${url}`);

    const response = await axios({
      method: req.method,
      url: url,
      data: req.body,
      headers: {
        ...req.headers,
        'Content-Type': req.headers['content-type'] || 'application/json',
      },
      validateStatus: () => true, // Don't throw on any status
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('[PROXY ERROR]', error.message);
    res.status(500).json({ msg: 'Backend unreachable', error: error.message });
  }
}
