import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { API_BASE_URL } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Lock, User, ChevronRight, Sun, Moon, Eye, EyeOff, AlertCircle } from 'lucide-react';

function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(document.body.classList.contains('dark-mode'));
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const expiredMsg = sessionStorage.getItem('session_expired_message');
    if (expiredMsg) {
      sessionStorage.removeItem('session_expired_message');
      setSessionExpiredNotice(expiredMsg);
    }
  }, []);

  const toggleTheme = () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    setIsDarkMode(isDark);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSessionExpiredNotice(null);

    try {
      // Backend API'sine çağrı yapıyoruz
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      let data = {};
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(
          !response.ok
            ? `Sunucu hatası (${response.status}): Vercel ortam değişkenlerini veya API durumunu kontrol edin.`
            : 'Sunucudan geçersiz yanıt formatı alındı.'
        );
      }

      if (!response.ok) {
        throw new Error(data.error || 'Giriş başarısız');
      }

      if (data.user) {
        login(data.user, data.token);
        navigate('/dashboard');
      } else {
        setError(data.error || 'Giriş bilgileri hatalı.');
      }
      
    } catch (err) {
      setError(err.message || 'Giriş başarısız: Sunucu hatası');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: 'var(--bg-color)',
      backgroundImage: isDarkMode 
        ? 'radial-gradient(at 0% 0%, rgba(20, 184, 166, 0.05) 0, transparent 50%), radial-gradient(at 50% 100%, rgba(15, 118, 110, 0.05) 0, transparent 50%)' 
        : 'radial-gradient(at 0% 0%, rgba(15, 118, 110, 0.1) 0, transparent 50%), radial-gradient(at 50% 100%, rgba(20, 184, 166, 0.1) 0, transparent 50%)',
      padding: '20px',
      position: 'relative',
      transition: 'background-color 0.3s ease'
    }}>
      {/* Theme Toggle Button */}
      <button 
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          top: '2rem',
          right: '2rem',
          background: 'var(--surface-color)',
          border: '1px solid var(--border-color)',
          borderRadius: '50%',
          width: '45px',
          height: '45px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-main)',
          boxShadow: 'var(--shadow-md)',
          transition: 'all 0.2s'
        }}
        title="Temayı Değiştir"
      >
        {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
      </button>

      <div style={{ 
        width: '100%', 
        maxWidth: '440px', 
        backgroundColor: 'var(--surface-color)', 
        backdropFilter: 'blur(20px)',
        borderRadius: '24px', 
        padding: '40px',
        boxShadow: isDarkMode ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : '0 25px 50px -12px rgba(15, 118, 110, 0.15)',
        border: '1px solid var(--border-color)',
        textAlign: 'center',
        transition: 'all 0.3s ease'
      }}>
        {/* Logo / Title Area */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ 
            width: '120px', 
            height: '120px', 
            margin: '0 auto 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img 
              src="/icons/huawei-hsd-logo-transparent.png" 
              alt="HSD Logo" 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'contain',
                filter: isDarkMode ? 'none' : 'invert(1)'
              }} 
            />
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>Hoş Geldiniz</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem' }}>Lütfen devam etmek için kullanıcı adınızla giriş yapın.</p>
        </div>
        
        {sessionExpiredNotice && (
          <div style={{ 
            background: 'rgba(245, 158, 11, 0.1)', 
            color: '#f59e0b', 
            padding: '12px 16px', 
            borderRadius: '12px', 
            marginBottom: '24px', 
            fontSize: '0.875rem',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textAlign: 'left'
          }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: '600' }}>Oturum Bilgisi:</span> {sessionExpiredNotice}
            </div>
          </div>
        )}

        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.05)', 
            color: '#ef4444', 
            padding: '12px 16px', 
            borderRadius: '12px', 
            marginBottom: '24px', 
            fontSize: '0.875rem',
            border: '1px solid rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
             <span style={{ fontWeight: '600' }}>Hata:</span> {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)' }}>Kullanıcı Adı</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <User size={18} />
              </div>
              <input 
                type="text" 
                placeholder="Örn: isim-soyisim"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '12px 16px 12px 48px', 
                  borderRadius: '12px', 
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-color)',
                  color: 'var(--text-main)',
                  fontSize: '0.9375rem',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--primary-color)'; e.target.style.boxShadow = '0 0 0 4px rgba(15, 118, 110, 0.1)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)' }}>Şifre</label>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <Lock size={18} />
              </div>
              <input 
                type={showPassword ? 'text' : 'password'} 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '12px 48px 12px 48px', 
                  borderRadius: '12px', 
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-color)',
                  color: 'var(--text-main)',
                  fontSize: '0.9375rem',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--primary-color)'; e.target.style.boxShadow = '0 0 0 4px rgba(15, 118, 110, 0.1)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                required
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px'
                }}
              >
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            <div style={{ textAlign: 'right', marginTop: '8px' }}>
              <button 
                type="button" 
                onClick={() => setShowForgotModal(true)}
                style={{ background: 'none', border: 'none', fontSize: '0.8125rem', color: 'var(--primary-color)', fontWeight: '500', cursor: 'pointer', padding: 0 }}
              >
                Şifremi Unuttum
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%', 
              backgroundColor: 'var(--primary-color)', 
              color: 'white', 
              padding: '14px', 
              borderRadius: '12px', 
              fontSize: '1rem', 
              fontWeight: '600', 
              cursor: loading ? 'not-allowed' : 'pointer',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'transform 0.1s, background-color 0.2s',
              marginBottom: '24px'
            }}
            onMouseDown={(e) => !loading && (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => !loading && (e.currentTarget.style.transform = 'scale(1)')}
            onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = 'var(--primary-hover)')}
            onMouseOut={(e) => !loading && (e.currentTarget.style.backgroundColor = 'var(--primary-color)')}
          >
            {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            {!loading && <ChevronRight size={18} />}
          </button>
        </form>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowForgotModal(false)}></div>
          <div style={{ position: 'relative', width: '100%', maxWidth: '400px', backgroundColor: 'var(--surface-color)', borderRadius: '24px', padding: '32px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--primary-bg)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Lock size={32} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px' }}>Şifre İşlemleri</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '24px' }}>
              Lütfen şifre sıfırlama işlemleri için geliştiricimizle iletişime geçin:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontWeight: '600', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span>Yiğit Arda Kıdıman</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: '500' }}>yigitardakidiman@gmail.com</span>
              </div>
            </div>
            <button 
              onClick={() => setShowForgotModal(false)}
              style={{ width: '100%', padding: '12px', backgroundColor: 'var(--primary-color)', color: 'white', borderRadius: '12px', border: 'none', fontWeight: '700', cursor: 'pointer' }}
            >
              Tamam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
