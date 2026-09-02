import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, CheckSquare, FileText, Cpu, Calendar, 
  LogOut, X, User, LifeBuoy, Megaphone, 
  PanelLeftClose, PanelLeftOpen 
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ isOpen, toggleSidebar, isCollapsed = false, toggleCollapse }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-content">
          <div className="logo-icon">
            <img src="/icons/huawei-hsd-logo-transparent.png" alt="HSD" className="sidebar-logo-img" />
          </div>
          {!isCollapsed && (
            <div className="logo-text-wrap">
              <div className="logo-text">HSD OSTIMTECH</div>
              <div className="logo-subtext">CoreTeam Management</div>
            </div>
          )}
        </div>

        {/* Masaüstü Menü Daraltma / Genişletme Butonu */}
        <button 
          className="collapse-btn" 
          onClick={toggleCollapse} 
          title={isCollapsed ? "Menüyü Genişlet" : "Menüyü Daralt"}
          aria-label={isCollapsed ? "Genişlet" : "Daralt"}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        {/* Mobil Kapatma Butonu */}
        <button className="menu-close" onClick={toggleSidebar}>
          <X size={20} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          {!isCollapsed && <div className="nav-section-title">MENÜ</div>}
          
          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} 
            onClick={() => window.innerWidth < 1024 && toggleSidebar()}
            data-title="Genel Bakış"
            title={isCollapsed ? "Genel Bakış" : undefined}
          >
            <LayoutDashboard size={20} />
            <span>Genel Bakış</span>
          </NavLink>
          
          <NavLink 
            to="/announcements" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} 
            onClick={() => window.innerWidth < 1024 && toggleSidebar()}
            data-title="Duyurular"
            title={isCollapsed ? "Duyurular" : undefined}
          >
            <Megaphone size={20} />
            <span>Duyurular</span>
          </NavLink>

          <NavLink 
            to="/tasks" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} 
            onClick={() => window.innerWidth < 1024 && toggleSidebar()}
            data-title="Görevlerim"
            title={isCollapsed ? "Görevlerim" : undefined}
          >
            <CheckSquare size={20} />
            <span>Görevlerim</span>
          </NavLink>
          
          <NavLink 
            to="/events" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} 
            onClick={() => window.innerWidth < 1024 && toggleSidebar()}
            data-title="Etkinlik & Sponsorluk"
            title={isCollapsed ? "Etkinlik & Sponsorluk" : undefined}
          >
            <Calendar size={20} />
            <span>Etkinlik & Sponsorluk</span>
          </NavLink>
          
          <NavLink 
            to="/social-media" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} 
            onClick={() => window.innerWidth < 1024 && toggleSidebar()}
            data-title="Sosyal Medya"
            title={isCollapsed ? "Sosyal Medya" : undefined}
          >
            <Cpu size={20} />
            <span>Sosyal Medya</span>
          </NavLink>
          
          <NavLink 
            to="/medium" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} 
            onClick={() => window.innerWidth < 1024 && toggleSidebar()}
            data-title="Medium"
            title={isCollapsed ? "Medium" : undefined}
          >
            <FileText size={20} />
            <span>Medium</span>
          </NavLink>
          
          <NavLink 
            to="/projects" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} 
            onClick={() => window.innerWidth < 1024 && toggleSidebar()}
            data-title="Teknoloji & Proje"
            title={isCollapsed ? "Teknoloji & Proje" : undefined}
          >
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
          <NavLink 
            to="/support" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} 
            onClick={() => window.innerWidth < 1024 && toggleSidebar()}
            data-title="Destek"
            title={isCollapsed ? "Destek" : undefined}
          >
            <LifeBuoy size={20} />
            <span>Destek</span>
          </NavLink>
          
          <div 
            className="nav-item logout" 
            onClick={handleLogout}
            data-title="Çıkış Yap"
            title={isCollapsed ? "Çıkış Yap" : undefined}
          >
            <LogOut size={20} />
            <span>Çıkış Yap</span>
          </div>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
