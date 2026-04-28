import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import SocialMedia from './pages/SocialMedia';
import MyTasks from './pages/MyTasks';
import MediumPanel from './pages/MediumPanel';
import Projects from './pages/Projects';
import Support from './pages/Support';
import Events from './pages/Events';
import Login from './pages/Login';
import Announcements from './pages/Announcements';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      // Önce standart Supabase Auth'u kontrol et
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      // Eğer standart auth yoksa localStorage'daki özel kullanıcıyı kontrol et
      const customUser = localStorage.getItem('custom_user');
      
      if (authSession) {
        setSession(authSession);
      } else if (customUser) {
        // Özel kullanıcı varsa mock bir session objesi oluşturuyoruz
        setSession({ user: JSON.parse(customUser), isCustom: true });
      } else {
        setSession(null);
      }
      setLoading(false);
    };

    checkSession();

    // Standart auth değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
      } else {
        // Standart session yoksa özel tabloyu tekrar kontrol et
        const customUser = localStorage.getItem('custom_user');
        setSession(customUser ? { user: JSON.parse(customUser), isCustom: true } : null);
      }
    });

    // Manuel login/logout eventlerini dinle (localStorage güncellendiğinde)
    const handleStorageChange = () => {
      const customUser = localStorage.getItem('custom_user');
      if (customUser) {
        setSession({ user: JSON.parse(customUser), isCustom: true });
      } else {
        checkSession();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }}>Yükleniyor...</div>;
  }

  const user = session?.user;
  const normalizedRank = String(user?.rank || '').toLocaleLowerCase('tr-TR').trim();
  const canSeeAll = ['başkan', 'komite başkanı', 'developer'].includes(normalizedRank);
  const hasRole = (role) => canSeeAll || (user?.roles && user.roles.includes(role));

  return (
    <Routes>
      <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" replace />} />
      
      <Route path="/" element={session ? <MainLayout /> : <Navigate to="/login" replace />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        
        {/* Komite Sayfaları - Görüntüleme Herkese Açık, Düzenleme Yetkiye Bağlı */}
        <Route 
          path="events" 
          element={<Events canEdit={hasRole('etkinlik')} />} 
        />
        <Route 
          path="social-media" 
          element={<SocialMedia canEdit={hasRole('sosyal')} />} 
        />
        <Route 
          path="medium" 
          element={<MediumPanel canEdit={hasRole('medium')} />} 
        />
        <Route 
          path="projects" 
          element={<Projects canEdit={hasRole('proje')} />} 
        />

        <Route path="tasks" element={<MyTasks />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="support" element={<Support />} />
        <Route path="reports" element={<div className="page-container"><h2>Raporlar (Yapım Aşamasında)</h2></div>} />
        <Route path="settings" element={<div className="page-container"><h2>Ayarlar (Yapım Aşamasında)</h2></div>} />
      </Route>

      {/* Herhangi bir rotaya uymayanları ana sayfaya yönlendir */}
      <Route path="*" element={<Navigate to={session ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}

export default App;
