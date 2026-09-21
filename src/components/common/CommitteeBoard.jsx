import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { apiFetch, API_BASE_URL } from '../../lib/api';
import { getDateConstraints } from '../../lib/dateConstraints';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { isManager } from '../../lib/roles';
import KanbanCard from './KanbanCard';
import UpcomingCard from './UpcomingCard';
import { 
  Plus, AlertCircle, Calendar, X, FileText, Upload, 
  Link as LinkIcon, Edit2, Search, UserCheck, Check, Lock
} from 'lucide-react';
import { PRIORITY_OPTIONS, getPriorityMeta } from '../../lib/priority';
import { sanitizeUrl, validateFileUpload } from '../../lib/security';
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
  const { user } = useAuth();
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

  // Member Detail & Status Modal States
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetailTask, setSelectedDetailTask] = useState(null);
  const [detailStatusColumn, setDetailStatusColumn] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [formData, setFormData] = useState({
    id: null,
    title: '',
    description: '',
    assignedUsers: [],
    link_url: '',
    attachment_url: '',
    column_id: defaultColumnId,
    start_date: '',
    end_date: '',
    creator_id: null,
    priority: 'NORMAL'
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
      const response = await apiFetch('/api/auth/users');
      if (response.ok) {
        const data = await response.json();
        setMembers(data || []);
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
        const meta = getPriorityMeta(t.priority);
        return {
          id: t.id,
          columnId: t.column_id || defaultColumnId,
          priority: meta.label.toUpperCase(),
          rawPriority: t.priority || 'NORMAL',
          priorityBg: meta.bg,
          priorityColor: meta.color,
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
      const res = await apiFetch(`/api/tasks/${taskId}/column`, {
        method: 'PUT',
        body: JSON.stringify({ column_id: columnId })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Sütun güncellenemedi');
      }

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
      const validation = validateFileUpload(file, 15);
      if (!validation.valid) {
        toastError(validation.error);
        return null;
      }
      setUploading(true);

      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/tasks/upload`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formDataUpload
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Dosya yüklenemedi');
      }

      const data = await res.json();
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

      const payload = {
        title: formData.title,
        description: formData.description,
        link_url: formData.link_url,
        attachment_url: finalAttachmentUrl,
        committee: committee,
        column_id: formData.column_id,
        priority: formData.priority || 'NORMAL',
        assignedUsers: formData.assignedUsers,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null
      };

      let taskId = formData.id;

      if (isEditing && taskId) {
        const res = await apiFetch(`/api/tasks/${taskId}`, {
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
      fetchCommitteeTasks();
      success(isEditing ? `${itemLabel} başarıyla güncellendi.` : `Yeni ${itemLabel.toLowerCase()} başarıyla eklendi!`);
    } catch (err) {
      console.error('İşlem hatası:', err);
      toastError(err.message || 'Kayıt sırasında bir hata oluştu.');
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
      end_date: orig?.end_date ? orig.end_date.split('T')[0] : '',
      creator_id: orig?.creator_id || null,
      priority: orig?.priority || task.rawPriority || task.priority || 'NORMAL'
    });
    setIsEditing(true);
    setShowModal(true);
  };

  const handleTaskClick = (task) => {
    const orig = fetchedTasks.find(t => t.id === task.id);
    const userIsManager = isManager(user);
    const isCreator = orig?.creator_id && user?.id && String(orig.creator_id) === String(user.id);

    if (userIsManager || isCreator) {
      openEditModal(task);
    } else {
      setSelectedDetailTask({ ...task, orig });
      setDetailStatusColumn(task.columnId || defaultColumnId);
      setShowDetailModal(true);
    }
  };

  const handleUpdateDetailStatus = async () => {
    if (!selectedDetailTask || !detailStatusColumn) return;
    setUpdatingStatus(true);
    try {
      const res = await apiFetch(`/api/tasks/${selectedDetailTask.id}/column`, {
        method: 'PUT',
        body: JSON.stringify({ column_id: detailStatusColumn })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Aşama güncellenemedi');
      }

      setTasks(prev => prev.map(t => {
        if (t.id === selectedDetailTask.id) {
          return { ...t, columnId: detailStatusColumn };
        }
        return t;
      }));

      setShowDetailModal(false);
      setSelectedDetailTask(null);
      fetchCommitteeTasks();
      success('Görev aşaması başarıyla güncellendi.');
    } catch (err) {
      console.error('Durum güncelleme hatası:', err);
      toastError(err.message || 'Aşama güncellenirken hata oluştu.');
    } finally {
      setUpdatingStatus(false);
    }
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
      end_date: '',
      creator_id: null,
      priority: 'NORMAL'
    });
    setSelectedFile(null);
    setSearchTerm('');
    setIsEditing(false);
  };

  const handleDeleteTask = async (id) => {
    if (!canEdit) return;
    const orig = fetchedTasks.find(t => t.id === id);
    const userIsManager = isManager(user);
    const isCreator = orig?.creator_id && user?.id && String(orig.creator_id) === String(user.id);
    if (!userIsManager && !isCreator) {
      toastError('Bu görevi silme yetkiniz bulunmuyor. Yalnızca yöneticiler veya görevi oluşturan kişi silebilir.');
      return;
    }

    if (!window.confirm(`Bu ${itemLabel.toLowerCase()} kaydını silmek istediğinize emin misiniz?`)) return;

    try {
      const res = await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Silme başarısız');
      }
      setTasks(prev => prev.filter(t => t.id !== id));
      setFetchedTasks(prev => prev.filter(t => t.id !== id));
      success(`${itemLabel} silindi.`);
    } catch (err) {
      console.error('Silme hatası:', err);
      toastError(err.message || 'Silme işlemi başarısız oldu.');
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

  const userIsManager = isManager(user);
  const isTaskCreator = formData.creator_id && user?.id && String(formData.creator_id) === String(user.id);
  const canManageAssignees = userIsManager || (isEditing ? isTaskCreator : true);

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
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.35rem', borderRadius: '12px', fontWeight: '700', fontSize: '0.9rem', boxShadow: '0 4px 6px -1px rgba(15, 118, 110, 0.2)', border: 'none', cursor: 'pointer' }}
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
                    {colTasks.map(task => {
                      const orig = fetchedTasks.find(t => t.id === task.id);
                      const isCardCreator = orig?.creator_id && user?.id && String(orig.creator_id) === String(user.id);
                      const canDeleteCard = userIsManager || isCardCreator;
                      return (
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
                          onEdit={() => handleTaskClick(task)}
                          canEdit={canEdit}
                          canDelete={canDeleteCard}
                          editLabel={canDeleteCard ? `${itemLabel} Düzenle` : 'Detayları İncele'}
                        />
                      );
                    })}

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

                {/* Öncelik Seçici */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                    ÖNCELİK SEVİYESİ
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

                {/* Kişi Atama Bölümü */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                      KİŞİ ATAMA ({formData.assignedUsers.length} Seçili)
                    </label>
                    {!canManageAssignees && (
                      <span style={{ fontSize: '0.7rem', color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '600', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '6px' }}>
                        <Lock size={12} /> Yalnızca Yöneticiler Değiştirebilir
                      </span>
                    )}
                  </div>
                  
                  {canManageAssignees ? (
                    <>
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
                                  {m.full_name || m.username}
                                </span>
                                {m.full_name && m.username && (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    (@{m.username})
                                  </span>
                                )}
                                {m.rank && (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                    [{m.rank}]
                                  </span>
                                )}
                              </div>
                              {isSelected && <Check size={14} color="var(--primary-color)" />}
                            </div>
                          );
                        })}
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

      {/* Üye Bilgi ve Durum Güncelleme Modalı */}
      {showDetailModal && selectedDetailTask && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowDetailModal(false)}></div>
          <div style={{ 
            position: 'relative', 
            width: '100%', 
            maxWidth: '600px', 
            backgroundColor: 'var(--surface-color)', 
            borderRadius: '24px', 
            padding: '2rem', 
            boxShadow: 'var(--shadow-lg)', 
            border: '1px solid var(--border-color)', 
            maxHeight: '90vh', 
            overflowY: 'auto' 
          }}>
            {/* Üst Bilgi ve Kapatma Butonu */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ 
                    backgroundColor: selectedDetailTask.priorityBg || '#f1f5f9', 
                    color: selectedDetailTask.priorityColor || '#64748b', 
                    padding: '0.2rem 0.6rem', 
                    borderRadius: '1rem', 
                    fontSize: '0.65rem', 
                    fontWeight: '700', 
                    textTransform: 'uppercase' 
                  }}>
                    {selectedDetailTask.priority || 'NORMAL'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={13} /> {selectedDetailTask.orig?.start_date ? new Date(selectedDetailTask.orig.start_date).toLocaleDateString('tr-TR') : 'Tarih yok'} 
                    {selectedDetailTask.orig?.end_date ? ` - ${new Date(selectedDetailTask.orig.end_date).toLocaleDateString('tr-TR')}` : ''}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 0.25rem 0' }}>
                  {selectedDetailTask.title}
                </h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  👤 Atayan: <strong style={{ color: 'var(--text-main)' }}>{selectedDetailTask.orig?.creator_name || 'Yönetici'}</strong>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowDetailModal(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Açıklama */}
            <div style={{ marginBottom: '1.5rem', backgroundColor: 'var(--bg-color)', borderRadius: '14px', padding: '1rem', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                Açıklama & Detaylar
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {selectedDetailTask.description || selectedDetailTask.orig?.description || 'Bu görev için detaylı açıklama eklenmemiş.'}
              </p>
            </div>

            {/* Ekler ve Linkler (Varsa) */}
            {(() => {
              const safeLink = sanitizeUrl(selectedDetailTask.link_url);
              const safeAttachment = sanitizeUrl(selectedDetailTask.attachment_url);
              if (!safeLink && !safeAttachment) return null;
              return (
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                  {safeLink && (
                    <a 
                      href={safeLink} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ flex: 1, minWidth: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--info-bg)', color: 'var(--info)', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '700', textDecoration: 'none' }}
                    >
                      <LinkIcon size={16} /> Bağlantıya Git
                    </a>
                  )}
                  {safeAttachment && (
                    <a 
                      href={safeAttachment} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ flex: 1, minWidth: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--primary-bg)', color: 'var(--primary-color)', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '700', textDecoration: 'none' }}
                    >
                      <FileText size={16} /> Ek Dosyayı İncele
                    </a>
                  )}
                </div>
              );
            })()}

            {/* Görevli Kişiler */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                Görevli Kişiler ({selectedDetailTask.orig?.task_assignments?.length || 0})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {(!selectedDetailTask.orig?.task_assignments || selectedDetailTask.orig.task_assignments.length === 0) ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Atanan kişi bulunmuyor</span>
                ) : (
                  selectedDetailTask.orig.task_assignments.map((assignment, idx) => (
                    <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '10px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-main)' }}>
                      <UserCheck size={14} color="var(--primary-color)" />
                      <span>{assignment.user_name || 'Üye'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* GÖREV DURUMU GÜNCELLEME (Aşama Seçici) */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                  GÖREVİN AŞAMASINI DEĞİŞTİR
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Görevinizin durumunu aşağıdaki aşamalardan birine taşıyıp kaydedebilirsiniz.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: '0.6rem' }}>
                {columns.map(col => {
                  const isSelected = detailStatusColumn === col.id;
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setDetailStatusColumn(col.id)}
                      style={{
                        padding: '0.75rem 0.5rem',
                        borderRadius: '12px',
                        border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                        backgroundColor: isSelected ? 'var(--primary-color)' : 'var(--bg-color)',
                        color: isSelected ? 'white' : 'var(--text-main)',
                        fontWeight: isSelected ? '700' : '600',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s',
                        boxShadow: isSelected ? '0 4px 6px -1px rgba(15, 118, 110, 0.25)' : 'none'
                      }}
                    >
                      {col.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Butonları */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                type="button" 
                onClick={() => setShowDetailModal(false)} 
                style={{ padding: '0.75rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-main)', fontWeight: '600', cursor: 'pointer' }}
              >
                Kapat
              </button>
              <button 
                type="button" 
                onClick={handleUpdateDetailStatus}
                disabled={updatingStatus}
                className="btn btn-primary"
                style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: '700', fontSize: '0.9rem', border: 'none', cursor: updatingStatus ? 'not-allowed' : 'pointer' }}
              >
                {updatingStatus ? 'Güncelleniyor...' : 'Aşamayı Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommitteeBoard;
