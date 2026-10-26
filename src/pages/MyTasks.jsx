import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch, API_BASE_URL } from '../lib/api';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import { 
  Calendar, Plus, Users, Trash2, Edit2, CheckCircle, Clock, X, 
  AlertCircle, Search, UserCheck, Link as LinkIcon, FileText, Upload, Lock 
} from 'lucide-react';
import { isManager } from '../lib/roles';
import { PRIORITY_OPTIONS, getPriorityMeta } from '../lib/priority';
import { sanitizeUrl, validateFileUpload } from '../lib/security';

const DEFAULT_COMMITTEE_COLUMNS = {
  etkinlik: 'PLANLAMA',
  proje: 'YAPILACAKLAR',
  sosyal: 'PLANLANAN',
  medium: 'TASLAK'
};

const MyTasks = () => {
  const { user } = useAuth();
  const { success, error: toastError, warning } = useToast();
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    id: null,
    title: '',
    description: '',
    assignedUsers: [],
    link_url: '',
    attachment_url: '',
    committee: '',
    priority: 'NORMAL'
  });
  const [selectedFile, setSelectedFile] = useState(null);

  const isAuthorized = isManager(user);

  useEffect(() => {
    fetchData();

    // Supabase Realtime ile tasks ve task_assignments tablolarını canlı dinle
    const channel = supabase
      .channel('realtime-my-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignments' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const notifyDashboardRefresh = () => {
    window.dispatchEvent(new Event('dashboard-refresh'));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const currentUser = user;

      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          task_assignments (
            user_id,
            user_name,
            status,
            completed_at
          )
        `)
        .order('created_at', { ascending: false })
        .limit(150);

      if (tasksError) throw tasksError;

      // Filter tasks based on user role and identity
      if (currentUser) {
        const filteredTasks = (tasksData || []).filter(task => {
          const assignments = task.task_assignments || [];
          return assignments.some(a => String(a.user_id) === String(currentUser.id));
        });
        setTasks(filteredTasks);
      } else {
        setTasks([]);
      }

      const membersRes = await apiFetch('/api/auth/users');
      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData || []);
      }
    } catch (err) {
      console.error('Veri çekme hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file) => {
    try {
      const validation = validateFileUpload(file, 15);
      if (!validation.valid) {
        toastError(validation.error);
        return null;
      }
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);

      const res = await apiFetch('/api/tasks/upload', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Dosya yüklenemedi');
      }

      const data = await res.json();
      return data.publicUrl;
    } catch (error) {
      console.error('Dosya yükleme hatası:', error.message);
      toastError('Dosya yüklenemedi: ' + error.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleCreateOrUpdateTask = async (e) => {
    e.preventDefault();
    if (!formData.title || formData.assignedUsers.length === 0) {
      warning('Lütfen başlık girin ve en az bir kişi atayın.');
      return;
    }

    try {
      let currentAttachmentUrl = formData.attachment_url;

      // Eğer yeni bir dosya seçildiyse yükle
      if (selectedFile) {
        const uploadedUrl = await uploadFile(selectedFile);
        if (uploadedUrl) {
          currentAttachmentUrl = uploadedUrl;
        }
      }

      const defaultCol = formData.committee ? (DEFAULT_COMMITTEE_COLUMNS[formData.committee] || 'PLANLAMA') : 'PLANLAMA';
      const payload = {
        title: formData.title,
        description: formData.description,
        link_url: formData.link_url,
        attachment_url: currentAttachmentUrl,
        committee: formData.committee || 'genel',
        column_id: defaultCol,
        priority: formData.priority || 'NORMAL',
        assignedUsers: formData.assignedUsers
      };

      if (isEditing && formData.id) {
        const res = await apiFetch(`/api/tasks/${formData.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Görev güncellenemedi');
        }
      } else {
        const res = await apiFetch('/api/tasks', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Görev oluşturulamadı');
        }
      }

      setShowModal(false);
      resetForm();
      await fetchData();
      notifyDashboardRefresh();
      success(isEditing ? 'Görev güncellendi.' : 'Görev başarıyla oluşturuldu.');
    } catch (err) {
      console.error('İşlem hatası:', err);
      toastError(err.message || 'Bir hata oluştu.');
    }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm('Bu görevi silmek istediğinize emin misiniz?')) return;
    try {
      const res = await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Görev silinemedi');
      }
      await fetchData();
      notifyDashboardRefresh();
      success('Görev silindi.');
    } catch (err) {
      console.error('Silme hatası:', err);
      toastError(err.message || 'Görev silinirken bir hata oluştu.');
    }
  };

  const toggleTaskStatus = async (task) => {
    const myAssignment = task.task_assignments.find(a => a.user_id === user.id);
    if (!myAssignment) return;

    try {
      const res = await apiFetch(`/api/tasks/${task.id}/status`, { method: 'PUT' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Durum güncellenemedi');
      }
      await fetchData();
      notifyDashboardRefresh();
    } catch (err) {
      console.error('Durum güncelleme hatası:', err);
    }
  };

  const openEditModal = (task) => {
    setFormData({
      id: task.id,
      title: task.title,
      description: task.description,
      assignedUsers: task.task_assignments.map(a => a.user_id),
      link_url: task.link_url || '',
      attachment_url: task.attachment_url || '',
      committee: task.committee || '',
      priority: task.priority || 'NORMAL'
    });
    setSelectedFile(null);
    setIsEditing(true);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ id: null, title: '', description: '', assignedUsers: [], link_url: '', attachment_url: '', committee: '', priority: 'NORMAL' });
    setSelectedFile(null);
    setSearchTerm('');
    setIsEditing(false);
  };

  const filteredMembers = members.filter(m => 
    m.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.rank?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 0.35rem 0' }}>Görevlerim</h1>
          <p className="page-subtitle" style={{ fontSize: '0.95rem', color: 'var(--text-muted)', margin: 0 }}>Size atanan görevler ve görev atamaları.</p>
        </div>
        {isAuthorized && (
          <button 
            onClick={() => { resetForm(); setShowModal(true); }}
            className="btn btn-primary" 
            style={{ 
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.7rem 1.35rem', 
              borderRadius: '12px', 
              fontSize: '0.9rem', 
              fontWeight: '700', 
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(15, 118, 110, 0.2)',
              border: 'none'
            }}
          >
            <Plus size={18} /> Yeni Görev Ekle
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Yükleniyor...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {tasks.length > 0 ? tasks.map(task => (
            <TaskCard 
              key={task.id} 
              task={task} 
              currentUser={user}
              isCreator={user?.id === task.creator_id}
              onDelete={handleDeleteTask}
              onEdit={openEditModal}
              onToggle={toggleTaskStatus}
            />
          )) : (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', backgroundColor: 'var(--surface-color)', borderRadius: '24px', border: '1px dashed var(--border-color)' }}>
              <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
              <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Henüz görev bulunmuyor</h3>
              <p style={{ color: 'var(--text-muted)' }}>Yeni bir görev oluşturarak başlayabilirsiniz.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowModal(false)}></div>
          <div style={{ 
            position: 'relative', 
            width: '100%', 
            maxWidth: '550px', 
            backgroundColor: 'var(--surface-color)', 
            borderRadius: '24px', 
            padding: '2rem', 
            boxShadow: 'var(--shadow-lg)', 
            border: '1px solid var(--border-color)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{isEditing ? 'Görevi Düzenle' : 'Yeni Görev Ata'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <form onSubmit={handleCreateOrUpdateTask}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                 <div style={{ marginBottom: '1.25rem', gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Görev Başlığı</label>
                    <input 
                      type="text" 
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', outline: 'none' }}
                      placeholder="Görevin kısa adı..."
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '1.25rem', gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Açıklama</label>
                    <textarea 
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', outline: 'none', minHeight: '80px', resize: 'vertical' }}
                      placeholder="Görev detayları..."
                    />
                  </div>

                  <div style={{ marginBottom: '1.25rem', gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>İlgili Komite / Sayfa</label>
                    <select 
                      value={formData.committee} 
                      onChange={(e) => setFormData({ ...formData, committee: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="">Genel (Hiçbiri)</option>
                      <option value="proje">Teknoloji ve Proje</option>
                      <option value="etkinlik">Etkinlik ve Sponsorluk</option>
                      <option value="sosyal">Sosyal Medya</option>
                      <option value="medium">Medium</option>
                    </select>
                  </div>

                  {/* Öncelik Seçici */}
                  <div style={{ marginBottom: '1.25rem', gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Öncelik Derecesi
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                      {PRIORITY_OPTIONS.map(p => {
                        const isSelected = (formData.priority || 'NORMAL').toUpperCase() === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, priority: p.id })}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '0.65rem 0.5rem',
                              borderRadius: '10px',
                              fontSize: '0.8rem',
                              fontWeight: isSelected ? '800' : '600',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              backgroundColor: isSelected ? p.bg : 'var(--bg-color)',
                              color: isSelected ? p.color : 'var(--text-muted)',
                              border: isSelected ? `2px solid ${p.border}` : '1px solid var(--border-color)',
                              boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
                            }}
                          >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: p.dot, display: 'inline-block' }} />
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>İlgili Link (İsteğe Bağlı)</label>
                    <div style={{ position: 'relative' }}>
                      <LinkIcon size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input 
                        type="url" 
                        value={formData.link_url}
                        onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                        style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.2rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none' }}
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dosya Ekle (İsteğe Bağlı)</label>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem', 
                      padding: '0.6rem 1rem', 
                      borderRadius: '10px', 
                      border: '1px dashed var(--border-color)', 
                      backgroundColor: 'var(--bg-color)', 
                      color: 'var(--text-muted)', 
                      fontSize: '0.85rem', 
                      cursor: 'pointer',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap'
                    }}>
                      <Upload size={14} /> 
                      {selectedFile ? selectedFile.name : (formData.attachment_url ? 'Dosya yüklü' : 'Dosya seç...')}
                      <input type="file" onChange={(e) => setSelectedFile(e.target.files[0])} style={{ display: 'none' }} />
                    </label>
                  </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Kişi Ata ({formData.assignedUsers.length} Seçili)</label>
                  {!isAuthorized && (
                    <span style={{ fontSize: '0.7rem', color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '600', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '6px' }}>
                      <Lock size={12} /> Yalnızca Yöneticiler Değiştirebilir
                    </span>
                  )}
                </div>
                
                {isAuthorized ? (
                  <>
                    <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                      <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input 
                        type="text" 
                        placeholder="Üye veya rütbe ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none' }}
                      />
                    </div>

                    <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.5rem' }}>
                      {filteredMembers.length > 0 ? filteredMembers.map(member => (
                        <label key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0.5rem', cursor: 'pointer', borderRadius: '8px', transition: 'background-color 0.2s' }} className="hover-bg">
                          <input 
                            type="checkbox" 
                            checked={formData.assignedUsers.includes(member.id)}
                            onChange={(e) => {
                              const updated = e.target.checked 
                                ? [...formData.assignedUsers, member.id]
                                : formData.assignedUsers.filter(id => id !== member.id);
                              setFormData({ ...formData, assignedUsers: updated });
                            }}
                          />
                          <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{member.full_name || member.username}</span>
                          {member.full_name && member.username && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{member.username}</span>
                          )}
                          <span style={{ fontSize: '0.65rem', color: 'var(--primary-color)', backgroundColor: 'var(--primary-bg)', padding: '2px 6px', borderRadius: '4px' }}>{member.rank}</span>
                        </label>
                      )) : (
                        <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Kullanıcı bulunamadı.</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', minHeight: '44px', alignItems: 'center' }}>
                    {formData.assignedUsers.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Atanan kişi bulunmuyor</span>
                    ) : (
                      formData.assignedUsers.map(userId => {
                        const member = members.find(m => m.id === userId);
                        const displayName = member ? (member.full_name || member.username) : 'Üye';
                        return (
                          <div key={userId} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-main)' }}>
                            <UserCheck size={14} color="var(--primary-color)" />
                            <span>{displayName}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              <button 
                type="submit" 
                disabled={uploading}
                style={{ 
                  width: '100%', 
                  padding: '1rem', 
                  backgroundColor: uploading ? 'var(--text-muted)' : 'var(--primary-color)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '12px', 
                  fontWeight: '700', 
                  cursor: uploading ? 'not-allowed' : 'pointer', 
                  boxShadow: '0 4px 6px rgba(15, 118, 110, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                {uploading ? 'Yükleniyor...' : (isEditing ? 'Değişiklikleri Kaydet' : 'Görevi Ata ve Yayınla')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const TaskCard = ({ task, isCreator, currentUser, onDelete, onEdit, onToggle }) => {
  const myAssignment = task.task_assignments?.find(a => a.user_id === currentUser?.id);
  const isCompletedByMe = myAssignment?.status === 'completed';
  
  const totalAssigned = task.task_assignments?.length || 0;
  const totalCompleted = task.task_assignments?.filter(a => a.status === 'completed').length || 0;
  const priorityMeta = getPriorityMeta(task.priority);

  return (
    <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', border: isCompletedByMe ? '1px solid var(--success)' : '1px solid var(--border-color)', borderRadius: '16px' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
             {isCompletedByMe ? <CheckCircle size={14} color="var(--success)" /> : <Clock size={14} color="var(--warning)" />}
             <span style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: isCompletedByMe ? 'var(--success)' : 'var(--warning)', letterSpacing: '0.02em' }}>
              {isCompletedByMe ? 'Tamamladınız' : 'Bekliyor'}
             </span>
          </div>
          <span style={{
            backgroundColor: priorityMeta.bg,
            color: priorityMeta.color,
            padding: '0.2rem 0.55rem',
            borderRadius: '6px',
            fontSize: '0.65rem',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.03em'
          }}>
            {priorityMeta.label}
          </span>
        </div>
        {(isCreator || isAuthorizedRank(currentUser)) && (
          <div className="flex gap-2">
            <button onClick={() => onEdit(task)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Düzenle"><Edit2 size={16} /></button>
            <button onClick={() => onDelete(task.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Sil"><Trash2 size={16} /></button>
          </div>
        )}
      </div>

      <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.5rem', color: isCompletedByMe ? 'var(--text-muted)' : 'var(--text-main)', textDecoration: isCompletedByMe ? 'line-through' : 'none' }}>{task.title}</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', flex: 1, lineHeight: '1.5' }}>{task.description || 'Açıklama yok'}</p>

      {/* Link ve Dosya Butonları */}
      {(() => {
        const safeLink = sanitizeUrl(task.link_url);
        const safeAttachment = sanitizeUrl(task.attachment_url);
        if (!safeLink && !safeAttachment) return null;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {safeAttachment && isImage(safeAttachment) && (
              <div style={{ width: '100%', height: '120px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: '0.25rem' }}>
                <img src={safeAttachment} alt="Ek Önizleme" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {safeLink && (
                <a href={safeLink} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', backgroundColor: 'var(--info-bg)', color: 'var(--info)', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '700', transition: 'all 0.2s' }} className="btn-hover-scale">
                  <LinkIcon size={14} /> Linke Git
                </a>
              )}
              {safeAttachment && (
                <a href={safeAttachment} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', backgroundColor: 'var(--primary-bg)', color: 'var(--primary-color)', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '700', transition: 'all 0.2s' }} className="btn-hover-scale">
                  <FileText size={14} /> {isImage(safeAttachment) ? 'Resmi Aç' : 'Dosyayı Aç'}
                </a>
              )}
            </div>
          </div>
        );
      })()}


      {/* İlerleme Çubuğu */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div className="flex justify-between" style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
          <span>EKİP İLERLEMESİ</span>
          <span>{totalCompleted}/{totalAssigned}</span>
        </div>
        <div style={{ height: '4px', backgroundColor: 'var(--bg-color)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${(totalCompleted / totalAssigned) * 100}%`, height: '100%', backgroundColor: 'var(--success)', transition: 'width 0.3s ease' }}></div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div className="flex-col">
            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Sorumlular</span>
            <div className="flex" style={{ flexWrap: 'wrap', gap: '6px' }}>
              {task.task_assignments?.map((a, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <div className="avatar" style={{ width: '28px', height: '28px', border: '2px solid var(--surface-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', backgroundColor: a.status === 'completed' ? '#10b981' : '#cbd5e1', color: '#fff', fontSize: '0.6rem', fontWeight: '700' }} title={`${a.user_name} (${a.status === 'completed' ? 'Tamamladı' : 'Bekliyor'})`}>
                    {(a.user_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  {a.status === 'completed' && (
                    <div style={{ position: 'absolute', top: -6, right: -2, backgroundColor: 'var(--success)', borderRadius: '50%', border: '1px solid white', display: 'flex', padding: 1 }}>
                      <CheckCircle size={8} color="white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {myAssignment && (
            <button 
              onClick={() => onToggle(task)}
              style={{ 
                backgroundColor: isCompletedByMe ? 'var(--bg-color)' : 'var(--success)', 
                color: isCompletedByMe ? 'var(--text-main)' : 'white', 
                border: '1px solid ' + (isCompletedByMe ? 'var(--border-color)' : 'transparent'), 
                borderRadius: '8px', 
                padding: '0.5rem 1rem', 
                fontSize: '0.75rem', 
                fontWeight: '700', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              {isCompletedByMe ? <X size={14} /> : <UserCheck size={14} />}
              {isCompletedByMe ? 'Geri Al' : 'Tamamladım'}
            </button>
          )}
        </div>
      </div>
      
      <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.5 }}>
         <span style={{ fontSize: '0.6rem', fontWeight: '600' }}>{task.creator_name} tarafından</span>
         <span style={{ fontSize: '0.6rem' }}>{new Date(task.created_at).toLocaleDateString('tr-TR')}</span>
      </div>
    </Card>
  );
};

// Helper functions
const isAuthorizedRank = (user) => {
  return isManager(user);
};

const isImage = (url) => {
  if (!url) return false;
  const commonImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const extension = url.split('.').pop().split('?')[0].toLowerCase();
  return commonImageExtensions.includes(extension);
};

export default MyTasks;
