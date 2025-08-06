import React from 'react';
import { Layout, Typography } from 'antd';

const { Header } = Layout;
const { Title } = Typography;

const AppHeader = () => {
  return (
    <Header className="app-header">
      <Title level={3} style={{ color: 'white', margin: 0 }}>
        RSS聚合新闻系统
      </Title>
    </Header>
  );
};

export default AppHeader; 