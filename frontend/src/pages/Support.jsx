import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';

const Support = () => {
  const navigate = useNavigate();

  return (
    <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      {/* Background Content (Blurred out) */}
      <div style={{ textAlign: 'center', opacity: 0.05, pointerEvents: 'none', userSelect: 'none' }}>
        <h1 className="page-title">Destek & Yardım</h1>
        <p className="page-subtitle">Sistem destek birimine ulaşıyorsunuz...</p>
      </div>

      {/* Pop-up Overlay (Şifremi unuttum kısmındaki gibi) */}
      <div style={{ 
        position: 'fixed', 
        inset: 0, 
        zIndex: 9999, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '20px',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        animation: 'supportFadeIn 0.2s ease-out'
      }} onClick={() => navigate('/dashboard')}>
        
        {/* Modal İçeriği */}
        <div style={{ 
          position: 'relative', 
          width: '100%', 
          maxWidth: '440px', 
          backgroundColor: 'var(--surface-color)', 
          borderRadius: '32px', 
          padding: '40px', 
          boxShadow: 'var(--shadow-lg)', 
          border: '1px solid var(--border-color)', 
          textAlign: 'center',
          animation: 'supportScaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          cursor: 'default'
        }} onClick={e => e.stopPropagation()}>
          
          <div style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%', 
            backgroundColor: 'var(--primary-bg)', 
            color: 'var(--primary-color)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 24px',
            boxShadow: '0 10px 20px rgba(15, 118, 110, 0.15)'
          }}>
            <MessageSquare size={40} />
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px' }}>Destek Birimi</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: '1.6', marginBottom: '32px' }}>
            Lütfen destek talepleriniz veya sorularınız için aşağıdaki geliştiricilerimizle iletişime geçin:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px' }}>
            <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontWeight: '700', fontSize: '0.9rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span>Yusuf Türker Albayrak</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: '500' }}>turkeralb@gmail.com</span>
            </div>
            <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontWeight: '700', fontSize: '0.9rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span>Yiğit Arda Kıdıman</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: '500' }}>kidimanyigit@gmail.com</span>
            </div>
            <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontWeight: '700', fontSize: '0.9rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span>Yusuf Tuna Göker</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: '500' }}>yusuftgoker@gmail.com</span>
            </div>
          </div>

          <button 
            onClick={() => navigate('/dashboard')}
            style={{ 
              width: '100%', 
              padding: '16px', 
              backgroundColor: 'var(--primary-color)', 
              color: 'white', 
              borderRadius: '16px', 
              border: 'none', 
              fontWeight: '800', 
              fontSize: '1.1rem',
              cursor: 'pointer',
              boxShadow: '0 10px 20px rgba(15, 118, 110, 0.25)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            Tamam
          </button>
        </div>
      </div>

      <style>{`
        @keyframes supportFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes supportScaleUp {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Support;
