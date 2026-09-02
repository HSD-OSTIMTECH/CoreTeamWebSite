import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { apiFetch } from '../../lib/api';
import { getDateConstraints } from '../../lib/dateConstraints';
import { useToast } from '../../context/ToastContext';
import KanbanCard from './KanbanCard';
import UpcomingCard from './UpcomingCard';
import { 
  Plus, AlertCircle, Calendar, X, FileText, Upload, 
  Link as LinkIcon, Edit2, Search, UserCheck, Check
} from 'lucide-react';
import './CommitteeBoard.css';

const CommitteeBoard = ({
  committee,
  title,
  subtitle,
  icon: HeaderIcon,
  itemLabel = 'Görev',
  columns = [],
  canEdit = true
}) => {
  const { success, error: toastError } = useToast();
  const defaultColumnId = columns[0]?.id || 'PLANLAMA';
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
  const { minDateString, maxDateString } = getDateConstraints();

  const [formData, setFormData] = useState({
    id: null,
    title: '',
    description: '',
    assignedUsers: [],
    link_url: '',
    attachment_url: '',
    column_id: defaultColumnId,
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    fetchCommitteeTasks();
    fetchMembers();

    // Supabase Realtime ile tasks ve task_assignments tablolarını canlı dinle
    const channel = supabase
      .channel(`realtime-board-${committee}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchCommitteeTasks();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignments' }, () => {
        fetchCommitteeTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [committee]);

  const fetchMembers = async () => {
    try {
      // Önce API'den çekmeyi dene
      const response = await apiFetch('/api/auth/users');
      if (response.ok) {
        const data = await response.json();
        setMembers(data || []);
        return;
      }
    } catch (err) {
      console.warn('API üzerinden kullanıcı listesi alınamadı, Supabase deneniyor:', err);
    }

    // Fallback olarak doğrudan Supabase'den çek
    try {
      const { data, error } = await supabase.from('custom_users').select('id, username, rank');
      if (!error && data) {
        setMembers(data);
      }
    } catch (err) {
      console.error('Kullanıcı listesi alınamadı:', err);
    }
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
        .eq('committee', committee)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const dbTasks = data || [];
      setFetchedTasks(dbTasks);

      const mappedTasks = dbTasks.map(t => {
        const isHigh = t.priority === 'YÜKSEK';
        return {
          id: t.id,
          columnId: t.column_id || defaultColumnId,
          priority: t.priority || 'NORMAL',
          priorityBg: isHigh ? 'var(--danger-bg)' : '#f1f5f9',
          priorityColor: isHigh ? 'var(--danger)' : '#64748b',
          title: t.title,
          description: t.description,
          link_url: t.link_url,
          attachment_url: t.attachment_url,
          time: 'Yeni',
          avatars: (t.task_assignments || []).map(a => a.user_name).filter(Boolean)
        };
      });

      setTasks(mappedTasks);
    } catch (err) {
      console.error(`${committee} görevleri yüklenemedi:`, err);
    } finally {
      setLoading(false);
    }
  };

  // Drag & Drop
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
    if (!taskId) return;

    try {
      const isCompleted = columnId.toLowerCase().includes('tamam');
      const { error } = await supabase
        .from('tasks')
        .update({ 
          column_id: columnId,
          status: isCompleted ? 'completed' : 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prev => prev.map(task => {
        if (task.id === taskId) {
          return { ...task, columnId };
        }
        return task;
      }));

      fetchCommitteeTasks();
    } catch (err) {
      console.error('Görev sütun güncelleme hatası:', err);
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
      console.error('Dosya yüklenemedi:', err);
      toastError('Dosya yüklenirken bir hata oluştu.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleCreateOrUpdateTask = async (e) => {
    e.preventDefault();
    if (!formData.title) return;

    try {
      let finalAttachmentUrl = formData.attachment_url;
      if (selectedFile) {
        const uploadedUrl = await uploadFile(selectedFile);
        if (uploadedUrl) finalAttachmentUrl = uploadedUrl;
      }

      const isCompleted = formData.column_id.toLowerCase().includes('tamam');
      const payload = {
        title: formData.title,
        description: formData.description,
        link_url: formData.link_url,
        attachment_url: finalAttachmentUrl,
        committee: committee,
        column_id: formData.column_id,
        status: isCompleted ? 'completed' : 'pending',
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null
      };

      let taskId = formData.id;
      const customUser = JSON.parse(localStorage.getItem('custom_user') || '{}');

      if (isEditing && taskId) {
        const { error } = await supabase.from('tasks').update(payload).eq('id', taskId);
        if (error) throw error;
        await supabase.from('task_assignments').delete().eq('task_id', taskId);
      } else {
        const { data, error } = await supabase
          .from('tasks')
          .insert([{ ...payload, creator_id: customUser.id || null, creator_name: customUser.username || 'Bilinmiyor' }])
          .select();
        if (error) throw error;
        taskId = data[0].id;
      }

      // Atamaları kaydet
      if (formData.assignedUsers.length > 0 && taskId) {
        const assignments = formData.assignedUsers.map(userId => {
          const member = members.find(m => m.id === userId);
          return {
            task_id: taskId,
            user_id: userId,
            user_name: member ? member.username : 'Bilinmeyen Üye',
            status: 'pending'
          };
        });

        await supabase.from('task_assignments').insert(assignments);

        // Bildirimleri kaydet
        const notifications = formData.assignedUsers.map(userId => ({
          user_id: userId,
          message: `Size yeni bir ${itemLabel.toLowerCase()} atandı: ${formData.title}`,
          is_read: false
        }));

        await supabase.from('notifications').insert(notifications);
      }

      setShowModal(false);
      resetForm();
      fetchCommitteeTasks();
      success(isEditing ? `${itemLabel} başarıyla güncellendi.` : `Yeni ${itemLabel.toLowerCase()} başarıyla eklendi!`);
    } catch (err) {
      console.error('İşlem hatası:', err);
      toastError('Kayıt sırasında bir hata oluştu.');
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
      column_id: defaultColumnId,
      start_date: '',
      end_date: ''
    });
    setSelectedFile(null);
    setSearchTerm('');
    setIsEditing(false);
  };

  const handleDeleteTask = async (id) => {
    if (!canEdit) return;
    if (!window.confirm(`Bu ${itemLabel.toLowerCase()} kaydını silmek istediğinize emin misiniz?`)) return;

    try {
      await supabase.from('tasks').delete().eq('id', id);
      setTasks(prev => prev.filter(t => t.id !== id));
      setFetchedTasks(prev => prev.filter(t => t.id !== id));
      success(`${itemLabel} silindi.`);
    } catch (err) {
      console.error('Silme hatası:', err);
      toastError('Silme işlemi başarısız oldu.');
    }
  };

  const toggleUserAssignment = (userId) => {
    setFormData(prev => {
      const exists = prev.assignedUsers.includes(userId);
      return {
        ...prev,
        assignedUsers: exists 
          ? prev.assignedUsers.filter(id => id !== userId) 
          : [...prev.assignedUsers, userId]
      };
    });
  };

  const filteredMembers = members.filter(m => 
    m.username?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (m.rank && m.rank.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="page-container">
      {/* Page Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            {HeaderIcon && <HeaderIcon size={28} color="var(--primary-color)" />}
            <h1 className="page-title" style={{ fontSize: '2rem', margin: 0 }}>{title}</h1>
          </div>
          <p className="page-subtitle" style={{ fontSize: '0.95rem', margin: 0 }}>{subtitle}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!canEdit ? (
            <div style={{ backgroundColor: '#fff7ed', color: '#c2410c', padding: '0.5rem 1rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600', border: '1px solid #ffedd5', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} /> Sadece Görüntüleme Modu
            </div>
          ) : (
            <button 
              type="button" 
              onClick={() => handleAddTask(defaultColumnId)}
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.25rem', borderRadius: '12px', fontWeight: '700', gap: '0.5rem' }}
            >
              <Plus size={18} /> Yeni {itemLabel}
            </button>
          )}
        </div>
      </div>

      <div className="committee-layout">
        {/* Sol Taraf: Kanban Tahtası */}
        <div className="committee-board-scroll-wrap">
          <div className="committee-board-container">
            {columns.map((col, colIdx) => {
              const colTasks = tasks.filter(t => t.columnId === col.id);
              return (
                <div 
                  key={col.id}
                  className="committee-column"
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, col.id)}
                >
                  <div className="committee-column-header">
                    <span className="committee-column-title">
                      {col.label}
                    </span>
                    <span className="committee-column-count">
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="committee-cards-list">
                    {colTasks.map(task => (
                      <KanbanCard 
                        key={task.id}
                        id={task.id}
                        priority={task.priority}
                        priorityBg={task.priorityBg}
                        priorityColor={task.priorityColor}
                        title={task.title}
                        time={task.time}
                        avatars={task.avatars}
                        link_url={task.link_url}
                        attachment_url={task.attachment_url}
                        itemLabel={itemLabel}
                        onDragStart={onDragStart}
                        onDelete={handleDeleteTask}
                        onEdit={() => openEditModal(task)}
                        canEdit={canEdit}
                      />
                    ))}

                    {/* Sadece ilk sütunun altında ekleme butonu */}
                    {canEdit && colIdx === 0 && (
                      <button 
                        type="button"
                        onClick={() => handleAddTask(col.id)}
                        className="committee-add-btn"
                      >
                        <Plus size={16} /> {itemLabel} Ekle
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sağ Taraf: Yaklaşan Akış Section */}
        <aside className="committee-upcoming-card">
          <div className="committee-upcoming-header">
            <h3>Yaklaşan Akış</h3>
          </div>
          
          <div className="committee-upcoming-list">
            {fetchedTasks.length > 0 ? fetchedTasks.slice(0, 8).map(task => (
              <UpcomingCard 
                key={task.id}
                month={task.created_at ? new Date(task.created_at).toLocaleDateString('tr-TR', { month: 'short' }).toUpperCase() : 'YENİ'}
                day={task.created_at ? new Date(task.created_at).getDate() : '-'}
                dayBg="var(--bg-color)"
                title={task.title}
                desc={task.creator_name ? `${task.creator_name} tarafından` : 'Genel'}
                timeTag={task.task_assignments?.length > 0 ? `${task.task_assignments.length} Kişi Atandı` : 'Atama Bekliyor'}
              />
            )) : (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Henüz bir akış kaydı bulunmuyor.
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Görev Ekle / Düzenle Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div 
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} 
            onClick={() => setShowModal(false)} 
          />
          <div 
            style={{ 
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
            }}
          >
            <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                {isEditing ? `${itemLabel} Düzenle` : `Yeni ${itemLabel}`}
              </h2>
              <button 
                type="button" 
                onClick={() => setShowModal(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdateTask}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                    BAŞLIK *
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={formData.title} 
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })} 
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }} 
                    placeholder={`${itemLabel} başlığı...`} 
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                    AÇIKLAMA
                  </label>
                  <textarea 
                    value={formData.description} 
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', minHeight: '80px', resize: 'vertical' }} 
                    placeholder="Detaylar ve açıklamalar..." 
                  />
                </div>

                <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                      BAŞLANGIÇ TARİHİ
                    </label>
                    <input 
                      type="date" 
                      min={minDateString} 
                      max={maxDateString} 
                      value={formData.start_date} 
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} 
                      style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }} 
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                      BİTİŞ TARİHİ
                    </label>
                    <input 
                      type="date" 
                      min={minDateString} 
                      max={maxDateString} 
                      value={formData.end_date} 
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} 
                      style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }} 
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                    İLGİLİ BAĞLANTI
                  </label>
                  <div style={{ position: 'relative' }}>
                    <LinkIcon size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="url" 
                      value={formData.link_url} 
                      onChange={(e) => setFormData({ ...formData, link_url: e.target.value })} 
                      style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.2rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none' }} 
                      placeholder="https://..." 
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                    DURUM SÜTUNU
                  </label>
                  <select 
                    value={formData.column_id} 
                    onChange={(e) => setFormData({ ...formData, column_id: e.target.value })} 
                    style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none' }}
                  >
                    {columns.map(col => (
                      <option key={col.id} value={col.id}>{col.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                    EK DOSYA YÜKLE
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <label style={{ flex: 1, border: '1.5px dashed var(--border-color)', borderRadius: '12px', padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', backgroundColor: 'var(--bg-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <Upload size={16} /> {selectedFile ? selectedFile.name : 'Dosya Seçin'}
                      <input type="file" style={{ display: 'none' }} onChange={(e) => setSelectedFile(e.target.files[0] || null)} />
                    </label>
                    {selectedFile && (
                      <button type="button" onClick={() => setSelectedFile(null)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                        <X size={18} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Kişi Atama Multi-Select */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                    KİŞİ ATAMA ({formData.assignedUsers.length} Seçili)
                  </label>
                  
                  <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      placeholder="Üye ara..." 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)} 
                      style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.8rem', outline: 'none' }} 
                    />
                  </div>

                  <div style={{ maxHeight: '130px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem', backgroundColor: 'var(--bg-color)' }}>
                    {filteredMembers.map(m => {
                      const isSelected = formData.assignedUsers.includes(m.id);
                      return (
                        <div 
                          key={m.id} 
                          onClick={() => toggleUserAssignment(m.id)} 
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer', backgroundColor: isSelected ? 'var(--primary-bg)' : 'transparent', marginBottom: '2px' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--primary-color)' : 'var(--text-main)' }}>
                              {m.username}
                            </span>
                            {m.rank && (
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                ({m.rank})
                              </span>
                            )}
                          </div>
                          {isSelected && <Check size={14} color="var(--primary-color)" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  style={{ padding: '0.75rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-main)', fontWeight: '600', cursor: 'pointer' }}
                >
                  İptal
                </button>
                <button 
                  type="submit" 
                  disabled={uploading}
                  style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none', backgroundColor: 'var(--primary-color)', color: 'white', fontWeight: '700', cursor: uploading ? 'not-allowed' : 'pointer' }}
                >
                  {uploading ? 'Yükleniyor...' : (isEditing ? 'Güncelle' : 'Kaydet')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommitteeBoard;
