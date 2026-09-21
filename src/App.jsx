import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
import UserManagement from './pages/UserManagement';
import { useAuth } from './context/AuthContext';
import { canManageCommittee, canManageUsers } from './lib/roles';

function App() {
  const { user, session, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }}>
        Yükleniyor...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" replace />} />
      
      <Route path="/" element={session ? <MainLayout /> : <Navigate to="/login" replace />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        
        {/* Komite Sayfaları - Görüntüleme Herkese Açık, Düzenleme Yetkiye Bağlı */}
        <Route 
          path="events" 
          element={<Events canEdit={canManageCommittee(user, 'etkinlik')} />} 
        />
        <Route 
          path="social-media" 
          element={<SocialMedia canEdit={canManageCommittee(user, 'sosyal')} />} 
        />
        <Route 
          path="medium" 
          element={<MediumPanel canEdit={canManageCommittee(user, 'medium')} />} 
        />
        <Route 
          path="projects" 
          element={<Projects canEdit={canManageCommittee(user, 'proje')} />} 
        />

        <Route path="tasks" element={<MyTasks />} />
        <Route path="announcements" element={<Announcements />} />
        <Route 
          path="users" 
          element={canManageUsers(user) ? <UserManagement /> : <Navigate to="/dashboard" replace />} 
        />
        <Route path="register" element={<Navigate to="/users" replace />} />
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
