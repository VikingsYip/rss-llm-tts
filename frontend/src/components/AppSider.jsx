import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  FileTextOutlined,
  LinkOutlined,
  MessageOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

const AppSider = () => {
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

  return (
    <Sider width={200} className="app-sider">
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        style={{ height: '100%', borderRight: 0 }}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
      />
    </Sider>
  );
};

export default AppSider; 