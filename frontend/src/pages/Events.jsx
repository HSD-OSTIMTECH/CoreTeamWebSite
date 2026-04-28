import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import { 
  Clock, MoreHorizontal, CheckCircle, Search, ExternalLink, Plus, BarChart2, 
  Filter, UserPlus, UserCheck, Trash2, AlertCircle, Calendar, X, FileText, Upload, Link as LinkIcon, Edit2
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

const Events = ({ canEdit = true }) => {
  const [tasks, setTasks] = useState([]);
  const [fetchedTasks, setFetchedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & Form States (MyTasks'tan entegre)
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
    column_id: 'PLANLAMA',
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
        .eq('committee', 'etkinlik')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const dbTasks = data || [];
      setFetchedTasks(dbTasks);
      
      const mappedTasks = dbTasks.map(t => ({
        id: t.id,
        columnId: t.column_id || 'PLANLAMA',
        priority: t.priority || 'NORMAL',
        priorityBg: t.priority === 'YÜKSEK' ? 'var(--danger-bg)' : '#f1f5f9',
        priorityColor: t.priority === 'YÜKSEK' ? 'var(--danger)' : '#64748b',
        title: t.title,
        description: t.description,
        link_url: t.link_url,
        attachment_url: t.attachment_url,
        time: 'Yeni',
        progress: t.progress || 0,
        avatars: t.task_assignments?.map(a => a.user_name) || [],
        isCompletedDash: (t.column_id || 'PLANLAMA') === 'TAMAMLANAN'
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
    
    // Veritabanında güncelle
    try {
      const isCompleted = columnId === 'TAMAMLANAN';
      const { error } = await supabase
        .from('tasks')
        .update({ 
          column_id: columnId,
          status: isCompleted ? 'completed' : 'pending',
          updated_at: new Date()
        })
        .eq('id', taskId);

      if (error) throw error;

      // Yerel state'i güncelle
      const updatedTasks = tasks.map(task => {
        if (task.id === taskId) {
          const isCompletedDash = columnId === 'TAMAMLANAN';
          return { ...task, columnId, isCompletedDash };
        }
        return task;
      });
      setTasks(updatedTasks);
      fetchCommitteeTasks(); // Listeleri tazele
    } catch (err) {
      console.error('Güncelleme hatası:', err);
    }
  };

  const uploadFile = async (file) => {
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const { error } = await supabase.storage.from('task-attachments').upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from('task-attachments').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (err) {
      console.error('Yükleme hatası:', err);
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
      let currentAttachmentUrl = formData.attachment_url;
      if (selectedFile) {
        const uploadedUrl = await uploadFile(selectedFile);
        if (uploadedUrl) currentAttachmentUrl = uploadedUrl;
      }

      const payload = {
        title: formData.title,
        description: formData.description,
        link_url: formData.link_url,
        attachment_url: currentAttachmentUrl,
        committee: 'etkinlik',
        column_id: formData.column_id,
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
        if (!data || data.length === 0) throw new Error('Etkinlik oluşturulamadı.');
        taskId = data[0].id;
      }

      const assignments = formData.assignedUsers.map(memberId => {
        const member = members.find(m => m.id === memberId);
        return { task_id: taskId, user_id: memberId, user_name: member?.username || 'Bilinmiyor', status: 'pending' };
      });

      await supabase.from('task_assignments').insert(assignments);

      // Bildirimleri ekle
      if (assignments.length > 0) {
        const notificationItems = assignments.map(a => ({
          user_id: a.user_id,
          message: `"${payload.title}" etkinliği için size bir görev atandı.`,
          is_read: false,
          created_at: new Date()
        }));
        await supabase.from('notifications').insert(notificationItems);
      }
      setShowModal(false);
      resetForm();
      fetchCommitteeTasks();
    } catch (err) {
      console.error('İşlem hatası:', err);
    }
  };

  const handleAddTask = (columnId) => {
    if (!canEdit) return;
    resetForm();
    setFormData(prev => ({ ...prev, column_id: columnId }));
    setShowModal(true);
  };

  const openEditModal = (task) => {
    const orig = fetchedTasks.find(t => t.id === task.id);
    setFormData({
      id: task.id,
      title: task.title,
      description: task.description || '',
      assignedUsers: orig?.task_assignments?.map(a => a.user_id) || [],
      link_url: task.link_url || '',
      attachment_url: task.attachment_url || '',
      column_id: task.columnId,
      start_date: orig?.start_date ? orig.start_date.split('T')[0] : '',
      end_date: orig?.end_date ? orig.end_date.split('T')[0] : ''
    });
    setIsEditing(true);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ 
      id: null, 
      title: '', 
      description: '', 
      assignedUsers: [], 
      link_url: '', 
      attachment_url: '', 
      column_id: 'PLANLAMA',
      start_date: '',
      end_date: ''
    });
    setSelectedFile(null);
    setSearchTerm('');
    setIsEditing(false);
  };

  const handleDeleteTask = async (id) => {
    if (!canEdit) return;
    if (!window.confirm('Bu görevi silmek istediğinize emin misiniz?')) return;
    try {
      await supabase.from('tasks').delete().eq('id', id);
      fetchCommitteeTasks();
    } catch (err) { console.error(err); }
  };
  
  const filteredMembers = members.filter(m => 
    m.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.rank?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderColumnCards = (colId) => {
    return tasks.filter(t => t.columnId === colId).map(task => {
      if (task.isCompletedDash) {
        return (
          <div 
            key={task.id}
            draggable={canEdit}
            onDragStart={(e) => onDragStart(e, task.id)}
            style={{ padding: '1.25rem', border: '1.5px dashed #cbd5e1', borderRadius: '0.75rem', backgroundColor: 'transparent', cursor: canEdit ? 'grab' : 'default', marginBottom: '1rem' }}
          >
             <CheckCircle size={24} color="#10b981" style={{ marginBottom: '0.5rem' }} />
             <h4 style={{ color: '#94a3b8', fontSize: '1.05rem', fontWeight: '500', marginBottom: '1.5rem', lineHeight: '1.4' }}>{task.title}</h4>
             <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{task.time || 'Bitti'}</div>
          </div>
        );
      }
      return (
        <div key={task.id} style={{ marginBottom: '1rem' }}>
            <KanbanCard 
            id={task.id}
            priority={task.priority}
            priorityBg={task.priorityBg}
            priorityColor={task.priorityColor}
            title={task.title}
            time={task.time}
            progress={task.progress}
            avatars={task.avatars || []}
            onDragStart={onDragStart}
            onDelete={handleDeleteTask}
            onEdit={() => openEditModal(task)}
            canEdit={canEdit}
          />
        </div>
      );
    });
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Etkinlik ve Sponsorluk</h1>
          <p className="page-subtitle" style={{ fontSize: '1rem' }}>Kurumsal etkinlik planlama ve partnerlik yönetimi merkezi.</p>
        </div>
        {!canEdit && (
          <div style={{ backgroundColor: '#fff7ed', color: '#c2410c', padding: '0.5rem 1rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600', border: '1px solid #ffedd5', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} /> Sadece Görüntüleme Modu
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '3rem', flexWrap: 'wrap', width: '100%' }}>
        {/* İş Akışı (Kanban) Section */}
        <div style={{ flex: '3', minWidth: '320px', width: '100%' }}>
          <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
            <div className="flex items-center gap-2" style={{ fontWeight: '600', fontSize: '1.1rem' }}>
              <BarChart2 size={20} color="var(--primary-color)" /> İş Akışı
            </div>
          </div>
          
          <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '1rem', display: 'flex', gap: '1.5rem', overflowX: 'auto', minHeight: '600px', width: '100%' }}>
            {/* PLANLAMA */}
            <div 
              style={{ flex: '1', minWidth: '220px', display: 'flex', flexDirection: 'column' }}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, 'PLANLAMA')}
            >
              <div className="flex items-center gap-2" style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>PLANLAMA</span>
                <span style={{ backgroundColor: '#e2e8f0', color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px' }}>
                  {tasks.filter(t => t.columnId === 'PLANLAMA').length}
                </span>
              </div>
              <div className="flex-col" style={{ flex: 1 }}>
                {renderColumnCards('PLANLAMA')}
                
                {/* Ekle Butonu */}
                {canEdit && (
                  <button 
                    onClick={() => handleAddTask('PLANLAMA')}
                    style={{ width: '100%', padding: '1rem', border: '1.5px dashed #cbd5e1', borderRadius: '0.75rem', backgroundColor: 'transparent', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', alignSelf: 'flex-start' }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary-color)'; e.currentTarget.style.color = 'var(--primary-color)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#94a3b8'; }}
                  >
                    <Plus size={16} /> Etkinlik Ekle
                  </button>
                )}
              </div>
            </div>

            {/* DEVAM EDEN */}
            <div 
              style={{ flex: '1', minWidth: '220px', display: 'flex', flexDirection: 'column' }}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, 'DEVAM_EDEN')}
            >
              <div className="flex items-center gap-2" style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>DEVAM EDEN</span>
                <span style={{ backgroundColor: '#e2e8f0', color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px' }}>
                  {tasks.filter(t => t.columnId === 'DEVAM_EDEN').length}
                </span>
              </div>
              <div className="flex-col" style={{ flex: 1 }}>
                {renderColumnCards('DEVAM_EDEN')}
              </div>
            </div>

            {/* TAMAMLANAN */}
            <div 
              style={{ flex: '1', minWidth: '220px', display: 'flex', flexDirection: 'column' }}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, 'TAMAMLANAN')}
            >
              <div className="flex items-center gap-2" style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>TAMAMLANAN</span>
                <span style={{ backgroundColor: '#e2e8f0', color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px' }}>
                  {tasks.filter(t => t.columnId === 'TAMAMLANAN').length}
                </span>
              </div>
              <div className="flex-col" style={{ flex: 1 }}>
                {renderColumnCards('TAMAMLANAN')}
              </div>
            </div>
          </div>
        </div>

        {/* Yaklaşan Görevler Section */}
        <div style={{ flex: '1', minWidth: '300px', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '1rem' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Yaklaşan Akış</h2>
            </div>
            
            <div className="flex-col gap-3" style={{ flex: 1 }}>
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
      </div>


      {/* Modal - MyTasks'tan Entegre Edilen Form */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowModal(false)}></div>
          <div style={{ position: 'relative', width: '100%', maxWidth: '550px', backgroundColor: 'var(--surface-color)', borderRadius: '24px', padding: '2rem', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{isEditing ? 'Etkinlik Düzenle' : 'Yeni Etkinlik'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateOrUpdateTask}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>ETKİNLİK BAŞLIĞI</label>
                  <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }} placeholder="Etkinlik hazırlığı..." />
                </div>
                
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>AÇIKLAMA</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', minHeight: '80px', resize: 'vertical' }} placeholder="Etkinlik detayları..." />
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
                <button type="submit" disabled={uploading} style={{ flex: 2, padding: '0.8rem', borderRadius: '12px', border: 'none', backgroundColor: 'var(--primary-color)', color: 'white', fontWeight: '700', cursor: 'pointer' }}>{uploading ? 'Yükleniyor...' : (isEditing ? 'Güncelle' : 'Etkinlik Oluştur')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const KanbanCard = ({ id, priority, priorityBg, priorityColor, title, time, progress, avatars, onDragStart, onDelete, onEdit, canEdit = true }) => {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div 
      draggable={canEdit}
      onDragStart={(e) => onDragStart ? onDragStart(e, id) : null}
      style={{ backgroundColor: 'var(--surface-color)', borderRadius: '0.75rem', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', position: 'relative', cursor: canEdit ? 'grab' : 'default' }}
      onClick={() => canEdit && onEdit && onEdit(id)}
    >
      <div className="flex justify-between items-start" style={{ marginBottom: '1rem', position: 'relative' }}>
        <span style={{ backgroundColor: priorityBg, color: priorityColor, padding: '0.25rem 0.6rem', borderRadius: '1rem', fontSize: '0.65rem', fontWeight: '700', display: 'inline-block' }}>
          {priority}
        </span>
        {canEdit && (
          <div style={{ position: 'relative' }}>
            <button onClick={(e) => { e.stopPropagation(); setShowMenu(true); }} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}>
              <MoreHorizontal size={18} />
            </button>
            {showMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                <div style={{ position: 'absolute', top: '100%', right: '0', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', boxShadow: 'var(--shadow-md)', zIndex: 50, width: '160px', overflow: 'hidden', marginTop: '0.5rem' }}>
                  <button onClick={(e) => { e.stopPropagation(); onEdit(id); setShowMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor='var(--bg-color)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor='transparent'}>
                    <Edit2 size={14} /> Etkinliği Düzenle
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(id); setShowMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor='var(--danger-bg)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor='transparent'}>
                    <Trash2 size={14} /> Etkinliği Sil
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <h4 style={{ fontSize: '1.05rem', fontWeight: '600', marginBottom: '1.25rem', lineHeight: '1.4', color: 'var(--text-main)', paddingRight: '1rem' }}>{title}</h4>
    
    {progress && (
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px' }}>
          <div style={{ width: progress, height: '100%', backgroundColor: 'var(--primary-color)', borderRadius: '3px' }}></div>
        </div>
      </div>
    )}

    <div className="flex justify-between items-center mt-auto">
      <div className="flex" style={{ marginLeft: '10px' }}>
        {avatars.map((name, i) => (
          <div key={i} className="avatar" style={{ width: '24px', height: '24px', border: '2px solid white', marginLeft: '-10px', boxShadow: '0 0 0 1px rgba(0,0,0,0.05)' }}>
            <img src={`https://ui-avatars.com/api/?name=${name}&background=random&color=fff`} alt={name} />
          </div>
        ))}
      </div>
      {time && (
        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={12} color="var(--text-muted)" /> {time}
        </div>
      )}
      {progress && (
        <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)' }}>{progress}</div>
      )}
    </div>
  </div>
  );
};

const SmallTableRow = ({ title, date, dotColor }) => (
  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
    <td style={{ padding: '0.75rem 1rem', fontWeight: '500', color: 'var(--text-main)' }}>{title}</td>
    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{date}</td>
    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: dotColor }}></span>
    </td>
  </tr>
);

const ProjectTableRow = ({ initials, initialsBg, color, title, subtitle, topic, priority, priorityBg, priorityColor, actionType }) => (
  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
    <td style={{ padding: '1.5rem' }}>
      <div className="flex items-center gap-3">
        <div style={{ width: '40px', height: '40px', backgroundColor: initialsBg, color: color, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.9rem' }}>
          {initials}
        </div>
        <div>
          <div style={{ fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.2rem' }}>{title}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{subtitle}</div>
        </div>
      </div>
    </td>
    <td style={{ padding: '1.5rem', fontWeight: '500', color: 'var(--text-main)', fontSize: '0.85rem' }}>{topic}</td>
    <td style={{ padding: '1.5rem' }}>
      <span style={{ backgroundColor: priorityBg, color: priorityColor, padding: '0.35rem 0.85rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>
        {priority}
      </span>
    </td>
    <td style={{ padding: '1.5rem', textAlign: 'right' }}>
      {actionType === 'add' ? (
        <button style={{ backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.6rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={20} />
        </button>
      ) : (
        <button style={{ backgroundColor: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <ExternalLink size={20} />
        </button>
      )}
    </td>
  </tr>
);

export default Events;
