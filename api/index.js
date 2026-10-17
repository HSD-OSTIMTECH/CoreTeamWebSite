import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import multer from 'multer';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/taskRoutes.js';

dotenv.config();

const app = express();

// Security Headers (Helmet) — CSP eklendi (Bulgu #10)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://*.supabase.co", "blob:"],
        connectSrc: ["'self'", "https://*.supabase.co", "wss://*.supabase.co"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"]
      }
    }
  })
);

// Body Size Limit to prevent large payload DoS - Bulgu #10
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Multer — Dosya yükleme middleware'i (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

// CORS Whitelist Configuration
const envOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://core-team-web-site.vercel.app'
];

const allowedOriginsSet = new Set([...defaultAllowedOrigins, ...envOrigins]);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  const cleanOrigin = origin.replace(/\/$/, '');
  if (allowedOriginsSet.has(cleanOrigin)) return true;
  // Vercel deployment URL'lerini otomatik olarak kabul et (preview ve production)
  if (/^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(cleanOrigin)) return true;
  // Localhost ve 127.0.0.1 (tüm portlar)
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)) return true;
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Vercel Serverless Rewrite URL Fix:
// Vercel rewrites bazen req.url'i '/api/index.js' veya '/api' olarak Express'e aktarabilir.
// Bu middleware, orijinal gelen istek yolunu (req.originalUrl) korur.
app.use((req, res, next) => {
  if (req.url === '/api/index.js' || req.url === '/api' || req.url === '/' || req.url.startsWith('/api/index.js')) {
    if (req.originalUrl && req.originalUrl !== req.url) {
      req.url = req.originalUrl;
    }
  }
  next();
});

// Routes (Hem /api/... hem de direct /... rotalarını destekler)
app.use(['/api/auth', '/auth'], authRoutes);

// Task routes — dosya yükleme için upload middleware'i sadece /upload endpoint'ine uygulanır
app.use(['/api/tasks', '/tasks'], (req, res, next) => {
  if (req.path === '/upload' && req.method === 'POST') {
    upload.single('file')(req, res, next);
  } else {
    next();
  }
}, taskRoutes);

// Health check / Base API endpoint
app.get(['/api', '/api/index.js', '/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', message: 'Club Dashboard API Running' });
});

// API 404 Handler - Express varsayılan HTML hata sayfası yerine JSON döndürür
app.use((req, res) => {
  res.status(404).json({
    error: `API rotası bulunamadı: ${req.method} ${req.originalUrl || req.url}`
  });
});

// Global Error Handler - Her zaman HTML yerine JSON formatında hata döner
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Sunucu içi hata oluştu.'
  });
});

export default app;
