import React from 'react';

const Card = ({ children, title, subtitle, action, className = '' }) => {
  return (
    <div className={`card ${className}`} style={{
      backgroundColor: 'var(--surface-color)',
      borderRadius: '1rem',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-sm)',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {(title || subtitle || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            {title && <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: subtitle ? '0.25rem' : '0' }}>{title}</h3>}
            {subtitle && <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div style={{ flex: 1 }}>
        {children}
      </div>
    </div>
  );
};

export default Card;
