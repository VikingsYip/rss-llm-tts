import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import AppHeader from './components/AppHeader';
import AppSider from './components/AppSider';
import Dashboard from './pages/Dashboard';
import NewsList from './pages/NewsList';
import NewsDetail from './pages/NewsDetail';
import RssFeeds from './pages/RssFeeds';
import Dialogues from './pages/Dialogues';
import DialogueDetail from './pages/DialogueDetail';
import Settings from './pages/Settings';
import CategoryStats from './pages/CategoryStats';
import './App.css';

const { Content } = Layout;

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 检测是否为移动设备
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // 在移动端默认折叠侧边栏
      if (mobile) {
        setCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  const closeMobileMenu = () => {
    if (isMobile) {
      setCollapsed(true);
    }
  };

  return (
    <Layout className="app-container">
      <AppHeader collapsed={collapsed} onToggle={toggleCollapsed} />
      <Layout style={{ marginTop: 64 }}> {/* 为固定header留出空间 */}
        <AppSider 
          collapsed={collapsed} 
          isMobile={isMobile} 
          onClose={closeMobileMenu}
        />
        <Layout 
          className="main-layout" 
          style={{ 
            marginLeft: isMobile ? 0 : (collapsed ? 80 : 200),
            transition: 'margin-left 0.2s'
          }}
        >
          <Content className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/news" element={<NewsList />} />
              <Route path="/news/:id" element={<NewsDetail />} />
              <Route path="/feeds" element={<RssFeeds />} />
              <Route path="/dialogues" element={<Dialogues />} />
              <Route path="/dialogues/:id" element={<DialogueDetail />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/category-stats" element={<CategoryStats />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App; 