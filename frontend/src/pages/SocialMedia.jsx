import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import Card from '../components/common/Card';
import { 
  MoreHorizontal, MessageSquare, Paperclip, Calendar, CheckCircle, Check, Plus, 
  UserPlus, UserCheck, Trash2, AlertCircle, Clock, X, FileText, Upload, Link as LinkIcon, Edit2, Search
} from 'lucide-react';

const UpcomingCard = ({ month, day, dayBg, title, desc, timeTag }) => (
  <div className="flex items-center gap-4" style={{ backgroundColor: 'var(--surface-color)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
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

const SocialMedia = ({ canEdit = true }) => {
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
    column_id: 'TASLAKLAR',
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
        .eq('committee', 'sosyal')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const dbTasks = data || [];
      setFetchedTasks(dbTasks);
      
      const mappedTasks = dbTasks.map(t => ({
        id: t.id,
        columnId: t.column_id || 'PLANLANAN',
        platform: 'İÇERİK',
        platformBg: (t.column_id || 'PLANLANAN') === 'TAMAMLANAN' ? '#f1f5f9' : '#e2e8f0',
        platformColor: (t.column_id || 'PLANLANAN') === 'TAMAMLANAN' ? '#64748b' : '#334155',
        title: t.title,
        desc: t.description || 'Detay yok.',
        avatars: t.task_assignments?.map(a => a.user_name) || [],
        isCompleted: (t.column_id || 'PLANLANAN') === 'TAMAMLANAN',
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
      alert('Lütfen başlık girin ve en az bir kişi atayın.');
      return;
    }

    try {
      let currentAttachmentUrl = formData.attachment_url;
      if (selectedFile) {
        const url = await uploadFile(selectedFile);
        if (url) currentAttachmentUrl = url;
      }

      const payload = {
        title: formData.title, description: formData.description,
        link_url: formData.link_url, attachment_url: currentAttachmentUrl,
        committee: 'sosyal', column_id: formData.column_id, 
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
        if (!data || data.length === 0) throw new Error('Görev oluşturulamadı.');
        taskId = data[0].id;
      }

      const assignments = formData.assignedUsers.map(memberId => {
        const m = members.find(x => x.id === memberId);
        return { task_id: taskId, user_id: memberId, user_name: m?.username || 'Bilinmiyor', status: 'pending' };
      });

      await supabase.from('task_assignments').insert(assignments);

      if (assignments.length > 0) {
        const notifications = assignments.map(a => ({
          user_id: a.user_id,
          message: `"${payload.title}" içeriği için size bir görev atandı.`,
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
    setFormData(prev => ({ ...prev, column_id: columnId }));
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
      column_id: 'TASLAKLAR',
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
  
  const handleAssignToMe = (id) => {
    if (!canEdit) return;
    setTasks(tasks.map(t => t.id === id && !(t.avatars || []).includes('Ben') ? { ...t, avatars: [...(t.avatars || []), 'Ben'] } : t));
  };
  
  const handleAssignToPerson = (id) => {
    if (!canEdit) return;
    const person = window.prompt("Görevlendirilecek kişinin adını girin (Örn: Ali K.):");
    if (person && person.trim()) {
      setTasks(tasks.map(t => t.id === id ? { ...t, avatars: [...(t.avatars || []), person.trim()] } : t));
    }
  };

  const renderColumnCards = (colId) => {
    return tasks.filter(t => t.columnId === colId).map(task => (
      <div key={task.id} style={{ marginBottom: '1rem' }}>
             <KanbanCard 
              id={task.id}
              platform={task.platform}
              platformBg={task.platformBg}
              platformColor={task.platformColor}
              title={task.title}
              desc={task.desc}
              avatars={task.avatars}
              metaIconType={task.metaIconType}
              metaNumber={task.metaNumber}
              progress={task.progress}
              activeBorder={task.activeBorder}
              isCompleted={task.isCompleted}
              onDragStart={onDragStart}
              onDelete={handleDeleteTask}
              onEdit={() => openEditModal(task)}
              canEdit={canEdit}
            />
      </div>
    ));
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Sosyal Medya Paneli</h1>
          <p className="page-subtitle" style={{ fontSize: '1rem' }}>Haftalık içerik üretimi ve kanal yönetimi.</p>
        </div>
        {!canEdit && (
          <div style={{ backgroundColor: '#fff7ed', color: '#c2410c', padding: '0.5rem 1rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600', border: '1px solid #ffedd5', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} /> Sadece Görüntüleme Modu
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '3rem', flexWrap: 'wrap', width: '100%' }}>
        {/* İçerik Akışı (Kanban) Section */}
        <div style={{ flex: '3', minWidth: '320px', width: '100%' }}>
          <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>İçerik Akışı</h2>
          </div>
          
          <div style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', paddingBottom: '1rem' }}>
            {/* PLANLANAN */}
            <div 
              style={{ flex: '1', minWidth: '220px', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column' }}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, 'PLANLANAN')}
            >
              <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem', padding: '0 0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '0.05em' }}>PLANLANAN</span>
                <span style={{ backgroundColor: 'var(--surface-color)', color: 'var(--text-main)', fontSize: '0.75rem', fontWeight: 'bold', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  {tasks.filter(t => t.columnId === 'PLANLANAN').length}
                </span>
              </div>
              <div className="flex-col" style={{ flex: 1 }}>
                {renderColumnCards('PLANLANAN')}
                {canEdit && (
                  <button 
                    onClick={() => handleAddTask('PLANLANAN')}
                    style={{ width: '100%', padding: '1rem', border: '1.5px dashed #cbd5e1', borderRadius: '0.75rem', backgroundColor: 'transparent', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', marginTop: '0.5rem' }}
                  >
                    <Plus size={16} /> İçerik Ekle
                  </button>
                )}
              </div>
            </div>

            {/* ÜRETİMDE */}
            <div 
              style={{ flex: '1', minWidth: '220px', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column' }}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, 'URETIMDE')}
            >
              <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem', padding: '0 0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '0.05em' }}>ÜRETİMDE</span>
                <span style={{ backgroundColor: 'var(--surface-color)', color: 'var(--text-main)', fontSize: '0.75rem', fontWeight: 'bold', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  {tasks.filter(t => t.columnId === 'URETIMDE').length}
                </span>
              </div>
              <div className="flex-col" style={{ flex: 1 }}>
                {renderColumnCards('URETIMDE')}
              </div>
            </div>

            {/* TAMAMLANAN */}
            <div 
              style={{ flex: '1', minWidth: '220px', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column' }}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, 'TAMAMLANAN')}
            >
              <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem', padding: '0 0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '0.05em' }}>TAMAMLANAN</span>
                <CheckCircle size={20} color="var(--primary-color)" />
              </div>
              <div className="flex-col" style={{ flex: 1 }}>
                {renderColumnCards('TAMAMLANAN')}
              </div>
            </div>
          </div>
        </div>

        {/* Yaklaşan Görevler Section */}
        <div style={{ flex: '1', minWidth: '300px', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-color)', padding: '1.5rem', borderRadius: '1rem' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Yaklaşan Akış</h2>
            </div>
            
            <div className="flex-col gap-5" style={{ flex: 1 }}>
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


      {/* Modal - Görev Formu */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowModal(false)}></div>
          <div style={{ position: 'relative', width: '100%', maxWidth: '550px', backgroundColor: 'var(--surface-color)', borderRadius: '24px', padding: '2rem', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{isEditing ? 'İçerik Düzenle' : 'Yeni Sosyal Medya İçeriği'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateOrUpdateTask}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>İÇERİK BAŞLIĞI</label>
                  <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }} placeholder="Paylaşım başlığı..." />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>AÇIKLAMA</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', minHeight: '80px', resize: 'vertical' }} placeholder="Paylaşım detayları..." />
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

const KanbanCard = ({ id, platform, platformBg, platformColor, title, desc, avatars = [], metaIconType, metaNumber, progress, activeBorder, isCompleted, onDragStart, onDelete, onEdit, canEdit = true }) => {
  const [showMenu, setShowMenu] = useState(false);
  
  const cardStyle = {
    backgroundColor: 'var(--surface-color)',
    borderRadius: '1rem',
    padding: '1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    borderLeft: activeBorder ? '5px solid var(--primary-color)' : 'none',
    opacity: isCompleted ? 0.6 : 1,
    cursor: canEdit ? 'grab' : 'default'
  };

  let MetaIcon = null;
  if (metaIconType === 'message') MetaIcon = <MessageSquare size={14} color="var(--text-muted)" />;
  if (metaIconType === 'paperclip') MetaIcon = <Paperclip size={14} color="var(--text-muted)" />;

  return (
    <div 
      style={cardStyle}
      draggable={canEdit}
      onDragStart={(e) => onDragStart(e, id)}
    >
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem', position: 'relative' }}>
        <span style={{ backgroundColor: platformBg, color: platformColor, padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.65rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {platform} {isCompleted && <Check size={12} />}
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
      
      <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: isCompleted ? '#94a3b8' : 'var(--text-main)', textDecoration: isCompleted ? 'line-through' : 'none' }}>{title}</h4>
      <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4', marginBottom: '1.25rem' }}>{desc}</p>
      
      {progress && (
        <div className="flex items-center gap-3" style={{ marginBottom: '1.25rem' }}>
          <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px' }}>
            <div style={{ width: `${progress}%`, height: '100%', backgroundColor: 'var(--primary-color)', borderRadius: '2px' }}></div>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary-color)' }}>%{progress}</span>
        </div>
      )}

      {(avatars.length > 0 || metaNumber) && (
        <div className="flex justify-between items-center mt-auto" style={{ paddingTop: '0.5rem' }}>
          <div className="flex" style={{ marginLeft: '10px' }}>
            {avatars.map((name, i) => (
              <div key={i} className="avatar" style={{ width: '26px', height: '26px', border: '2px solid white', marginLeft: '-10px', boxShadow: '0 0 0 1px rgba(0,0,0,0.05)' }}>
                <img src={`https://ui-avatars.com/api/?name=${name}&background=random&color=fff`} alt={name} />
              </div>
            ))}
          </div>
          {MetaIcon && (
            <div className="flex items-center gap-1" style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>
              {MetaIcon} <span>{metaNumber}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


const PlanRow = ({ title, platform, platformDot, avatarInitials, avatarBg, responsible, status, statusBg, statusColor, date }) => {
  const isHighPriority = status.includes('YÜKSEK');
  
  return (
    <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}>
      <td style={{ padding: '1.5rem', fontWeight: '600', color: 'var(--text-main)' }}>{title}</td>
      <td style={{ padding: '1.5rem' }}>
        <div className="flex items-center gap-2">
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: platformDot }}></span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500' }}>{platform}</span>
        </div>
      </td>
      <td style={{ padding: '1.5rem' }}>
        <div className="flex items-center gap-2">
          <div className="avatar" style={{ width: '28px', height: '28px' }}>
            <img src={`https://ui-avatars.com/api/?name=${avatarInitials}&background=${avatarBg}&color=fff`} alt={responsible} />
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{responsible}</span>
        </div>
      </td>
      <td style={{ padding: '1.5rem' }}>
        {isHighPriority ? (
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px', backgroundColor: statusBg, color: statusColor, padding: '0.4rem 0.6rem', borderRadius: '0.5rem', fontSize: '0.65rem', fontWeight: '700', textAlign: 'center' }}>
            <span>YÜKSEK</span>
            <span>ÖNCELİK</span>
          </div>
        ) : (
          <span style={{ backgroundColor: statusBg, color: statusColor, padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '700' }}>
            {status}
          </span>
        )}
      </td>
      <td style={{ padding: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>{date}</td>
    </tr>
  );
};

export default SocialMedia;
