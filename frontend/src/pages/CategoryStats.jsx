import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Spin, 
  Progress, 
  List, 
  Tag,
  Typography,
  message,
  Button,
  Space
} from 'antd';
import { 
  FileTextOutlined, 
  ReloadOutlined,
  BarChartOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const CategoryStats = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([]);
  const [totalNews, setTotalNews] = useState(0);

  // 分类颜色映射
  const categoryColors = {
    '官媒新闻': 'red',
    '科技媒体': 'blue',
    '财经商业': 'green',
    '国际媒体': 'purple',
    '自媒体博客': 'orange',
    '社区论坛': 'cyan',
    '生活文化': 'pink'
  };

  // 获取分类统计数据
  const fetchCategoryStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/news/stats/categories');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
        // 计算总新闻数
        const total = data.data.reduce((sum, item) => sum + item.count, 0);
        setTotalNews(total);
      } else {
        message.error('获取分类统计数据失败');
      }
    } catch (error) {
      console.error('获取分类统计数据失败:', error);
      message.error('获取分类统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时获取数据
  useEffect(() => {
    fetchCategoryStats();
  }, []);

  // 计算百分比
  const calculatePercentage = (count) => {
    if (totalNews === 0) return 0;
    return Math.round((count / totalNews) * 100);
  };

  // 格式化数字
  const formatNumber = (num) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          新闻分类统计
        </Title>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={fetchCategoryStats}
          loading={loading}
        >
          刷新数据
        </Button>
      </div>
      
      {/* 总体统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="新闻总数"
              value={formatNumber(totalNews)}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="分类数量"
              value={stats.length}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="平均每类"
              value={totalNews > 0 ? Math.round(totalNews / stats.length) : 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 分类详细统计 */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="分类详细统计">
            <List
              dataSource={stats}
              renderItem={(item, index) => {
                const percentage = calculatePercentage(item.count);
                const color = categoryColors[item.name] || 'default';
                
                return (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <Tag color={color} style={{ marginRight: 8, minWidth: 80, textAlign: 'center' }}>
                            {item.name}
                          </Tag>
                          <Text strong>{formatNumber(item.count)} 篇</Text>
                        </div>
                        <div>
                          <Text type="secondary">{percentage}%</Text>
                        </div>
                      </div>
                      <Progress 
                        percent={percentage} 
                        strokeColor={color === 'default' ? '#1890ff' : undefined}
                        showInfo={false}
                        size="small"
                      />
                    </div>
                  </List.Item>
                );
              }}
              locale={{
                emptyText: '暂无分类数据'
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 分类分布图表 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="分类分布">
            <Row gutter={[16, 16]}>
              {stats.map((item) => {
                const percentage = calculatePercentage(item.count);
                const color = categoryColors[item.name] || 'default';
                
                return (
                  <Col xs={24} sm={12} lg={8} xl={6} key={item.name}>
                    <Card size="small" hoverable>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ marginBottom: 8 }}>
                          <Tag color={color} style={{ fontSize: '14px', padding: '4px 12px' }}>
                            {item.name}
                          </Tag>
                        </div>
                        <div style={{ marginBottom: 4 }}>
                          <Text strong style={{ fontSize: '18px' }}>
                            {formatNumber(item.count)}
                          </Text>
                        </div>
                        <div>
                          <Text type="secondary">占比 {percentage}%</Text>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <Progress 
                            percent={percentage} 
                            strokeColor={color === 'default' ? '#1890ff' : undefined}
                            showInfo={false}
                            size="small"
                          />
                        </div>
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CategoryStats; 