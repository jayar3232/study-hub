const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { normalizeCampus, normalizeCourse } = require('../utils/academics');
const router = express.Router();

const isBcryptHash = (value = '') => /^\$2[aby]\$\d{2}\$/.test(value);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const getResetTokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');

const getBackendOrigin = (req) => (
  process.env.BACKEND_PUBLIC_URL
  || process.env.RENDER_EXTERNAL_URL
  || `${req.protocol}://${req.get('host')}`
).replace(/\/$/, '');

const getFrontendOrigin = (fallback) => (
  process.env.FRONTEND_URL
  || process.env.CLIENT_URL
  || fallback
  || 'http://localhost:3000'
).replace(/\/$/, '');

const getOAuthRedirectUri = (req, provider) => `${getBackendOrigin(req)}/api/auth/oauth/${provider}/callback`;

const getAllowedFrontendOrigins = () => [
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_ORIGINS || '').split(',')
]
  .map(origin => origin?.trim())
  .filter(Boolean)
  .map(origin => origin.replace(/\/$/, ''));

const getSafeFrontendOrigin = (req) => {
  const fallback = getFrontendOrigin();
  const candidate = req.query.returnTo || req.headers.origin || fallback;

  try {
    const origin = new URL(candidate).origin;
    const allowed = getAllowedFrontendOrigins();
    if (
      allowed.includes(origin)
      || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
      || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
    ) {
      return origin;
    }
  } catch {
    return fallback;
  }

  return fallback;
};

const providerConfig = {
  google: {
    enabled: () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    scope: 'openid email profile'
  },
  facebook: {
    enabled: () => Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,email,picture.width(300).height(300)',
    clientId: () => process.env.FACEBOOK_APP_ID,
    clientSecret: () => process.env.FACEBOOK_APP_SECRET,
    scope: 'email,public_profile'
  }
};

const toClientUser = (user) => ({
  _id: user._id,
  id: user._id,
  name: user.name,
  email: user.email,
  course: normalizeCourse(user.course),
  campus: normalizeCampus(user.campus),
  bio: user.bio,
  avatar: user.avatar,
  coverPhoto: user.coverPhoto,
  lastSeen: user.lastSeen,
  createdAt: user.createdAt
});

const issueToken = (user) => jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

const redirectOAuthResult = (origin, token, user) => {
  const encodedUser = Buffer.from(JSON.stringify(toClientUser(user))).toString('base64url');
  return `${origin}/login?oauthToken=${encodeURIComponent(token)}&oauthUser=${encodeURIComponent(encodedUser)}`;
};

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, course, campus } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ msg: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCourse = normalizeCourse(course);
    const normalizedCampus = normalizeCampus(campus);
    if (course && !normalizedCourse) return res.status(400).json({ msg: 'Please choose a valid NEMSU course' });
    if (campus && !normalizedCampus) return res.status(400).json({ msg: 'Please choose a valid NEMSU campus' });

    let user = await User.findOne({ email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, 'i') });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      course: normalizedCourse,
      campus: normalizedCampus
    });
    await user.save();

    const token = issueToken(user);
    res.json({ token, user: toClientUser(user) });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ msg: 'Email and password are required' });
    }
    const normalizedEmail = email?.trim().toLowerCase();
    const user = await User.findOne({ email: new RegExp(`^${escapeRegex(normalizedEmail || '')}$`, 'i') });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const passwordMatches = isBcryptHash(user.password)
      ? await bcrypt.compare(password, user.password)
      : user.password === password;

    if (!passwordMatches) return res.status(400).json({ msg: 'Invalid credentials' });

    if (!isBcryptHash(user.password)) {
      user.password = await bcrypt.hash(password, 10);
      await user.save();
    }

    const token = issueToken(user);
    res.json({ token, user: toClientUser(user) });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/oauth/status', (req, res) => {
  res.json({
    google: providerConfig.google.enabled(),
    facebook: providerConfig.facebook.enabled()
  });
});

router.get('/oauth/:provider', (req, res) => {
  try {
    const provider = req.params.provider;
    const config = providerConfig[provider];
    if (!config) return res.status(404).json({ msg: 'OAuth provider not supported' });
    if (!config.enabled()) {
      return res.status(501).json({ msg: `${provider} login is not configured yet` });
    }

    const returnTo = getSafeFrontendOrigin(req);
    const state = jwt.sign({ provider, returnTo, purpose: 'oauth-login' }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const params = new URLSearchParams({
      client_id: config.clientId(),
      redirect_uri: getOAuthRedirectUri(req, provider),
      response_type: 'code',
      scope: config.scope,
      state
    });

    res.redirect(`${config.authUrl}?${params.toString()}`);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/oauth/:provider/callback', async (req, res) => {
  try {
    const provider = req.params.provider;
    const config = providerConfig[provider];
    if (!config || !config.enabled()) return res.status(501).send('OAuth provider is not configured');
    if (!req.query.code || !req.query.state) return res.status(400).send('Missing OAuth code');

    const state = jwt.verify(req.query.state, process.env.JWT_SECRET);
    if (state.provider !== provider || state.purpose !== 'oauth-login') return res.status(400).send('Invalid OAuth state');

    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: config.clientId(),
        client_secret: config.clientSecret(),
        redirect_uri: getOAuthRedirectUri(req, provider),
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      return res.status(400).send(tokenData.error_description || tokenData.error || 'OAuth token exchange failed');
    }

    const profileResponse = await fetch(config.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok) return res.status(400).send('OAuth profile request failed');

    const email = profile.email?.trim().toLowerCase();
    if (!email) return res.status(400).send('Your social account has no verified email');

    let user = await User.findOne({ email: new RegExp(`^${escapeRegex(email)}$`, 'i') });
    if (!user) {
      user = new User({
        name: profile.name || email.split('@')[0],
        email,
        password: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10),
        avatar: provider === 'facebook' ? profile.picture?.data?.url || '' : profile.picture || '',
        authProvider: provider
      });
      await user.save();
    } else if (!user.authProvider || user.authProvider === 'local') {
      user.authProvider = provider;
      if (!user.avatar) user.avatar = provider === 'facebook' ? profile.picture?.data?.url || '' : profile.picture || '';
      await user.save();
    }

    const token = issueToken(user);
    res.redirect(redirectOAuthResult(getFrontendOrigin(state.returnTo), token, user));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const normalizedEmail = req.body.email?.trim().toLowerCase();
    if (!normalizedEmail) return res.status(400).json({ msg: 'Email is required' });

    const user = await User.findOne({ email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, 'i') });
    const genericMsg = 'If that email exists, a password reset link has been prepared.';

    if (!user) return res.json({ msg: genericMsg });

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = getResetTokenHash(resetToken);
    user.passwordResetExpires = new Date(Date.now() + 1000 * 60 * 20);
    await user.save();

    const resetUrl = `${getFrontendOrigin(req.headers.origin)}/login?resetToken=${resetToken}&resetEmail=${encodeURIComponent(user.email)}`;
    const allowTokenPreview = process.env.NODE_ENV !== 'production' || process.env.PASSWORD_RESET_TOKEN_PREVIEW === 'true';

    res.json({
      msg: genericMsg,
      resetUrl: allowTokenPreview ? resetUrl : undefined,
      resetToken: allowTokenPreview ? resetToken : undefined,
      emailConfigured: false
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ msg: 'Reset token and new password are required' });
    if (password.length < 6) return res.status(400).json({ msg: 'Password must be at least 6 characters' });

    const tokenHash = getResetTokenHash(token);
    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) return res.status(400).json({ msg: 'Reset link is invalid or expired' });

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetToken = '';
    user.passwordResetExpires = null;
    await user.save();

    const authToken = issueToken(user);
    res.json({ token: authToken, user: toClientUser(user), msg: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
