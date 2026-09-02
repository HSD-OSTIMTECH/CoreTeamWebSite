import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Optional token verification middleware.
 * If Authorization: Bearer <token> is provided, decodes the token and attaches req.user.
 * If token is missing, allows the request to continue (preserves backwards compatibility).
 */
export const verifyTokenOptional = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_change_this_later');
      req.user = decoded;
    } catch (err) {
      console.warn('Invalid JWT token passed:', err.message);
    }
  }

  next();
};

/**
 * Strict token verification middleware (for routes requiring authentication).
 */
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yetkilendirme başlığı eksik veya geçersiz.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_change_this_later');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Oturum süresi dolmuş veya geçersiz token.' });
  }
};
