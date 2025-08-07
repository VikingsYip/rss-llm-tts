import React from 'react';
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
  return (
    <Layout className="app-container">
      <AppHeader />
      <Layout>
        <AppSider />
        <Layout className="main-layout">
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