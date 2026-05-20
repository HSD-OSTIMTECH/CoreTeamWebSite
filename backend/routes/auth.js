import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Fetch user from custom_users table in Supabase
    const { data: user, error } = await supabase
      .from('custom_users')
      .select('*')
      .eq('username', username)
      .single();

    if (error) {
      console.error("Supabase Error:", error);
      return res.status(401).json({ error: 'Database Hatası: Tablo veya kayıt bulunamadı.', details: error });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
    }

    // Check password
    // The password in DB is hashed using postgres pgcrypto bf (bcrypt)
    // We can use node bcrypt to compare it
    // Wait: Actually, bcrypt.compare works exactly with postgres gen_salt('bf') hashes!
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
        return res.status(401).json({ error: 'Hatalı şifre girdiniz.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, rank: user.rank, roles: user.roles },
      process.env.JWT_SECRET || 'supersecretkey_change_this_later',
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username || 'Bilinmiyor',
        rank: user.rank || 'Üye',
        roles: user.roles || [],
        email: user.email || ''
      }
    });

  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users (for task assignments)
router.get('/users', async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('custom_users')
      .select('id, username, rank')
      .order('username', { ascending: true });

    if (error) {
      console.error("Supabase Error:", error);
      return res.status(500).json({ error: 'Kullanıcı listesi alınamadı.', details: error });
    }

    res.json(users || []);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get notifications for a user
router.get('/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error("Supabase Error:", error);
      return res.status(500).json({ error: 'Bildirimler alınamadı.', details: error });
    }

    res.json(notifications || []);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark notifications as read
router.put('/notifications/:userId/mark-read', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error("Supabase Error:", error);
      return res.status(500).json({ error: 'Bildirimler güncellenemedi.', details: error });
    }

    res.json({ message: 'Bildirimler okundu işaretlendi.' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get announcements for a user
router.get('/announcements/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || userId === 'undefined') {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Önce user'ın aldığı announcement_recipients'i al
    const { data: recipients, error: recipientError } = await supabase
      .from('announcement_recipients')
      .select('announcement_id')
      .eq('user_id', userId);

    if (recipientError && recipientError.code !== 'PGRST116') {
      console.error("Recipients Error:", recipientError);
      return res.status(500).json({ error: 'Duyurular alınamadı.', details: recipientError.message });
    }

    if (!recipients || recipients.length === 0) {
      return res.json([]);
    }

    // Announcement ID'lerini çıkart
    const announcementIds = recipients.map(r => r.announcement_id);

    // Bu ID'lerin announcement'larını çek
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .in('id', announcementIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Supabase Error:", error);
      return res.status(500).json({ error: 'Duyurular alınamadı.', details: error.message });
    }

    res.json(data || []);
  } catch (err) {
    console.error('Announcement fetch error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Create announcement (admin only)
router.post('/announcements', async (req, res) => {
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
      throw annError;
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
      throw recError;
    }

    // Create notifications for each recipient
    const notifications = recipient_ids.map(userId => ({
      user_id: userId,
      message: `📢 Yeni duyuru: ${title}`,
      is_read: false
    }));

    const { data: notifData, error: notifError } = await supabase
      .from('notifications')
      .insert(notifications)
      .select();

    if (notifError) {
      console.error('Notifications insert error:', notifError);
      // Duyuru zaten oluştu, sadece bildir ama hata dönme
      console.warn('Bildirimler oluşturulamadı ama duyuru başarılı');
    }

    res.json({ 
      message: 'Duyuru başarıyla oluşturuldu',
      announcement: annData,
      notificationsCreated: !notifError
    });
  } catch (err) {
    console.error('Duyuru oluşturma hatası:', err);
    res.status(500).json({ error: 'Duyuru oluşturulamadı', details: err.message });
  }
});

// Mark announcement as read
router.put('/announcements/:announcementId/mark-read', async (req, res) => {
  try {
    const { announcementId } = req.params;
    const { userId } = req.body;

    if (!announcementId || !userId) {
      return res.status(400).json({ error: 'Gerekli parametreler eksik' });
    }

    const { error } = await supabase
      .from('announcement_recipients')
      .update({ is_read: true })
      .eq('announcement_id', announcementId)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ message: 'Duyuru okundu işaretlendi.' });
  } catch (err) {
    res.status(500).json({ error: 'Duyuru güncellenemedi' });
  }
});

export default router;
