import React, { useState } from 'react';
import { MoreHorizontal, Edit2, Trash2, Clock, Link as LinkIcon, FileText } from 'lucide-react';
import { sanitizeUrl } from '../../lib/security';

const KanbanCard = ({
  id,
  priority = 'NORMAL',
  priorityBg = '#f1f5f9',
  priorityColor = '#64748b',
  title,
  time,
  progress,
  avatars = [],
  link_url,
  attachment_url,
  itemLabel = 'Görevi',
  onDragStart,
  onDelete,
  onEdit,
  canEdit = true,
  canDelete = true,
  editLabel
}) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      draggable={canEdit}
      onDragStart={(e) => onDragStart && onDragStart(e, id)}
      style={{
        backgroundColor: 'var(--surface-color)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
        cursor: canEdit ? 'grab' : 'default',
        border: '1px solid var(--border-color)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease'
      }}
      onClick={() => canEdit && onEdit && onEdit(id)}
    >
      {/* Top Header: Priority Badge & Options Menu */}
      <div className="flex justify-between items-start" style={{ marginBottom: '0.75rem', position: 'relative' }}>
        <span
          style={{
            backgroundColor: priorityBg,
            color: priorityColor,
            padding: '0.2rem 0.6rem',
            borderRadius: '1rem',
            fontSize: '0.65rem',
            fontWeight: '700',
            display: 'inline-block',
            textTransform: 'uppercase'
          }}
        >
          {priority}
        </span>

        {canEdit && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(prev => !prev);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
                borderRadius: '4px'
              }}
              aria-label="İşlemler"
            >
              <MoreHorizontal size={18} />
            </button>

            {showMenu && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    backgroundColor: 'var(--surface-color)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.5rem',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 50,
                    width: '160px',
                    overflow: 'hidden',
                    marginTop: '0.25rem'
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onEdit && onEdit(id);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.6rem 0.85rem',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-main)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-color)')}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Edit2 size={14} /> {editLabel || `${itemLabel} Düzenle`}
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onDelete && onDelete(id);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.6rem 0.85rem',
                        background: 'none',
                        border: 'none',
                        color: 'var(--danger)',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        borderTop: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-color)')}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Trash2 size={14} /> {itemLabel} Sil
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Title */}
      <h4
        style={{
          fontSize: '0.95rem',
          fontWeight: '600',
          marginBottom: '1rem',
          lineHeight: '1.4',
          color: 'var(--text-main)'
        }}
      >
        {title}
      </h4>

      {/* Progress Bar (Optional) */}
      {progress && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px' }}>
            <div style={{ width: progress, height: '100%', backgroundColor: 'var(--primary-color)', borderRadius: '3px' }}></div>
          </div>
        </div>
      )}

      {/* Links & Attachments Badges (If any) */}
      {(() => {
        const safeLink = sanitizeUrl(link_url);
        const safeAttachment = sanitizeUrl(attachment_url);
        if (!safeLink && !safeAttachment) return null;
        return (
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
            {safeLink && (
              <a
                href={safeLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: '600' }}
              >
                <LinkIcon size={12} /> Link
              </a>
            )}
            {safeAttachment && (
              <a
                href={safeAttachment}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: '600' }}
              >
                <FileText size={12} /> Ek Dosya
              </a>
            )}
          </div>
        );
      })()}

      {/* Footer: Avatars & Meta */}
      <div className="flex justify-between items-center mt-auto" style={{ paddingTop: '0.5rem' }}>
        <div className="flex" style={{ marginLeft: '10px' }}>
          {avatars.slice(0, 4).map((name, i) => (
            <div
              key={i}
              className="avatar"
              style={{
                width: '24px',
                height: '24px',
                border: '2px solid var(--surface-color)',
                marginLeft: '-10px',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.05)',
                borderRadius: '50%',
                overflow: 'hidden'
              }}
              title={name}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--primary-color)', color: '#fff', fontWeight: '700', fontSize: '0.6rem', width: '100%', height: '100%', borderRadius: '50%' }}>
                {(name || 'U').charAt(0).toUpperCase()}
              </div>
            </div>
          ))}
          {avatars.length > 4 && (
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-muted)',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '-10px',
                border: '2px solid var(--surface-color)'
              }}
            >
              +{avatars.length - 4}
            </div>
          )}
        </div>

        {time && (
          <div style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} /> {time}
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanCard;
