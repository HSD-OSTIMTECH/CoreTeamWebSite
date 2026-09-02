import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, CheckSquare, FileText, Cpu, Calendar, Settings, LogOut, Plus, X, Bell, User, LifeBuoy, Megaphone } from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          <div className="logo-icon">
            <img src="/icons/huawei-hsd-logo-transparent.png" alt="HSD" className="sidebar-logo-img" />
          </div>
          <div>
            <div className="logo-text">HSD OSTIMTECH</div>
            <div className="logo-subtext">CoreTeam Management</div>
          </div>
        </div>
        <button className="menu-close" onClick={toggleSidebar}>
          <X size={20} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-title">MENÜ</div>
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth < 1024 && toggleSidebar()}>
            <LayoutDashboard size={20} />
            <span>Genel Bakış</span>
          </NavLink>
          
          <NavLink to="/announcements" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth < 1024 && toggleSidebar()}>
            <Megaphone size={20} />
            <span>Duyurular</span>
          </NavLink>

          <NavLink to="/tasks" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth < 1024 && toggleSidebar()}>
            <CheckSquare size={20} />
            <span>Görevlerim</span>
          </NavLink>
          
          <NavLink to="/events" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth < 1024 && toggleSidebar()}>
            <Calendar size={20} />
            <span>Etkinlik & Sponsorluk</span>
          </NavLink>
          
          <NavLink to="/social-media" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth < 1024 && toggleSidebar()}>
            <Cpu size={20} />
            <span>Sosyal Medya</span>
          </NavLink>
          
          <NavLink to="/medium" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth < 1024 && toggleSidebar()}>
            <FileText size={20} />
            <span>Medium</span>
          </NavLink>
          
          <NavLink to="/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth < 1024 && toggleSidebar()}>
            <CheckSquare size={20} />
            <span>Teknoloji & Proje</span>
          </NavLink>
        </div>

        {/* Mobil Özel Bölüm */}
        <div className="nav-section show-mobile-only">
          <div className="nav-section-title">KULLANICI İŞLEMLERİ</div>
          <div className="nav-item" onClick={() => {
            window.dispatchEvent(new Event('open-profile'));
            toggleSidebar();
          }}>
            <User size={20} />
            <span>Profilim</span>
          </div>
          <div className="nav-item" onClick={() => {
            const isDark = document.body.classList.toggle('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            window.dispatchEvent(new Event('storage'));
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            <span>Temayı Değiştir</span>
          </div>
        </div>

        <div className="nav-section" style={{ marginTop: 'auto' }}>
          <NavLink to="/support" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth < 1024 && toggleSidebar()}>
            <LifeBuoy size={20} />
            <span>Destek</span>
          </NavLink>
          <div className="nav-item logout" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Çıkış Yap</span>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Sidebar;
