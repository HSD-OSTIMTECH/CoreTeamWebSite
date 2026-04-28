import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import { 
  Calendar, Plus, Users, Trash2, Edit2, CheckCircle, Clock, X, 
  AlertCircle, Search, UserCheck, Link as LinkIcon, FileText, Upload 
} from 'lucide-react';

const normalizeRank = (rank) => String(rank || '').toLocaleLowerCase('tr-TR').trim();
const AUTHORIZED_RANKS = ['başkan', 'başkan yardımcısı', 'komite başkanı', 'developer'];

const MyTasks = () => {
  const [user, setUser] = useState(null);
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
    committee: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);

  const isAuthorized = user && AUTHORIZED_RANKS.includes(normalizeRank(user.rank));

  useEffect(() => {
    const savedUser = localStorage.getItem('custom_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    fetchData();
  }, []);

  const notifyDashboardRefresh = () => {
    window.dispatchEvent(new Event('dashboard-refresh'));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get current user from localStorage or state
      const savedUser = localStorage.getItem('custom_user');
      const currentUser = savedUser ? JSON.parse(savedUser) : user;

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
        .order('created_at', { ascending: false });

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

      const { data: membersData, error: membersError } = await supabase
        .from('custom_users')
        .select('id, username, rank');

      if (!membersError) {
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
      setUploading(true);
      console.log('Dosya yükleme başladı:', file.name);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Yükleme hatası:', uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(filePath);

      if (!data?.publicUrl) throw new Error('Public URL alınamadı');
      
      console.log('Dosya yüklendi, URL:', data.publicUrl);
      return data.publicUrl;
    } catch (error) {
      console.error('Büyük hata:', error.message);
      alert('Dosya yüklenemedi: ' + error.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleCreateOrUpdateTask = async (e) => {
    e.preventDefault();
    if (!formData.title || formData.assignedUsers.length === 0) {
      alert('Lütfen başlık girin ve en az bir kişi atayın.');
      return;
    }

    try {
      let taskId = formData.id;
      let currentAttachmentUrl = formData.attachment_url;

      // Eğer yeni bir dosya seçildiyse yükle
      if (selectedFile) {
        const uploadedUrl = await uploadFile(selectedFile);
        if (uploadedUrl) {
          currentAttachmentUrl = uploadedUrl;
        }
      }

      const taskPayload = {
        title: formData.title,
        description: formData.description,
        link_url: formData.link_url,
        attachment_url: currentAttachmentUrl,
        committee: formData.committee,
        updated_at: new Date()
      };

      if (isEditing) {
        const { error } = await supabase
          .from('tasks')
          .update(taskPayload)
          .eq('id', taskId);
        if (error) throw error;
        await supabase.from('task_assignments').delete().eq('task_id', taskId);
      } else {
        const { data, error } = await supabase
          .from('tasks')
          .insert([{
            ...taskPayload,
            creator_id: user.id,
            creator_name: user.username
          }])
          .select();
        
        if (error) throw error;
        taskId = data[0].id;
      }

      const assignments = formData.assignedUsers.map(memberId => {
        const member = members.find(m => m.id === memberId);
        return {
          task_id: taskId,
          user_id: memberId,
          user_name: member?.username || 'Bilinmiyor',
          status: 'pending'
        };
      });

      const { error: assignError } = await supabase.from('task_assignments').insert(assignments);
      if (assignError) throw assignError;

      if (!isEditing) {
        const notifications = formData.assignedUsers.map(memberId => ({
          user_id: memberId,
          message: `${user.username} size yeni bir görev atadı: ${formData.title}`,
          link: '/tasks',
          type: 'task_assigned'
        }));
        await supabase.from('notifications').insert(notifications);
      }

      setShowModal(false);
      resetForm();
      await fetchData();
      notifyDashboardRefresh();
    } catch (err) {
      console.error('İşlem hatası:', err);
      alert('Bir hata oluştu.');
    }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm('Bu görevi silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
      notifyDashboardRefresh();
    } catch (err) {
      console.error('Silme hatası:', err);
    }
  };

  const toggleTaskStatus = async (task) => {
    const myAssignment = task.task_assignments.find(a => a.user_id === user.id);
    if (!myAssignment) return;

    const newStatus = myAssignment.status === 'completed' ? 'pending' : 'completed';
    try {
      const { error } = await supabase
        .from('task_assignments')
        .update({ 
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date() : null
        })
        .eq('task_id', task.id)
        .eq('user_id', user.id);
      
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Durum güncelleme hatası:', err);
    } finally {
      await fetchData();
      notifyDashboardRefresh();
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
      committee: task.committee || ''
    });
    setSelectedFile(null);
    setIsEditing(true);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ id: null, title: '', description: '', assignedUsers: [], link_url: '', attachment_url: '', committee: '' });
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
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Görev Yönetimi</h1>
          <p className="page-subtitle" style={{ fontSize: '0.9rem', marginBottom: 0 }}>Size atanan görevler ve atamalar.</p>
        </div>
        {isAuthorized && (
          <button 
            onClick={() => { resetForm(); setShowModal(true); }}
            className="btn btn-primary" 
            style={{ 
              borderRadius: '10px', 
              padding: '0.6rem 1.25rem', 
              fontWeight: '600', 
              fontSize: '0.85rem',
              boxShadow: '0 4px 6px -1px rgba(15, 118, 110, 0.15)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <Plus size={16} /> Yeni Görev Ekle
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
                      <option value="etkinlik">Etkinlik ve Sponsorluk</option>
                      <option value="sosyal">Sosyal Medya</option>
                      <option value="medium">Medium</option>
                      <option value="proje">Teknoloji ve Proje</option>
                    </select>
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Kişi Ata (Çoklu Seçim)</label>
                
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
                      <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{member.username}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--primary-color)', backgroundColor: 'var(--primary-bg)', padding: '2px 6px', borderRadius: '4px' }}>{member.rank}</span>
                    </label>
                  )) : (
                    <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Kullanıcı bulunamadı.</div>
                  )}
                </div>
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

  return (
    <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', border: isCompletedByMe ? '1px solid var(--success)' : '1px solid var(--border-color)', borderRadius: '16px' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
           {isCompletedByMe ? <CheckCircle size={14} color="var(--success)" /> : <Clock size={14} color="var(--warning)" />}
           <span style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: isCompletedByMe ? 'var(--success)' : 'var(--warning)', letterSpacing: '0.02em' }}>
            {isCompletedByMe ? 'Tamamladınız' : 'Bekliyor'}
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
      {(task.link_url || task.attachment_url) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {task.attachment_url && isImage(task.attachment_url) && (
            <div style={{ width: '100%', height: '120px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: '0.25rem' }}>
              <img src={task.attachment_url} alt="Ek Önizleme" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {task.link_url && (
              <a href={task.link_url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', backgroundColor: 'var(--info-bg)', color: 'var(--info)', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '700', transition: 'all 0.2s' }} className="btn-hover-scale">
                <LinkIcon size={14} /> Linke Git
              </a>
            )}
            {task.attachment_url && (
              <a href={task.attachment_url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', backgroundColor: 'var(--primary-bg)', color: 'var(--primary-color)', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '700', transition: 'all 0.2s' }} className="btn-hover-scale">
                <FileText size={14} /> {isImage(task.attachment_url) ? 'Resmi Aç' : 'Dosyayı Aç'}
              </a>
            )}
          </div>
        </div>
      )}

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
                  <div className="avatar" style={{ width: '28px', height: '28px', border: '2px solid var(--surface-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} title={`${a.user_name} (${a.status === 'completed' ? 'Tamamladı' : 'Bekliyor'})`}>
                    <img src={`https://ui-avatars.com/api/?name=${a.user_name}&background=${a.status === 'completed' ? '10b981' : 'cbd5e1'}&color=fff`} alt={a.user_name} />
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
  return user && AUTHORIZED_RANKS.includes(normalizeRank(user.rank));
};

const isImage = (url) => {
  if (!url) return false;
  const commonImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const extension = url.split('.').pop().split('?')[0].toLowerCase();
  return commonImageExtensions.includes(extension);
};

export default MyTasks;
