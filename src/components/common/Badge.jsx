import React from 'react';

const Badge = ({ children, variant = 'primary', className = '' }) => {
  // variants: primary, danger, warning, success, info, gray
  
  const getStyles = () => {
    switch (variant) {
      case 'danger':
        return { bg: 'var(--danger-bg)', text: 'var(--danger)' };
      case 'warning':
        return { bg: 'var(--warning-bg)', text: 'var(--warning)' };
      case 'success':
        return { bg: 'var(--success-bg)', text: 'var(--success)' };
      case 'info':
        return { bg: 'var(--info-bg)', text: 'var(--info)' };
      case 'gray':
        return { bg: '#f1f5f9', text: 'var(--text-muted)' };
      case 'primary':
      default:
        return { bg: 'var(--primary-bg)', text: 'var(--primary-color)' };
    }
  };

  const styles = getStyles();

  return (
    <span className={`badge ${className}`} style={{
      backgroundColor: styles.bg,
      color: styles.text,
      padding: '0.25rem 0.75rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: '600',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem'
    }}>
      {/* Optional dot marker */}
      {variant !== 'gray' && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }}></span>}
      {children}
    </span>
  );
};

export default Badge;
