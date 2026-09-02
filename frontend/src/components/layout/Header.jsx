import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Search, Bell, HelpCircle, User, Menu, X, LogOut, Info, AlertCircle, Sun, Moon } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { API_BASE_URL, getAuthHeaders } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

const Header = ({ toggleSidebar }) => {
  const { user, logout } = useAuth();
  const [rank, setRank] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(document.body.classList.contains('dark-mode'));

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (user) {
      if (user.rank) {
        setRank(user.rank);
      } else if (user.role === 'admin') {
        setRank('Yönetici');
      } else if (user.role === 'editor') {
        setRank('Moderatör');
      } else {
        setRank('Üye');
      }
      fetchNotifications(user.id);
    } else {
      setRank('');
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user]);

  const fetchNotifications = async (userId) => {
    if (!userId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/notifications/${userId}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Bildirimler alınamadı');
      const data = await response.json();
      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (err) {
      console.error('Bildirimler yüklenemedi:', err);
    }
  };

  const markAsRead = async () => {
    if (!user?.id || unreadCount === 0) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/notifications/${user.id}/mark-read`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' })
      });
      if (!response.ok) throw new Error('Bildirimler güncellenemedi');
      setUnreadCount(0);
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Bildirimler işaretlenemedi:', err);
    }
  };

  useEffect(() => {
    // Storage ve Özel Profil eventlerini dinle
    const handleOpenProfile = () => setShowProfileModal(true);
    const handleToggleNotifications = () => {
      setShowNotifications(prev => !prev);
      if (!showNotifications) markAsRead();
    };

    window.addEventListener('open-profile', handleOpenProfile);
    window.addEventListener('toggle-notifications', handleToggleNotifications);

    // Supabase Realtime ile anlık bildirim dinle (0 saniye gecikme)
    let notifChannel;
    let pollInterval;

    if (user?.id) {
      notifChannel = supabase
        .channel(`realtime-notif-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => {
            fetchNotifications(user.id);
          }
        )
        .subscribe();

      // Ağ kesintisi gibi durumlar için sessiz arka plan fallback'i (60s)
      pollInterval = setInterval(() => {
        fetchNotifications(user.id);
      }, 60000);
    }

    return () => {
      window.removeEventListener('open-profile', handleOpenProfile);
      window.removeEventListener('toggle-notifications', handleToggleNotifications);
      if (notifChannel) supabase.removeChannel(notifChannel);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [user?.id]);

  const handleLogout = async () => {
    await logout();
    setShowProfileModal(false);
    navigate('/login');
  };

  const normalizedRank = String(user?.rank || '').toLocaleLowerCase('tr-TR').trim();
  const canSeeAll = ['başkan', 'komite başkanı', 'developer'].includes(normalizedRank);
  const hasRole = (role) => canSeeAll || (user?.roles && user.roles.includes(role));

  return (
    <header className="header">
      <div className="header-left">
        <button className="menu-toggle" onClick={toggleSidebar} aria-label="Menüyü Aç">
          <Menu size={22} />
        </button>
      </div>

      <div className="header-actions" style={{ position: 'relative' }}>
        {rank && (
          <span style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--primary-color)', backgroundColor: 'var(--primary-bg)', padding: '0.25rem 0.6rem', borderRadius: '12px', textTransform: 'uppercase', marginRight: '0.4rem', border: '1px solid rgba(225, 29, 72, 0.15)' }}>
            {rank}
          </span>
        )}
        <button 
          className="btn-icon-only" 
          onClick={() => {
            const isDark = document.body.classList.toggle('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            setIsDarkMode(isDark);
            window.dispatchEvent(new Event('storage'));
          }}
          title={isDarkMode ? "Açık Mod'a Geç" : "Koyu Mod'a Geç"}
          style={{ marginRight: '0.2rem' }}
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button 
          className="btn-icon-only" 
          title="Bildirimler" 
          style={{ marginRight: '0.2rem', position: 'relative' }}
          onClick={() => {
            setShowNotifications(!showNotifications);
            if (!showNotifications) markAsRead();
          }}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '5px',
              right: '5px',
              width: '8px',
              height: '8px',
              backgroundColor: 'var(--primary-color)',
              borderRadius: '50%',
              border: '2px solid var(--surface-color)'
            }}></span>
          )}
        </button>

        {/* Notificatons Dropdown */}
        {showNotifications && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            marginTop: '10px',
            width: '320px',
            background: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            overflow: 'hidden',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-main)' }}>Bildirimler</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {notifications.length > 0 && (
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.confirm('Tüm bildirimler silinecek. Emin misiniz?')) {
                        await supabase.from('notifications').delete().eq('user_id', user.id);
                        setNotifications([]);
                        setUnreadCount(0);
                      }
                    }}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Tümünü Temizle
                  </button>
                )}
                {unreadCount > 0 && <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--primary-bg)', color: 'var(--primary-color)', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>{unreadCount} Yeni</span>}
              </div>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div key={notif.id} style={{ 
                    padding: '12px 16px', 
                    borderBottom: '1px solid var(--border-color)', 
                    backgroundColor: notif.is_read ? 'transparent' : 'rgba(15, 118, 110, 0.03)',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }} className="notification-item">
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: notif.is_read ? '400' : '600', marginBottom: '4px' }}>{notif.message}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(notif.created_at).toLocaleDateString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ marginBottom: '12px', color: 'var(--text-muted)' }}>
                    <Bell size={32} strokeWidth={1.5} style={{ opacity: 0.3 }} />
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600' }}>Henüz bildirim yok</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Yeni bir güncelleme olduğunda burada göreceksiniz.</div>
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="user-profile" onClick={() => setShowProfileModal(true)} title={user?.username || user?.email || 'Kullanıcı'}>
          <div className="avatar" style={{ border: '2px solid var(--primary-color)', cursor: 'pointer' }}>
            {user ? (
              <img src={`https://ui-avatars.com/api/?name=${user.username || user.email}&background=0D8ABC&color=fff`} alt="User Avatar" />
            ) : (
              <div style={{ backgroundColor: 'var(--border-color)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={18} color="var(--text-muted)" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profil Detay Modal */}
      {showProfileModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShowProfileModal(false)}></div>
          <div style={{ position: 'relative', width: '90%', maxWidth: '400px', backgroundColor: 'var(--surface-color)', borderRadius: '24px', padding: '2rem', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => setShowProfileModal(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={24} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', margin: '0 auto 1.5rem', border: '4px solid var(--primary-bg)', overflow: 'hidden' }}>
                <img src={`https://ui-avatars.com/api/?name=${user?.username || user?.email}&background=0D8ABC&color=fff&size=200`} style={{ width: '100%', height: '100%' }} alt="Profile" />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{user?.username || 'Kullanıcı'}</h2>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--primary-color)', backgroundColor: 'var(--primary-bg)', padding: '0.35rem 1rem', borderRadius: '1rem', textTransform: 'uppercase' }}>
                {user?.rank || 'Üye'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Yetkili Olduğu Alanlar</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {user?.roles?.length > 0 ? (
                    user.roles.map((role, idx) => (
                      <span key={idx} style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', border: '1px solid var(--border-color)' }}>
                        {role}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tanımlı rol bulunmuyor.</span>
                  )}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  <Menu size={16} /> <span style={{ fontFamily: 'monospace' }}>ID: {user?.id?.substring(0, 18)}...</span>
                </div>
                <button 
                  onClick={handleLogout}
                  style={{ width: '100%', padding: '0.75rem', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <LogOut size={18} /> Oturumu Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
