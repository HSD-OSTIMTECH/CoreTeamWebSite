import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import Card from '../components/common/Card';
import { 
  MoreHorizontal, Link as LinkIcon, Database, RefreshCw, Lock, ArrowRight, Code, 
  List, Component, Rocket, CheckCircle2, Plus, UserPlus, UserCheck, Trash2, 
  AlertCircle, Calendar, X, FileText, Upload, Edit2, Search
} from 'lucide-react';

const UpcomingCard = ({ month, day, dayBg, title, desc, timeTag }) => (
  <div className="flex items-center gap-4" style={{ backgroundColor: 'var(--surface-color)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
    <div style={{ backgroundColor: dayBg || 'var(--bg-color)', borderRadius: '0.5rem', padding: '0.5rem 0.2rem', minWidth: '45px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--primary-color)', marginBottom: '0.1rem' }}>{month}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>{day}</div>
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '0.2rem' }}>{title}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{desc}</div>
      <div style={{ display: 'inline-block', backgroundColor: 'var(--primary-bg)', color: 'var(--primary-color)', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '700' }}>{timeTag}</div>
    </div>
  </div>
);

const Projects = ({ canEdit = true }) => {
  const [tasks, setTasks] = useState([]);
  const [fetchedTasks, setFetchedTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal & Form States
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState({
    id: null,
    title: '',
    description: '',
    assignedUsers: [],
    link_url: '',
    attachment_url: '',
    column_id: 'YAPILACAKLAR',
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    fetchCommitteeTasks();
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    const { data, error } = await supabase.from('custom_users').select('id, username, rank');
    if (!error) setMembers(data || []);
  };

  const fetchCommitteeTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          task_assignments (
            user_id,
            user_name,
            status
          )
        `)
        .eq('committee', 'proje')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const dbTasks = data || [];
      setFetchedTasks(dbTasks);
      
      const mappedTasks = dbTasks.map(t => ({
        id: t.id,
        columnId: t.column_id || 'YAPILACAKLAR',
        badge: t.priority || 'TEKNİK',
        badgeBg: t.priority === 'YÜKSEK' ? '#fee2e2' : '#f1f5f9',
        badgeColor: t.priority === 'YÜKSEK' ? '#ef4444' : '#64748b',
        badgeIconType: (t.column_id || 'YAPILACAKLAR') === 'TAMAMLANDI' ? 'check' : 'code',
        title: t.title,
        desc: t.description || 'Detay bekliyor...',
        iconType: 'link',
        footerText: 'GENEL',
        avatars: t.task_assignments?.map(a => a.user_name) || [],
        progress: t.progress || 0,
        isCompleted: (t.column_id || 'YAPILACAKLAR') === 'TAMAMLANDI',
        link_url: t.link_url,
        attachment_url: t.attachment_url
      }));
      setTasks(mappedTasks);
    } catch (err) {
      console.error('Görevler çekilemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const onDragStart = (e, taskId) => {
    if (!canEdit) return;
    e.dataTransfer.setData('taskId', taskId);
  };

  const onDragOver = (e) => {
    if (!canEdit) return;
    e.preventDefault();
  };

  const onDrop = async (e, columnId) => {
    if (!canEdit) return;
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    try {
      const isCompleted = columnId === 'TAMAMLANDI';
      await supabase
        .from('tasks')
        .update({ 
          column_id: columnId, 
          status: isCompleted ? 'completed' : 'pending',
          updated_at: new Date() 
        })
        .eq('id', taskId);
      fetchCommitteeTasks();
    } catch (err) { console.error(err); }
  };

  const uploadFile = async (file) => {
    try {
      setUploading(true);
      const fileName = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('task-attachments').upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from('task-attachments').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (err) { return null; } finally { setUploading(false); }
  };

  const handleCreateOrUpdateTask = async (e) => {
    e.preventDefault();
    if (!formData.title || formData.assignedUsers.length === 0) {
      alert('Başlık ve en az bir üye seçin.');
      return;
    }

    try {
      let url = formData.attachment_url;
      if (selectedFile) {
        const u = await uploadFile(selectedFile);
        if (u) url = u;
      }

      const payload = {
        title: formData.title, description: formData.description,
        link_url: formData.link_url, attachment_url: url,
        committee: 'proje', column_id: formData.column_id, 
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        updated_at: new Date()
      };

      const customUser = JSON.parse(localStorage.getItem('custom_user') || '{}');
      let taskId = formData.id;

      if (isEditing) {
        const { error } = await supabase.from('tasks').update(payload).eq('id', taskId);
        if (error) throw error;
        await supabase.from('task_assignments').delete().eq('task_id', taskId);
      } else {
        const { data, error } = await supabase.from('tasks').insert([{ ...payload, creator_id: customUser.id, creator_name: customUser.username }]).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Proje oluşturulamadı.');
        taskId = data[0].id;
      }

      const assignments = formData.assignedUsers.map(uid => ({
        task_id: taskId, user_id: uid, user_name: members.find(m => m.id === uid)?.username || '?', status: 'pending'
      }));
      await supabase.from('task_assignments').insert(assignments);

      if (assignments.length > 0) {
        const notifications = assignments.map(a => ({
          user_id: a.user_id,
          message: `"${payload.title}" projesi için size bir görev atandı.`,
          is_read: false,
          created_at: new Date()
        }));
        await supabase.from('notifications').insert(notifications);
      }
      setShowModal(false);
      resetForm();
      fetchCommitteeTasks();
    } catch (err) { console.error(err); }
  };

  const handleAddTask = (columnId) => {
    if (!canEdit) return;
    resetForm();
    setFormData(p => ({ ...p, column_id: columnId }));
    setShowModal(true);
  };

  const openEditModal = (task) => {
    const orig = fetchedTasks.find(t => t.id === task.id);
    setFormData({
      id: task.id, title: task.title, description: task.desc || '',
      assignedUsers: orig?.task_assignments?.map(a => a.user_id) || [],
      link_url: task.link_url || '', attachment_url: task.attachment_url || '',
      column_id: task.columnId,
      start_date: orig?.start_date ? orig.start_date.split('T')[0] : '',
      end_date: orig?.end_date ? orig.end_date.split('T')[0] : ''
    });
    setIsEditing(true);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ 
      id: null, title: '', description: '', assignedUsers: [], link_url: '', attachment_url: '', 
      column_id: 'YAPILACAKLAR',
      start_date: '',
      end_date: ''
    });
    setSelectedFile(null);
    setSearchTerm('');
    setIsEditing(false);
  };

  const handleDeleteTask = async (id) => {
    if (!canEdit) return;
    if (!window.confirm('Emin misiniz?')) return;
    await supabase.from('tasks').delete().eq('id', id);
    fetchCommitteeTasks();
  };

  const filteredMembers = members.filter(m =>
    m.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.rank?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderColumnCards = (colId) => {
    return tasks.filter(t => t.columnId === colId).map(task => (
      <KanbanCard 
        key={task.id}
        id={task.id}
        badge={task.badge}
        badgeBg={task.badgeBg}
        badgeColor={task.badgeColor}
        badgeIconType={task.badgeIconType}
        title={task.title}
        desc={task.desc}
        iconType={task.iconType}
        footerText={task.footerText}
        avatars={task.avatars}
        progress={task.progress}
        activeBorder={task.activeBorder}
        isCompleted={task.isCompleted}
        onDragStart={onDragStart}
        onDelete={handleDeleteTask}
        onEdit={() => openEditModal(task)}
        canEdit={canEdit}
      />
    ));
  };


  return (
    <div className="page-container">
      <div className="flex justify-between items-start" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Teknoloji ve Proje Paneli</h1>
          <p className="page-subtitle" style={{ fontSize: '1rem', marginBottom: 0 }}>Mevcut mühendislik döngüsü ve geliştirme aşamasındaki aktif dijital ürünler.</p>
        </div>
        <div className="flex items-center gap-4">
          {!canEdit && (
            <div style={{ backgroundColor: '#fff7ed', color: '#c2410c', padding: '0.5rem 1rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600', border: '1px solid #ffedd5', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} /> Sadece Görüntüleme Modu
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '3rem', flexWrap: 'wrap' }}>
        {/* YAPILACAKLAR */}
        <div style={{ flex: '1', minWidth: '240px' }}>
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem', padding: '0 0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '0.05em' }}>YAPILACAKLAR</span>
            <span style={{ backgroundColor: 'var(--border-color)', color: 'var(--text-main)', fontSize: '0.7rem', fontWeight: 'bold', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>
              {tasks.filter(t => t.columnId === 'YAPILACAKLAR').length}
            </span>
          </div>
          <div 
            style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '1rem', minHeight: '400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, 'YAPILACAKLAR')}
          >
            {renderColumnCards('YAPILACAKLAR')}
            {canEdit && (
              <button 
                onClick={() => handleAddTask('YAPILACAKLAR')}
                style={{ width: '100%', padding: '1rem', border: '1.5px dashed #cbd5e1', borderRadius: '0.75rem', backgroundColor: 'transparent', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
              >
                <Plus size={16} /> Görev Ekle
              </button>
            )}
          </div>
        </div>

        {/* DEVAM EDENLER */}
        <div style={{ flex: '1', minWidth: '240px' }}>
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem', padding: '0 0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '0.05em' }}>DEVAM EDENLER</span>
            <span style={{ backgroundColor: '#ccfbf1', color: '#0f766e', fontSize: '0.7rem', fontWeight: 'bold', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>
              {tasks.filter(t => t.columnId === 'DEVAM_EDENLER').length}
            </span>
          </div>
          <div 
            style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '1rem', minHeight: '400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, 'DEVAM_EDENLER')}
          >
            {renderColumnCards('DEVAM_EDENLER')}
          </div>
        </div>

        {/* TAMAMLANDI */}
        <div style={{ flex: '1', minWidth: '240px' }}>
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem', padding: '0 0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '0.05em' }}>TAMAMLANDI</span>
            <span style={{ backgroundColor: '#dcfce7', color: '#16a34a', fontSize: '0.7rem', fontWeight: 'bold', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>
              {tasks.filter(t => t.columnId === 'TAMAMLANDI').length}
            </span>
          </div>
          <div 
            style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '1rem', minHeight: '400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, 'TAMAMLANDI')}
          >
            {renderColumnCards('TAMAMLANDI')}
          </div>
        </div>

        {/* YAKLAŞAN GÖREVLER */}
        <div style={{ flex: '1', minWidth: '240px' }}>
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem', padding: '0 0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '0.05em' }}>YAKLAŞAN AKIŞ</span>
          </div>
          <div className="flex-col gap-4">
              {fetchedTasks.length > 0 ? fetchedTasks.map(task => (
                <UpcomingCard 
                  key={task.id}
                  month={new Date(task.created_at).toLocaleDateString('tr-TR', { month: 'short' }).toUpperCase()}
                  day={new Date(task.created_at).getDate()}
                  dayBg="#f1f5f9"
                  title={task.title}
                  desc={task.creator_name ? `${task.creator_name} tarafından` : 'Genel Görev'}
                  timeTag={task.task_assignments?.length > 0 ? `${task.task_assignments.length} Kişi Atandı` : 'Atama Bekliyor'}
                />
              )) : (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Henüz bir görev atanmamış.
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Modal - Görev Formu */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowModal(false)}></div>
          <div style={{ position: 'relative', width: '100%', maxWidth: '550px', backgroundColor: 'var(--surface-color)', borderRadius: '24px', padding: '2rem', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{isEditing ? 'Projeyi Düzenle' : 'Yeni Proje Görevi'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateOrUpdateTask}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>PROJE BAŞLIĞI</label>
                  <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }} placeholder="Proje adı..." />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>AÇIKLAMA</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', minHeight: '80px', resize: 'vertical' }} placeholder="Teknik detaylar..." />
                </div>

                <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>BAŞLANGIÇ TARİHİ</label>
                    <input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>BİTİŞ TARİHİ</label>
                    <input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>İLGİLİ LİNK</label>
                  <div style={{ position: 'relative' }}>
                    <LinkIcon size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input type="url" value={formData.link_url} onChange={(e) => setFormData({ ...formData, link_url: e.target.value })} style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.2rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.85rem' }} placeholder="https://..." />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>DOSYA EKLE</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: '10px', border: '1px dashed var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <Upload size={14} />
                    {selectedFile ? selectedFile.name : 'Dosya seç...'}
                    <input type="file" onChange={(e) => setSelectedFile(e.target.files[0])} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>KİŞİ ATA</label>
                <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="text" placeholder="Üye ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.85rem' }} />
                </div>
                <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.5rem' }}>
                  {filteredMembers.map(member => (
                    <div key={member.id} onClick={() => {
                      const newSet = formData.assignedUsers.includes(member.id) ? formData.assignedUsers.filter(id => id !== member.id) : [...formData.assignedUsers, member.id];
                      setFormData({ ...formData, assignedUsers: newSet });
                    }} style={{ padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px', backgroundColor: formData.assignedUsers.includes(member.id) ? 'var(--primary-bg)' : 'transparent' }}>
                      <div className="flex items-center gap-2">
                        <div className="avatar" style={{ width: '24px', height: '24px' }}>
                          <img src={`https://ui-avatars.com/api/?name=${member.username}&background=random&color=fff`} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{member.username}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{member.rank || 'Üye'}</span>
                        </div>
                      </div>
                      {formData.assignedUsers.includes(member.id) && <UserCheck size={16} color="var(--primary-color)" />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', fontWeight: '700', cursor: 'pointer' }}>İptal</button>
                <button type="submit" disabled={uploading} style={{ flex: 2, padding: '0.8rem', borderRadius: '12px', border: 'none', backgroundColor: 'var(--primary-color)', color: 'white', fontWeight: '700', cursor: 'pointer' }}>{uploading ? 'Yükleniyor...' : (isEditing ? 'Güncelle' : 'Kaydet')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const KanbanCard = ({ id, badge, badgeBg, badgeColor, badgeIconType, title, desc, iconType, footerText, avatars = [], progress, activeBorder, isCompleted, onDragStart, onDelete, onEdit, canEdit = true }) => {
  const [showMenu, setShowMenu] = useState(false);
  const cardStyle = {
    backgroundColor: 'var(--surface-color)',
    borderRadius: '1rem',
    padding: '1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    borderLeft: activeBorder ? '4px solid var(--primary-color)' : 'none',
    cursor: canEdit ? 'grab' : 'default'
  };

  let IconComp = null;
  if (iconType === 'link') IconComp = <LinkIcon size={14} />;
  if (iconType === 'database') IconComp = <Database size={14} />;
  if (iconType === 'refresh') IconComp = <RefreshCw size={14} />;
  if (iconType === 'lock') IconComp = <Lock size={14} />;

  let BadgeIconComp = null;
  if (badgeIconType === 'check') BadgeIconComp = <CheckCircle2 size={12} style={{ marginLeft: '4px' }} />;

  return (
    <div 
      style={cardStyle}
      draggable={canEdit}
      onDragStart={(e) => onDragStart(e, id)}
    >
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem', position: 'relative' }}>
        <span style={{ backgroundColor: badgeBg, color: badgeColor, padding: '0.25rem 0.6rem', borderRadius: '1rem', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>
          {badge}
          {BadgeIconComp}
        </span>
        {!isCompleted && canEdit && (
          <div style={{ position: 'relative' }}>
            <button onClick={(e) => { e.stopPropagation(); setShowMenu(true); }} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}>
              <MoreHorizontal size={18} />
            </button>
            {showMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                <div style={{ position: 'absolute', top: '100%', right: '0', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', boxShadow: 'var(--shadow-md)', zIndex: 50, width: '160px', overflow: 'hidden', marginTop: '0.5rem' }}>
                  <button onClick={(e) => { e.stopPropagation(); onEdit(); setShowMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Edit2 size={14} /> Düzenle
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(id); setShowMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor='var(--danger-bg)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor='transparent'}>
                    <Trash2 size={14} /> Görevi Sil
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      
      <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem', color: isCompleted ? '#94a3b8' : 'var(--text-main)', textDecoration: isCompleted ? 'line-through' : 'none' }}>{title}</h4>
      <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4', marginBottom: progress ? '1rem' : '1.5rem' }}>{desc}</p>
      
      {progress > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="flex justify-between items-center" style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--primary-color)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
            <span>İLERLEME</span>
            <span>{progress}%</span>
          </div>
          <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px' }}>
            <div style={{ width: `${progress}%`, height: '100%', backgroundColor: 'var(--primary-color)', borderRadius: '2px' }}></div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mt-auto" style={{ paddingTop: '0.5rem' }}>
        <div className="flex items-center gap-1" style={{ fontSize: '0.75rem', fontWeight: '700', color: isCompleted ? '#94a3b8' : 'var(--text-main)', letterSpacing: '0.05em' }}>
          {IconComp} <span>{footerText}</span>
        </div>
        
        {avatars.length > 0 && (
          <div className="flex" style={{ marginLeft: '10px' }}>
            {avatars.map((name, i) => (
              <div key={i} className="avatar" style={{ width: '24px', height: '24px', border: '2px solid white', marginLeft: '-10px', boxShadow: '0 0 0 1px rgba(0,0,0,0.05)' }}>
                <img src={`https://ui-avatars.com/api/?name=${name}&background=random&color=fff`} alt={name} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Projects;
