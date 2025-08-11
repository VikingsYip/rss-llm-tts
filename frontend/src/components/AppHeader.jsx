import React from 'react';
import { Layout, Typography, Button } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';

const { Header } = Layout;
const { Title } = Typography;

const AppHeader = ({ collapsed, onToggle }) => {
  return (
    <Header className="app-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggle}
          style={{
            fontSize: '16px',
            width: 64,
            height: 64,
            color: 'white',
            marginRight: 16
          }}
        />
        <Title level={3} style={{ color: 'white', margin: 0 }}>
          RSS聚合新闻系统
        </Title>
      </div>
    </Header>
  );
};

export default AppHeader; 