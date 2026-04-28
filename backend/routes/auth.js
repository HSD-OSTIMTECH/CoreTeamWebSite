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
        username: user.username,
        rank: user.rank,
        roles: user.roles
      }
    });

  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
