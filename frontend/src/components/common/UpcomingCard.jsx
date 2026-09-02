import React from 'react';

const UpcomingCard = ({ month, day, dayBg, title, desc, timeTag }) => (
  <div 
    className="flex items-center gap-4" 
    style={{ 
      backgroundColor: 'var(--surface-color)', 
      padding: '1rem', 
      borderRadius: '1rem', 
      border: '1px solid var(--border-color)', 
      marginBottom: '1rem' 
    }}
  >
    <div 
      style={{ 
        backgroundColor: dayBg || 'var(--bg-color)', 
        borderRadius: '0.5rem', 
        padding: '0.5rem 0.2rem', 
        minWidth: '45px', 
        textAlign: 'center', 
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)' 
      }}
    >
      <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--primary-color)', marginBottom: '0.1rem' }}>
        {month}
      </div>
      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>
        {day}
      </div>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {desc}
      </div>
      <div style={{ display: 'inline-block', backgroundColor: 'var(--primary-bg)', color: 'var(--primary-color)', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '700' }}>
        {timeTag}
      </div>
    </div>
  </div>
);

export default UpcomingCard;
