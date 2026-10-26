import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import {
  verifyTokenOptional,
  requireAuth,
  requireManager,
  requireAdmin,
  getJwtSecret,
  normalizeRank,
  ADMIN_RANKS
} from './authMiddleware.js';

dotenv.config();

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL: SUPABASE_URL ve SUPABASE_KEY ortam değişkenleri tanımlanmamış!');
}

const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Supabase yapılandırma kontrol middleware'i
router.use((req, res, next) => {
  if (!supabase) {
    return res.status(500).json({
      error: 'Sunucu yapılandırma hatası: Vercel üzerinde SUPABASE_URL ve SUPABASE_KEY ortam değişkenleri tanımlanmamış. Lütfen Vercel Dashboard > Settings > Environment Variables bölümüne değişkenleri ekleyip yeniden dağıtın (redeploy).'
    });
  }
  next();
});

// Parse incoming Bearer tokens if present (non-breaking)
router.use(verifyTokenOptional);

// Login (Herhangi bir şifre bekleme / kilitlenme süresi olmadan doğrudan giriş)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });
    }

    const cleanUsername = String(username || '').trim().toLocaleLowerCase('tr-TR');

    // Fetch user from custom_users table in Supabase (büyük/küçük harf duyarsız ve boşluksuz)
    const { data: user, error } = await supabase
      .from('custom_users')
      .select('*')
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (error || !user) {
      // Kullanıcı bulunamadı — user enumeration önleme: aynı mesaj döndür
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      // Hatalı şifre — aynı mesaj (user enumeration koruması)
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    }

    // Generate JWT token with strict secret and 24h expiration (Bulgu #2 & #5)
    const jwtSecret = getJwtSecret();
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        rank: user.rank,
        roles: user.roles
      },
      jwtSecret,
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Giriş başarılı.',
      token,
      user: {
        id: user.id,
        username: user.username || 'Bilinmiyor',
        full_name: user.full_name || user.username || 'Bilinmiyor',
        rank: user.rank || 'Üye',
        roles: user.roles || [],
        email: user.email || ''
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// Register new user (Admin only)
router.post('/register', requireAdmin, async (req, res) => {
  try {
    const { username, full_name, password, rank, roles } = req.body;

    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'Kullanıcı adı, Ad Soyad ve şifre zorunludur.' });
    }

    // Input validation
    if (!/^[a-zA-Z0-9ğüşıöçĞÜŞİÖÇ._-]{2,50}$/.test(username.trim())) {
      return res.status(400).json({ error: 'Kullanıcı adı sadece harf, rakam, nokta, alt çizgi ve tire içerebilir (2-50 karakter).' });
    }

    if (full_name.trim().length < 2 || full_name.trim().length > 100) {
      return res.status(400).json({ error: 'Ad Soyad 2-100 karakter arasında olmalıdır.' });
    }

    const cleanUsername = username.trim().toLocaleLowerCase('tr-TR');

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('custom_users')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
    }

    // Hash password with salt rounds = 10
    const password_hash = await bcrypt.hash(password, 10);

    // Insert user
    const { data: newUser, error } = await supabase
      .from('custom_users')
      .insert([{
        username: cleanUsername,
        full_name: full_name.trim(),
        password_hash,
        rank: rank || 'üye',
        roles: Array.isArray(roles) ? roles : []
      }])
      .select('id, username, full_name, rank, roles, created_at')
      .single();

    if (error) {
      console.error('User register error:', error);
      return res.status(500).json({ error: 'Kullanıcı kaydedilemedi.' });
    }

    res.status(201).json({
      message: 'Kullanıcı başarıyla oluşturuldu.',
      user: newUser
    });

  } catch (err) {
    console.error('Register server error:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// Update user (Admin only)
router.put('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, rank, roles, password } = req.body;

    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name.trim();
    if (rank !== undefined) updateData.rank = rank;
    if (roles !== undefined) updateData.roles = Array.isArray(roles) ? roles : [];
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    const { data: updatedUser, error } = await supabase
      .from('custom_users')
      .update(updateData)
      .eq('id', id)
      .select('id, username, full_name, rank, roles, created_at')
      .single();

    if (error) {
      console.error('Update user error:', error);
      return res.status(500).json({ error: 'Kullanıcı güncellenemedi.' });
    }

    res.json({ message: 'Kullanıcı başarıyla güncellendi.', user: updatedUser });
  } catch (err) {
    console.error('Update user server error:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// Delete user (Admin only) - Bulgu #13
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Kullanıcı ID gereklidir.' });

    // İlişkili tabloları temizle (cascade fallback)
    const cleanups = await Promise.allSettled([
      supabase.from('task_assignments').delete().eq('user_id', id),
      supabase.from('announcement_recipients').delete().eq('user_id', id),
      supabase.from('notifications').delete().eq('user_id', id)
    ]);

    cleanups.forEach((result, idx) => {
      if (result.status === 'rejected') {
        console.warn(`İlişkili tablo temizleme uyarısı (indeks: ${idx}):`, result.reason);
      }
    });

    const { error } = await supabase
      .from('custom_users')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Kullanıcı silme hatası:', error);
      return res.status(500).json({ error: 'Kullanıcı silinemedi.' });
    }

    res.json({ message: 'Kullanıcı başarıyla silindi.' });
  } catch (err) {
    console.error('Delete user server error:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// Get all users (Authenticated members only)
router.get('/users', requireAuth, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('custom_users')
      .select('id, username, full_name, rank, roles, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Supabase Users Error:", error);
      return res.status(500).json({ error: 'Kullanıcı listesi alınamadı.' });
    }

    res.json(users || []);
  } catch (err) {
    console.error('Users server error:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// Get notifications for a user (Authenticated only - IDOR protected) - Bulgu #4
router.get('/notifications/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // IDOR Koruması: Sadece kullanıcı kendi bildirimlerini veya Adminler görebilir
    if (req.user?.id !== userId && !ADMIN_RANKS.includes(normalizeRank(req.user?.rank))) {
      return res.status(403).json({ error: 'Sadece kendi bildirimlerinize erişebilirsiniz.' });
    }

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error("Supabase Notifications Error:", error);
      return res.status(500).json({ error: 'Bildirimler alınamadı.' });
    }

    res.json(notifications || []);
  } catch (err) {
    console.error('Notifications server error:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// Mark notifications as read (Authenticated only - IDOR protected) - Bulgu #4
router.put('/notifications/:userId/mark-read', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // IDOR Koruması: Sadece kullanıcı kendi bildirimlerini veya Adminler okundu işaretleyebilir
    if (req.user?.id !== userId && !ADMIN_RANKS.includes(normalizeRank(req.user?.rank))) {
      return res.status(403).json({ error: 'Bu bildirimleri güncelleme yetkiniz bulunmuyor.' });
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error("Supabase Notification Mark Read Error:", error);
      return res.status(500).json({ error: 'Bildirimler güncellenemedi.' });
    }

    res.json({ message: 'Bildirimler okundu işaretlendi.' });
  } catch (err) {
    console.error('Notifications mark read error:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// Get announcements for a user (Authenticated only - IDOR protected) - Bulgu #4
router.get('/announcements/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || userId === 'undefined') {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // IDOR Koruması: Sadece kullanıcı kendi duyurularına veya Adminler erişebilir
    if (req.user?.id !== userId && !ADMIN_RANKS.includes(normalizeRank(req.user?.rank))) {
      return res.status(403).json({ error: 'Sadece kendi duyurularınıza erişebilirsiniz.' });
    }

    const { data: recipients, error: recipientError } = await supabase
      .from('announcement_recipients')
      .select('announcement_id')
      .eq('user_id', userId);

    if (recipientError && recipientError.code !== 'PGRST116') {
      console.error("Recipients Error:", recipientError);
      return res.status(500).json({ error: 'Duyurular alınamadı.' });
    }

    if (!recipients || recipients.length === 0) {
      return res.json([]);
    }

    const announcementIds = recipients.map(r => r.announcement_id);

    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .in('id', announcementIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Supabase Announcements Error:", error);
      return res.status(500).json({ error: 'Duyurular alınamadı.' });
    }

    res.json(data || []);
  } catch (err) {
    console.error('Announcement fetch error:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// Create announcement (Manager and Admin only)
router.post('/announcements', requireManager, async (req, res) => {
  try {
    const { title, content, creator_id, creator_name, recipient_ids } = req.body;

    if (!title || !content || !creator_id || !recipient_ids || !Array.isArray(recipient_ids)) {
      return res.status(400).json({ error: 'Gerekli alanlar eksik' });
    }

    // Create announcement
    const { data: annData, error: annError } = await supabase
      .from('announcements')
      .insert([{ title, content, creator_id, creator_name }])
      .select()
      .single();

    if (annError) {
      console.error('Announcement insert error:', annError);
      return res.status(500).json({ error: 'Duyuru kaydedilemedi.' });
    }

    // Add recipients
    const recipientData = recipient_ids.map(userId => ({
      announcement_id: annData.id,
      user_id: userId,
      is_read: false
    }));

    const { error: recError } = await supabase
      .from('announcement_recipients')
      .insert(recipientData);

    if (recError) {
      console.error('Recipients insert error:', recError);
      return res.status(500).json({ error: 'Duyuru alıcıları kaydedilemedi.' });
    }

    // Create notifications for each recipient
    const notifications = recipient_ids.map(userId => ({
      user_id: userId,
      message: `📢 Yeni duyuru: ${title}`,
      is_read: false
    }));

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notifError) {
      console.warn('Bildirimler oluşturulamadı ama duyuru başarılı:', notifError);
    }

    res.json({ 
      message: 'Duyuru başarıyla oluşturuldu.',
      announcement: annData,
      notificationsCreated: !notifError
    });
  } catch (err) {
    console.error('Duyuru oluşturma hatası:', err);
    res.status(500).json({ error: 'Duyuru oluşturulamadı.' });
  }
});

// Mark announcement as read (Authenticated only - IDOR protected) - Bulgu #4
router.put('/announcements/:announcementId/mark-read', requireAuth, async (req, res) => {
  try {
    const { announcementId } = req.params;
    const { userId } = req.body;

    if (!announcementId || !userId) {
      return res.status(400).json({ error: 'Gerekli parametreler eksik' });
    }

    // IDOR Koruması: Sadece kullanıcı kendi duyurusunu veya Adminler okundu işaretleyebilir
    if (req.user?.id !== userId && !ADMIN_RANKS.includes(normalizeRank(req.user?.rank))) {
      return res.status(403).json({ error: 'Bu duyuruyu güncelleme yetkiniz bulunmuyor.' });
    }

    const { error } = await supabase
      .from('announcement_recipients')
      .update({ is_read: true })
      .eq('announcement_id', announcementId)
      .eq('user_id', userId);

    if (error) {
      console.error('Duyuru güncelleme hatası:', error);
      return res.status(500).json({ error: 'Duyuru güncellenemedi.' });
    }

    res.json({ message: 'Duyuru okundu işaretlendi.' });
  } catch (err) {
    console.error('Duyuru okundu işaretleme hatası:', err);
    res.status(500).json({ error: 'Duyuru güncellenemedi.' });
  }
});

export default router;
