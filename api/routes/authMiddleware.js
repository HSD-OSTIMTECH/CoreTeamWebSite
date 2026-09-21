import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Retrieves the JWT Secret securely.
 * Rejects application start / token verification if missing, preventing insecure fallback attacks.
 */
export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('CRITICAL: JWT_SECRET ortam değişkeni tanımlanmamış!');
    throw new Error('Sunucu güvenlik hatası: JWT_SECRET tanımlanmamış.');
  }
  return secret;
};

export const MANAGEMENT_RANKS = [
  'başkan',
  'baskan',
  'başkan yardımcısı',
  'baskan yardimcisi',
  'komite başkanı',
  'komite baskani',
  'developer',
  'admin'
];

export const ADMIN_RANKS = [
  'başkan',
  'baskan',
  'başkan yardımcısı',
  'baskan yardimcisi',
  'developer',
  'admin'
];

export const normalizeRank = (rank) => {
  return String(rank || '')
    .toLocaleLowerCase('tr-TR')
    .trim();
};

/**
 * Optional token verification middleware.
 * If Authorization: Bearer <token> is provided, decodes the token and attaches req.user.
 */
export const verifyTokenOptional = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret);
      req.user = decoded;
    } catch (err) {
      // Invalid or expired token - proceed without req.user
    }
  }

  next();
};

/**
 * Strict token verification middleware (requires a valid JWT token).
 */
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Oturum açmanız gerekiyor (Yetkilendirme başlığı eksik).' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Oturum süresi dolmuş veya geçersiz token. Lütfen tekrar giriş yapın.' });
  }
};

/**
 * Requires management rank (Başkan, Bşk. Yrd., Komite Başkanı, Developer, Admin).
 */
export const requireManager = (req, res, next) => {
  requireAuth(req, res, () => {
    const rank = normalizeRank(req.user?.rank);
    if (!MANAGEMENT_RANKS.includes(rank)) {
      return res.status(403).json({ error: 'Bu işlem için yönetici yetkisi gereklidir.' });
    }
    next();
  });
};

/**
 * Requires high admin rank (Başkan, Bşk. Yrd., Developer, Admin).
 * Used for creating, modifying, and deleting users.
 */
export const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    const rank = normalizeRank(req.user?.rank);
    if (!ADMIN_RANKS.includes(rank)) {
      return res.status(403).json({ error: 'Bu işlem için üst yönetici (Admin) yetkisi gereklidir.' });
    }
    next();
  });
};
