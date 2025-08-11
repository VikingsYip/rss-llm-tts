import React from 'react';
import { Layout, Menu, Drawer } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  FileTextOutlined,
  LinkOutlined,
  MessageOutlined,
  SettingOutlined,
  BarChartOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

const AppSider = ({ collapsed, isMobile, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '仪表板',
    },
    {
      key: '/news',
      icon: <FileTextOutlined />,
      label: '新闻列表',
    },
    {
      key: '/feeds',
      icon: <LinkOutlined />,
      label: 'RSS源管理',
    },
    {
      key: '/category-stats',
      icon: <BarChartOutlined />,
      label: '分类统计',
    },
    {
      key: '/dialogues',
      icon: <MessageOutlined />,
      label: '对话记录',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '设置',
    },
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
    // 在移动端点击菜单后关闭抽屉
    if (isMobile && onClose) {
      onClose();
    }
  };

  // 移动端使用抽屉
  if (isMobile) {
    return (
      <Drawer
        title="菜单"
        placement="left"
        onClose={onClose}
        open={!collapsed}
        width={250}
        bodyStyle={{ padding: 0 }}
      >
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          style={{ height: '100%', borderRight: 0 }}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Drawer>
    );
  }

  // 桌面端使用侧边栏
  return (
    <Sider 
      width={200} 
      className="app-sider"
      collapsed={collapsed}
      collapsedWidth={80}
      trigger={null}
      breakpoint="lg"
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 1000,
      }}
    >
      <div style={{ height: 64 }} /> {/* 为header留出空间 */}
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        style={{ height: 'calc(100% - 64px)', borderRight: 0 }}
        items={menuItems}
        onClick={handleMenuClick}
        inlineCollapsed={collapsed}
      />
    </Sider>
  );
};

export default AppSider; 