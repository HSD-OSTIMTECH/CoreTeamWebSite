import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import {
  requireAuth,
  requireManager,
  normalizeRank,
  ADMIN_RANKS,
  MANAGEMENT_RANKS
} from './authMiddleware.js';
import { createReadStream } from 'fs';

dotenv.config();

const router = express.Router();

// Backend Supabase Client — Service Role (RLS bypass)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL: SUPABASE_URL ve SUPABASE_KEY tanımlanmalıdır.');
}

const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

router.use((req, res, next) => {
  if (!supabase) {
    return res.status(500).json({
      error: 'Sunucu yapılandırma hatası: Vercel üzerinde SUPABASE_URL ve SUPABASE_KEY ortam değişkenleri tanımlanmamış.'
    });
  }
  next();
});

// ---- Helpers ----

const sanitizeText = (text, maxLength = 500) => {
  if (!text || typeof text !== 'string') return '';
  return text.trim().slice(0, maxLength);
};

const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (/^(javascript:|data:|vbscript:)/i.test(trimmed)) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}(\.[a-zA-Z0-9-]{1,62})+/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return '';
};

const isUserAdmin = (user) => ADMIN_RANKS.includes(normalizeRank(user?.rank));
const isUserManager = (user) => MANAGEMENT_RANKS.includes(normalizeRank(user?.rank));

const canCreateInCommittee = (user, committee) => {
  if (isUserAdmin(user)) return true;
  const normalizedCommittee = sanitizeText(committee, 50) || 'genel';
  if (normalizedCommittee === 'genel') return isUserManager(user);
  return Array.isArray(user?.roles) && user.roles.includes(normalizedCommittee);
};

const canManageTask = (user, task) => {
  if (!user || !task) return false;
  if (isUserAdmin(user)) return true;
  if (String(user.id) === String(task.creator_id)) return true;
  if (!isUserManager(user)) return false;
  const committee = task.committee || 'genel';
  if (committee === 'genel') return true;
  return Array.isArray(user.roles) && user.roles.includes(committee);
};

// ========================================================================
// POST /api/tasks — Create task + assignments + notifications
// ========================================================================
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, description, link_url, attachment_url, committee, column_id, priority, assignedUsers, start_date, end_date } = req.body;

    if (!title || !sanitizeText(title)) {
      return res.status(400).json({ error: 'Görev başlığı zorunludur.' });
    }

    const targetCommittee = sanitizeText(committee, 50) || 'genel';
    if (!canCreateInCommittee(req.user, targetCommittee)) {
      return res.status(403).json({ error: 'Bu komitede görev oluşturma yetkiniz bulunmuyor.' });
    }

    const isCompleted = (column_id || '').toLowerCase().includes('tamam');
    const taskPayload = {
      title: sanitizeText(title, 200),
      description: sanitizeText(description, 2000),
      link_url: sanitizeUrl(link_url),
      attachment_url: attachment_url || '',
      committee: sanitizeText(committee, 50) || 'genel',
      column_id: sanitizeText(column_id, 50) || 'PLANLAMA',
      priority: ['DÜŞÜK', 'NORMAL', 'YÜKSEK', 'ACİL'].includes((priority || '').toUpperCase()) ? priority.toUpperCase() : 'NORMAL',
      status: isCompleted ? 'completed' : 'pending',
      creator_id: req.user.id,
      creator_name: req.user.full_name || req.user.username || 'Bilinmiyor',
      start_date: start_date || null,
      end_date: end_date || null,
      updated_at: new Date().toISOString()
    };

    const { data: newTask, error: taskError } = await supabase
      .from('tasks')
      .insert([taskPayload])
      .select()
      .single();

    if (taskError) {
      console.error('Task create error:', taskError);
      return res.status(500).json({ error: 'Görev oluşturulamadı.' });
    }

    // Create assignments
    const userIds = Array.isArray(assignedUsers) ? assignedUsers : [];
    if (userIds.length > 0) {
      // Fetch user names for assignments
      const { data: users } = await supabase
        .from('custom_users')
        .select('id, username, full_name')
        .in('id', userIds);

      const userMap = {};
      (users || []).forEach(u => { userMap[u.id] = u.full_name || u.username || 'Bilinmiyor'; });

      const assignments = userIds.map(userId => ({
        task_id: newTask.id,
        user_id: userId,
        user_name: userMap[userId] || 'Bilinmiyor',
        status: 'pending'
      }));

      const { error: assignError } = await supabase.from('task_assignments').insert(assignments);
      if (assignError) console.warn('Assignment insert warning:', assignError);

      // Create notifications (exclude task creator)
      const notifTargets = userIds.filter(uid => uid !== req.user.id);
      if (notifTargets.length > 0) {
        const notifications = notifTargets.map(userId => ({
          user_id: userId,
          message: `${req.user.full_name || req.user.username} size yeni bir görev atadı: ${taskPayload.title}`,
          is_read: false
        }));
        await supabase.from('notifications').insert(notifications);
      }
    }

    res.status(201).json({ message: 'Görev oluşturuldu.', task: newTask });
  } catch (err) {
    console.error('Task create server error:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// ========================================================================
// PUT /api/tasks/:id — Update task (manager or creator only)
// ========================================================================
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, link_url, attachment_url, committee, column_id, priority, assignedUsers, start_date, end_date } = req.body;

    // Check task ownership & committee authority
    const { data: existingTask, error: fetchError } = await supabase
      .from('tasks')
      .select('creator_id, committee, column_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingTask) {
      return res.status(404).json({ error: 'Görev bulunamadı.' });
    }

    if (!canManageTask(req.user, existingTask)) {
      return res.status(403).json({ error: 'Bu görevi güncelleme yetkiniz bulunmuyor.' });
    }

    const nextCommittee = sanitizeText(committee, 50) || existingTask.committee || 'genel';
    if (nextCommittee !== (existingTask.committee || 'genel') && !canCreateInCommittee(req.user, nextCommittee)) {
      return res.status(403).json({ error: 'Görevi yetkili olmadığınız bir komiteye taşıyamazsınız.' });
    }

    const wasCompleted = (existingTask.column_id || '').toLowerCase().includes('tamam');
    const isCompleted = (column_id || '').toLowerCase().includes('tamam');
    const updatePayload = {
      title: sanitizeText(title, 200),
      description: sanitizeText(description, 2000),
      link_url: sanitizeUrl(link_url),
      attachment_url: attachment_url || '',
      committee: sanitizeText(committee, 50) || 'genel',
      column_id: sanitizeText(column_id, 50),
      priority: ['DÜŞÜK', 'NORMAL', 'YÜKSEK', 'ACİL'].includes((priority || '').toUpperCase()) ? priority.toUpperCase() : 'NORMAL',
      status: isCompleted ? 'completed' : 'pending',
      start_date: start_date || null,
      end_date: end_date || null,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('tasks')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) {
      console.error('Task update error:', updateError);
      return res.status(500).json({ error: 'Görev güncellenemedi.' });
    }

    // Update assignments if provided and user is authorized
    const canManageAssignees = canManageTask(req.user, existingTask);

    if (canManageAssignees && Array.isArray(assignedUsers)) {
      // Mevcut atamaları koruyarak sadece eklenen/çıkarılan kullanıcıları güncelle
      const { data: prevAssignments } = await supabase
        .from('task_assignments')
        .select('user_id')
        .eq('task_id', id);
      const prevIds = (prevAssignments || []).map(a => String(a.user_id));
      const nextIds = [...new Set(assignedUsers.map(uid => String(uid)))];

      const removedIds = prevIds.filter(uid => !nextIds.includes(uid));
      const addedIds = nextIds.filter(uid => !prevIds.includes(uid));

      if (removedIds.length > 0) {
        await supabase
          .from('task_assignments')
          .delete()
          .eq('task_id', id)
          .in('user_id', removedIds);
      }

      if (addedIds.length > 0) {
        const { data: users } = await supabase
          .from('custom_users')
          .select('id, username, full_name')
          .in('id', addedIds);

        const userMap = {};
        (users || []).forEach(u => { userMap[String(u.id)] = u.full_name || u.username || 'Bilinmiyor'; });

        const newAssignments = addedIds.map(userId => ({
          task_id: id,
          user_id: userId,
          user_name: userMap[userId] || 'Bilinmiyor',
          status: 'pending'
        }));

        await supabase.from('task_assignments').insert(newAssignments);

        // Yeni atanan kullanıcılara bildirim gönder
        const newlyAssigned = addedIds.filter(uid => uid !== String(req.user.id));
        if (newlyAssigned.length > 0) {
          const notifications = newlyAssigned.map(userId => ({
            user_id: userId,
            message: `Size yeni bir görev atandı: ${updatePayload.title}`,
            is_read: false
          }));
          await supabase.from('notifications').insert(notifications);
        }
      }
    }

    // Eğer sütun Tamamlandı <-> Aktif sınırını geçtiyse atama durumlarını da senkronize et
    if (wasCompleted && !isCompleted) {
      await supabase
        .from('task_assignments')
        .update({ status: 'pending', completed_at: null })
        .eq('task_id', id);
    } else if (!wasCompleted && isCompleted) {
      await supabase
        .from('task_assignments')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('task_id', id);
    }

    res.json({ message: 'Görev güncellendi.' });
  } catch (err) {
    console.error('Task update server error:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// ========================================================================
// DELETE /api/tasks/:id — Delete task (manager or creator only)
// ========================================================================
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existingTask, error: fetchError } = await supabase
      .from('tasks')
      .select('creator_id, committee')
      .eq('id', id)
      .single();

    if (fetchError || !existingTask) {
      return res.status(404).json({ error: 'Görev bulunamadı.' });
    }

    if (!canManageTask(req.user, existingTask)) {
      return res.status(403).json({ error: 'Bu görevi silme yetkiniz bulunmuyor.' });
    }

    // Delete assignments first (if no CASCADE)
    await supabase.from('task_assignments').delete().eq('task_id', id);

    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
      console.error('Task delete error:', error);
      return res.status(500).json({ error: 'Görev silinemedi.' });
    }

    res.json({ message: 'Görev silindi.' });
  } catch (err) {
    console.error('Task delete server error:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

const COMMITTEE_COMPLETED_COLUMNS = {
  proje: 'TAMAMLANDI',
  etkinlik: 'TAMAMLANAN',
  sosyal: 'TAMAMLANAN',
  medium: 'TAMAMLANDI',
  genel: 'TAMAMLANAN'
};

const COMMITTEE_IN_PROGRESS_COLUMNS = {
  proje: 'DEVAM_EDENLER',
  etkinlik: 'DEVAM_EDEN',
  sosyal: 'URETIMDE',
  medium: 'INCELEMEDE',
  genel: 'DEVAM_EDEN'
};

// ========================================================================
// PUT /api/tasks/:taskId/status — Toggle own assignment status
// ========================================================================
router.put('/:taskId/status', requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    // Get current assignment
    const { data: assignment, error: fetchError } = await supabase
      .from('task_assignments')
      .select('status')
      .eq('task_id', taskId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !assignment) {
      return res.status(404).json({ error: 'Bu görevde atamanız bulunamadı.' });
    }

    const newStatus = assignment.status === 'completed' ? 'pending' : 'completed';

    const { error } = await supabase
      .from('task_assignments')
      .update({
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null
      })
      .eq('task_id', taskId)
      .eq('user_id', userId);

    if (error) {
      console.error('Status toggle error:', error);
      return res.status(500).json({ error: 'Durum güncellenemedi.' });
    }

    // Komite panosu sütununu tüm atanan kişilerin durumuna göre senkronize et
    let syncedColumnId = null;
    let allCompleted = false;

    const [{ data: taskRow }, { data: allAssignments }] = await Promise.all([
      supabase.from('tasks').select('committee, column_id').eq('id', taskId).maybeSingle(),
      supabase.from('task_assignments').select('status').eq('task_id', taskId)
    ]);

    if (taskRow && Array.isArray(allAssignments) && allAssignments.length > 0) {
      const committeeKey = (taskRow.committee || 'genel').toLowerCase();
      allCompleted = allAssignments.every(a => a.status === 'completed');
      const isCurrentlyCompletedCol = (taskRow.column_id || '').toLowerCase().includes('tamam');

      if (allCompleted && !isCurrentlyCompletedCol) {
        syncedColumnId = COMMITTEE_COMPLETED_COLUMNS[committeeKey] || 'TAMAMLANAN';
        await supabase
          .from('tasks')
          .update({
            column_id: syncedColumnId,
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', taskId);
      } else if (!allCompleted && isCurrentlyCompletedCol) {
        syncedColumnId = COMMITTEE_IN_PROGRESS_COLUMNS[committeeKey] || 'DEVAM_EDEN';
        await supabase
          .from('tasks')
          .update({
            column_id: syncedColumnId,
            status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', taskId);
      }
    }

    res.json({
      message: 'Görev durumu güncellendi.',
      status: newStatus,
      allCompleted,
      column_id: syncedColumnId
    });
  } catch (err) {
    console.error('Status toggle server error:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// ========================================================================
// PUT /api/tasks/:taskId/column — Move task to column (Kanban drag)
// ========================================================================
router.put('/:taskId/column', requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { column_id } = req.body;

    if (!column_id) {
      return res.status(400).json({ error: 'Sütun ID gereklidir.' });
    }

    // Görevi ve atanan kişileri doğrula (BOLA / IDOR Koruması)
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('id, creator_id, committee, column_id, task_assignments(user_id)')
      .eq('id', taskId)
      .maybeSingle();

    if (fetchError || !task) {
      return res.status(404).json({ error: 'Görev bulunamadı.' });
    }

    const isAdmin = isUserAdmin(req.user);
    const isCreator = String(req.user?.id) === String(task.creator_id);
    const isAssigned = Array.isArray(task.task_assignments) && task.task_assignments.some(a => String(a.user_id) === String(req.user?.id));
    const hasCommitteeRole = Array.isArray(req.user?.roles) && req.user.roles.includes(task.committee);

    if (!isAdmin && !isCreator && !isAssigned && !hasCommitteeRole) {
      return res.status(403).json({ error: 'Bu görevin sütununu değiştirme yetkiniz bulunmuyor.' });
    }

    const wasCompleted = (task.column_id || '').toLowerCase().includes('tamam');
    const isCompleted = column_id.toLowerCase().includes('tamam');
    const { error } = await supabase
      .from('tasks')
      .update({
        column_id: sanitizeText(column_id, 50),
        status: isCompleted ? 'completed' : 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);

    if (error) {
      console.error('Column move error:', error);
      return res.status(500).json({ error: 'Sütun güncellenemedi.' });
    }

    // Tamamlandı sütunundan geri çekilince veya tamamlandıya taşınınca atama durumlarını senkronize et
    if (wasCompleted && !isCompleted) {
      await supabase
        .from('task_assignments')
        .update({ status: 'pending', completed_at: null })
        .eq('task_id', taskId);
    } else if (!wasCompleted && isCompleted) {
      await supabase
        .from('task_assignments')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('task_id', taskId);
    }

    res.json({ message: 'Görev taşındı.' });
  } catch (err) {
    console.error('Column move server error:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// ========================================================================
// POST /api/tasks/upload — File upload proxy (multer)
// ========================================================================
router.post('/upload', requireAuth, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya bulunamadı.' });
    }

    const file = req.file;

    // Güvenli dosya uzantıları beyaz listesi (Stored XSS ve SVG istismarlarını engeller)
    const ALLOWED_EXTENSIONS = [
      'pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif',
      'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
      'zip', 'rar', '7z', 'tar', 'gz', 'txt', 'csv'
    ];
    const ext = (file.originalname.split('.').pop() || '').toLowerCase().trim();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({
        error: 'Güvenlik sebebiyle bu dosya türüne izin verilmiyor. Yalnızca PDF, görsel (PNG, JPG, WEBP, GIF), ofis belgesi ve arşiv yükleyebilirsiniz.'
      });
    }

    // 4MB limit (Vercel Serverless Function 4.5MB gövde sınırı ile uyumlu)
    if (file.size > 4 * 1024 * 1024) {
      return res.status(400).json({ error: 'Dosya boyutu çok büyük. Maksimum: 4MB.' });
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('task-attachments')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return res.status(500).json({ error: 'Dosya yüklenemedi.' });
    }

    const { data } = supabase.storage
      .from('task-attachments')
      .getPublicUrl(fileName);

    res.json({ publicUrl: data.publicUrl });
  } catch (err) {
    console.error('Upload server error:', err);
    res.status(500).json({ error: 'Dosya yükleme hatası.' });
  }
});

// ========================================================================
// DELETE /api/tasks/notifications/clear — Clear own notifications
// ========================================================================
router.delete('/notifications/clear', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Notification clear error:', error);
      return res.status(500).json({ error: 'Bildirimler temizlenemedi.' });
    }

    res.json({ message: 'Bildirimler temizlendi.' });
  } catch (err) {
    console.error('Notification clear server error:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

export default router;
