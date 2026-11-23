import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { apiFetch, API_BASE_URL } from '../../lib/api';
import { getDateConstraints } from '../../lib/dateConstraints';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { isCommitteeManager } from '../../lib/roles';
import KanbanCard from './KanbanCard';
import UpcomingCard from './UpcomingCard';
import TaskFormModal from './TaskFormModal';
import { 
  Plus, AlertCircle, Calendar, X, FileText, 
  Link as LinkIcon, UserCheck
} from 'lucide-react';
import { getPriorityMeta } from '../../lib/priority';
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

      const formatCardDate = (task) => {
        const targetDate = task.end_date || task.start_date || task.created_at;
        if (!targetDate) return '';
        const parsed = new Date(targetDate);
        if (Number.isNaN(parsed.getTime())) return '';
        return parsed.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      };

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
          time: formatCardDate(t),
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
      const validation = validateFileUpload(file, 4);
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
    const userIsManager = isCommitteeManager(user, committee);
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
    setIsEditing(false);
  };

  const handleDeleteTask = async (id) => {
    if (!canEdit) return;
    const orig = fetchedTasks.find(t => t.id === id);
    const userIsManager = isCommitteeManager(user, committee);
    const isCreator = orig?.creator_id && user?.id && String(orig.creator_id) === String(user.id);
    if (!userIsManager && !isCreator) {
      toastError('Bu görevi silme yetkiniz bulunmuyor. Yalnızca yetkili yöneticiler veya görevi oluşturan kişi silebilir.');
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

  const userIsManager = isCommitteeManager(user, committee);
  const isTaskCreator = formData.creator_id && user?.id && String(formData.creator_id) === String(user.id);
  const canManageAssignees = userIsManager || (isEditing ? isTaskCreator : true);

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
            {fetchedTasks.length > 0 ? [...fetchedTasks]
              .sort((a, b) => {
                const aEnd = a.end_date ? new Date(a.end_date).getTime() : Number.POSITIVE_INFINITY;
                const bEnd = b.end_date ? new Date(b.end_date).getTime() : Number.POSITIVE_INFINITY;
                if (aEnd !== bEnd) return aEnd - bEnd;
                return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
              })
              .slice(0, 8)
              .map(task => {
                const endDate = task.end_date ? new Date(task.end_date) : null;
                const hasValidEndDate = endDate && !Number.isNaN(endDate.getTime());
                return (
                  <UpcomingCard 
                    key={task.id}
                    month={hasValidEndDate ? endDate.toLocaleDateString('tr-TR', { month: 'short' }).toUpperCase() : 'BİTİŞ'}
                    day={hasValidEndDate ? endDate.getDate() : '-'}
                    dayBg="var(--bg-color)"
                    title={task.title}
                    desc={task.creator_name ? `${task.creator_name} tarafından` : 'Genel'}
                    timeTag={task.task_assignments?.length > 0 ? `${task.task_assignments.length} Kişi Atandı` : 'Atama Bekliyor'}
                  />
                );
              }) : (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Henüz bir akış kaydı bulunmuyor.
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Görev Ekle / Düzenle Modal */}
      <TaskFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleCreateOrUpdateTask}
        isEditing={isEditing}
        itemLabel={itemLabel}
        subtitle={`${title} panosu için ${itemLabel.toLowerCase()} bilgilerini ve sorumluları düzenleyin.`}
        formData={formData}
        setFormData={setFormData}
        members={members}
        canManageAssignees={canManageAssignees}
        uploading={uploading}
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        minDateString={minDateString}
        maxDateString={maxDateString}
        columns={columns}
        submitLabel={isEditing ? 'Değişiklikleri Kaydet' : `${itemLabel} Ekle`}
      />

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
