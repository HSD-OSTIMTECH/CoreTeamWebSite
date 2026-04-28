import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import './MainLayout.css';

const MainLayout = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

  return (
    <div className={`main-layout ${isSidebarOpen ? 'sidebar-open' : ''}`}>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={toggleSidebar}></div>
      )}
      
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      
      <div className="layout-content">
        <Header toggleSidebar={toggleSidebar} />
        <main className="main-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
