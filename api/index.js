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

// CORS Whitelist Configuration — Wildcard düzeltildi (Bulgu #4)
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

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/$/, '');
      if (allowedOriginsSet.has(cleanOrigin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy: "${origin}" adresinden erişim reddedildi.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Routes
app.use('/api/auth', authRoutes);

// Task routes — dosya yükleme için upload middleware'i sadece /upload endpoint'ine uygulanır
app.use('/api/tasks', (req, res, next) => {
  if (req.path === '/upload' && req.method === 'POST') {
    upload.single('file')(req, res, next);
  } else {
    next();
  }
}, taskRoutes);

app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: 'Club Dashboard API Running' });
});

export default app;
