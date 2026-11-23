import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Calendar,
  Link as LinkIcon,
  Upload,
  Search,
  Check,
  Lock,
  UserCheck,
  Users,
  ClipboardList,
  Layers,
  Flag,
  Paperclip
} from 'lucide-react';
import { PRIORITY_OPTIONS } from '../../lib/priority';
import { COMMITTEE_OPTIONS } from '../../lib/roles';
import { matchesMember } from '../../lib/search';
import './TaskFormModal.css';

const formatFileSize = (bytes) => {
  if (!bytes || typeof bytes !== 'number') return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const TaskFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  isEditing = false,
  itemLabel = 'Görev',
  subtitle,
  formData,
  setFormData,
  members = [],
  canManageAssignees = true,
  uploading = false,
  selectedFile = null,
  setSelectedFile,
  minDateString,
  maxDateString,
  columns = null,
  committeeSelectOptions = null,
  submitLabel
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [committeeFilter, setCommitteeFilter] = useState('all');

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setCommitteeFilter('all');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesCommittee =
        committeeFilter === 'all' ||
        (Array.isArray(m.roles) && m.roles.includes(committeeFilter));
      return matchesCommittee && matchesMember(m, searchTerm);
    });
  }, [members, committeeFilter, searchTerm]);

  const selectedMemberObjects = useMemo(() => {
    const ids = formData.assignedUsers || [];
    return ids.map((uid) => {
      const found = members.find((m) => String(m.id) === String(uid));
      return found || { id: uid, full_name: 'Üye', username: '' };
    });
  }, [formData.assignedUsers, members]);

  const allFilteredSelected =
    filteredMembers.length > 0 &&
    filteredMembers.every((m) => (formData.assignedUsers || []).includes(m.id));

  const toggleUserAssignment = (userId) => {
    setFormData((prev) => {
      const current = prev.assignedUsers || [];
      const exists = current.includes(userId);
      return {
        ...prev,
        assignedUsers: exists
          ? current.filter((id) => id !== userId)
          : [...current, userId]
      };
    });
  };

  const toggleSelectFiltered = () => {
    const filteredIds = filteredMembers.map((m) => m.id);
    setFormData((prev) => {
      const current = prev.assignedUsers || [];
      if (allFilteredSelected) {
        return {
          ...prev,
          assignedUsers: current.filter((id) => !filteredIds.includes(id))
        };
      }
      return {
        ...prev,
        assignedUsers: [...new Set([...current, ...filteredIds])]
      };
    });
  };

  if (!isOpen) return null;

  const assignedCount = (formData.assignedUsers || []).length;
  const resolvedSubmitLabel =
    submitLabel || (isEditing ? 'Değişiklikleri Kaydet' : `${itemLabel} Oluştur`);

  return (
    <div className="tfm-backdrop" onClick={onClose}>
      <div className="tfm-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Header */}
        <div className="tfm-header">
          <div className="tfm-header-left">
            <div className="tfm-header-icon">
              <ClipboardList size={20} />
            </div>
            <div>
              <h2 className="tfm-title">
                {isEditing ? `${itemLabel} Düzenle` : `Yeni ${itemLabel}`}
              </h2>
              <p className="tfm-subtitle">
                {subtitle || 'Görev detaylarını, önceliğini ve sorumlu ekip üyelerini belirleyin.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="tfm-close-btn"
            onClick={onClose}
            aria-label="Kapat"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form className="tfm-form" onSubmit={onSubmit}>
          <div className="tfm-body">
            {/* Sol Sütun: Temel Bilgiler & Ekler */}
            <div className="tfm-col-main">
              <div className="tfm-field">
                <label className="tfm-label">
                  Başlık <span className="tfm-required">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="tfm-input tfm-input-title"
                  placeholder={`${itemLabel} başlığını girin...`}
                  autoFocus
                />
              </div>

              <div className="tfm-field">
                <label className="tfm-label">Açıklama</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="tfm-textarea"
                  placeholder="Yapılacaklar, hedefler veya önemli notları ekleyin..."
                />
              </div>

              <div className="tfm-grid-2">
                <div className="tfm-field">
                  <label className="tfm-label">
                    <Calendar size={12} /> Başlangıç Tarihi
                  </label>
                  <input
                    type="date"
                    min={minDateString}
                    max={maxDateString}
                    value={formData.start_date || ''}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="tfm-input"
                  />
                </div>
                <div className="tfm-field">
                  <label className="tfm-label">
                    <Calendar size={12} /> Bitiş Tarihi
                  </label>
                  <input
                    type="date"
                    min={formData.start_date || minDateString}
                    max={maxDateString}
                    value={formData.end_date || ''}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="tfm-input"
                  />
                </div>
              </div>

              <div className="tfm-field">
                <label className="tfm-label">
                  <LinkIcon size={12} /> İlgili Bağlantı (İsteğe Bağlı)
                </label>
                <div className="tfm-input-icon-wrap">
                  <LinkIcon size={15} className="tfm-input-icon" />
                  <input
                    type="url"
                    value={formData.link_url || ''}
                    onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                    className="tfm-input tfm-input-with-icon"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="tfm-field">
                <label className="tfm-label">
                  <Paperclip size={12} /> Ek Dosya (Maks. 4 MB)
                </label>
                <div className="tfm-upload-box">
                  <label className="tfm-upload-trigger">
                    <div className="tfm-upload-icon">
                      <Upload size={16} />
                    </div>
                    <div className="tfm-upload-text">
                      <span className="tfm-upload-name">
                        {selectedFile
                          ? selectedFile.name
                          : formData.attachment_url
                          ? 'Dosya eklendi (Değiştirmek için tıklayın)'
                          : 'Dosya seçin veya yükleyin'}
                      </span>
                      <span className="tfm-upload-hint">
                        {selectedFile
                          ? formatFileSize(selectedFile.size)
                          : 'PDF, görsel, ofis belgesi veya arşiv'}
                      </span>
                    </div>
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                  </label>

                  {(selectedFile || formData.attachment_url) && (
                    <button
                      type="button"
                      className="tfm-upload-clear"
                      title="Dosyayı Kaldır"
                      onClick={() => {
                        setSelectedFile(null);
                        if (formData.attachment_url) {
                          setFormData({ ...formData, attachment_url: '' });
                        }
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sağ Sütun: Durum/Komite, Öncelik ve Kişi Atama */}
            <div className="tfm-col-side">
              {Array.isArray(columns) && columns.length > 0 && (
                <div className="tfm-field">
                  <label className="tfm-label">
                    <Layers size={12} /> Durum Sütunu
                  </label>
                  <select
                    value={formData.column_id || columns[0].id}
                    onChange={(e) => setFormData({ ...formData, column_id: e.target.value })}
                    className="tfm-select"
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {Array.isArray(committeeSelectOptions) && committeeSelectOptions.length > 0 && (
                <div className="tfm-field">
                  <label className="tfm-label">
                    <Layers size={12} /> İlgili Komite / Sayfa
                  </label>
                  <select
                    value={formData.committee || ''}
                    onChange={(e) => setFormData({ ...formData, committee: e.target.value })}
                    className="tfm-select"
                  >
                    {committeeSelectOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="tfm-field">
                <label className="tfm-label">
                  <Flag size={12} /> Öncelik Seviyesi
                </label>
                <div className="tfm-priority-grid">
                  {PRIORITY_OPTIONS.map((p) => {
                    const isSelected = (formData.priority || 'NORMAL').toUpperCase() === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, priority: p.id })}
                        className="tfm-priority-btn"
                        style={
                          isSelected
                            ? {
                                backgroundColor: p.bg,
                                color: p.color,
                                borderColor: p.border,
                                fontWeight: 800
                              }
                            : undefined
                        }
                      >
                        <span className="tfm-priority-dot" style={{ backgroundColor: p.dot }} />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Kişi Atama */}
              <div className="tfm-field" style={{ flex: 1 }}>
                <div className="tfm-label-row">
                  <label className="tfm-label">
                    <Users size={12} /> Sorumlu Kişiler ({assignedCount})
                  </label>
                  {!canManageAssignees ? (
                    <span className="tfm-lock-badge">
                      <Lock size={11} /> Sadece Yönetici
                    </span>
                  ) : (
                    filteredMembers.length > 0 && (
                      <button
                        type="button"
                        className="tfm-select-all-btn"
                        onClick={toggleSelectFiltered}
                      >
                        {allFilteredSelected ? 'Seçimi Kaldır' : 'Görünenleri Seç'}
                      </button>
                    )
                  )}
                </div>

                {selectedMemberObjects.length > 0 && (
                  <div className="tfm-selected-chips">
                    {selectedMemberObjects.map((m) => (
                      <span key={m.id} className="tfm-chip">
                        <span className="tfm-chip-avatar">
                          {(m.full_name || m.username || 'U').charAt(0).toUpperCase()}
                        </span>
                        <span>{m.full_name || m.username}</span>
                        {canManageAssignees && (
                          <button
                            type="button"
                            className="tfm-chip-remove"
                            onClick={() => toggleUserAssignment(m.id)}
                            aria-label="Kişiyi kaldır"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {canManageAssignees ? (
                  <>
                    <div className="tfm-filter-bar">
                      {[{ id: 'all', label: 'Tümü' }, ...COMMITTEE_OPTIONS].map((opt) => {
                        const count =
                          opt.id === 'all'
                            ? members.length
                            : members.filter(
                                (m) => Array.isArray(m.roles) && m.roles.includes(opt.id)
                              ).length;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={`tfm-filter-pill ${committeeFilter === opt.id ? 'active' : ''}`}
                            onClick={() => setCommitteeFilter(opt.id)}
                          >
                            {opt.label} ({count})
                          </button>
                        );
                      })}
                    </div>

                    <div className="tfm-input-icon-wrap">
                      <Search size={14} className="tfm-input-icon" />
                      <input
                        type="text"
                        placeholder="İsim, kullanıcı adı veya rütbe ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="tfm-input tfm-input-with-icon"
                        style={{ paddingTop: '0.52rem', paddingBottom: '0.52rem', fontSize: '0.82rem' }}
                      />
                    </div>

                    <div className="tfm-members-list">
                      {filteredMembers.length === 0 ? (
                        <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Eşleşen üye bulunamadı.
                        </div>
                      ) : (
                        filteredMembers.map((m) => {
                          const isSelected = (formData.assignedUsers || []).includes(m.id);
                          return (
                            <div
                              key={m.id}
                              className={`tfm-member-row ${isSelected ? 'selected' : ''}`}
                              onClick={() => toggleUserAssignment(m.id)}
                            >
                              <div className="tfm-member-info">
                                <div className="tfm-member-avatar">
                                  {(m.full_name || m.username || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div className="tfm-member-text">
                                  <span className="tfm-member-name">{m.full_name || m.username}</span>
                                  <span className="tfm-member-meta">
                                    {m.username ? `@${m.username}` : ''}
                                    {m.username && m.rank ? ' · ' : ''}
                                    {m.rank || ''}
                                  </span>
                                </div>
                              </div>
                              <span className="tfm-check-circle">
                                <Check size={12} strokeWidth={3} />
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : (
                  selectedMemberObjects.length === 0 && (
                    <div style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Atanan kişi bulunmuyor
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="tfm-footer">
            <div className="tfm-footer-summary">
              <UserCheck size={15} color={assignedCount > 0 ? 'var(--primary-color)' : 'var(--text-muted)'} />
              <span>
                {assignedCount > 0
                  ? `${assignedCount} kişi sorumlu olarak atanacak`
                  : 'Henüz sorumlu kişi seçilmedi'}
              </span>
            </div>
            <div className="tfm-footer-actions">
              <button type="button" className="tfm-btn-cancel" onClick={onClose}>
                İptal
              </button>
              <button type="submit" className="tfm-btn-submit" disabled={uploading}>
                {uploading ? 'Yükleniyor...' : resolvedSubmitLabel}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskFormModal;
