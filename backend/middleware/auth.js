const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = String(decoded.userId || '');
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ msg: 'Token is not valid' });
    }

    const user = await User.findById(userId).select('passwordChangedAt').lean();
    if (!user) {
      return res.status(401).json({ msg: 'User no longer exists' });
    }

    const issuedAtMs = Number(decoded.iat || 0) * 1000;
    const passwordChangedAtMs = user.passwordChangedAt ? new Date(user.passwordChangedAt).getTime() : 0;
    if (passwordChangedAtMs && (!issuedAtMs || issuedAtMs + 1000 < passwordChangedAtMs)) {
      return res.status(401).json({ msg: 'Session expired. Please log in again.' });
    }

    req.user = userId;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
