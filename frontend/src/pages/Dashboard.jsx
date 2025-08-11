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
  message
} from 'antd';
import { 
  FileTextOutlined, 
  LinkOutlined, 
  MessageOutlined,
  EyeOutlined,
  HeartOutlined,
  CalendarOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [stats, setStats] = useState({
    news: { total: 0, today: 0 },
    feeds: { total: 0, active: 0 },
    dialogues: { total: 0, today: 0 },
    categories: [],
    sources: []
  });

  // 检测是否为移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 获取仪表板统计数据
  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/news/stats/dashboard');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      } else {
        message.error('获取仪表板数据失败');
      }
    } catch (error) {
      console.error('获取仪表板数据失败:', error);
      message.error('获取仪表板数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时获取数据
  useEffect(() => {
    fetchDashboardStats();
  }, []);

  // 计算活跃度百分比
  const getActivityPercentage = () => {
    if (stats.feeds.total === 0) return 0;
    return Math.round((stats.feeds.active / stats.feeds.total) * 100);
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
      <div style={{ padding: isMobile ? '16px' : '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? '16px' : '24px' }}>
      <Title level={isMobile ? 3 : 2}>仪表板</Title>
      
      {/* 主要统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="新闻总数"
              value={formatNumber(stats.news.total)}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">今日新增: {stats.news.today}</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="RSS源"
              value={stats.feeds.total}
              prefix={<LinkOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">活跃: {stats.feeds.active}</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="对话记录"
              value={formatNumber(stats.dialogues.total)}
              prefix={<MessageOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">今日: {stats.dialogues.today}</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃度"
              value={getActivityPercentage()}
              suffix="%"
              prefix={<EyeOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <div style={{ marginTop: 8 }}>
              <Progress 
                percent={getActivityPercentage()} 
                size="small" 
                showInfo={false}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 详细统计 */}
      <Row gutter={[16, 16]}>
        {/* 分类统计 */}
        <Col xs={24} lg={12}>
          <Card title="新闻分类统计" extra={<Tag color="blue">TOP 5</Tag>}>
            <List
              dataSource={stats.categories}
              renderItem={(item, index) => {
                // 为不同分类设置不同颜色
                const categoryColors = {
                  '官媒新闻': 'red',
                  '科技媒体': 'blue',
                  '财经商业': 'green',
                  '国际媒体': 'purple',
                  '自媒体博客': 'orange',
                  '社区论坛': 'cyan',
                  '生活文化': 'pink'
                };
                
                const color = categoryColors[item.name] || 'default';
                
                return (
                  <List.Item>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <div>
                        <Text strong>{index + 1}. {item.name}</Text>
                      </div>
                      <div>
                        <Tag color={color}>{item.count} 篇</Tag>
                      </div>
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

        {/* 来源统计 */}
        <Col xs={24} lg={12}>
          <Card title="新闻来源统计" extra={<Tag color="green">TOP 5</Tag>}>
            <List
              dataSource={stats.sources}
              renderItem={(item, index) => (
                <List.Item>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <div>
                      <Text strong>{index + 1}. {item.name}</Text>
                    </div>
                    <div>
                      <Tag color="green">{item.count} 篇</Tag>
                    </div>
                  </div>
                </List.Item>
              )}
              locale={{
                emptyText: '暂无来源数据'
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 快速操作 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="快速操作">
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Card size="small" hoverable>
                  <div style={{ textAlign: 'center' }}>
                    <CalendarOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                    <div style={{ marginTop: 8 }}>
                      <Text strong>今日新闻</Text>
                    </div>
                    <div>
                      <Text type="secondary">{stats.news.today} 篇新文章</Text>
                    </div>
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small" hoverable>
                  <div style={{ textAlign: 'center' }}>
                    <HeartOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
                    <div style={{ marginTop: 8 }}>
                      <Text strong>活跃RSS源</Text>
                    </div>
                    <div>
                      <Text type="secondary">{stats.feeds.active} 个活跃源</Text>
                    </div>
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small" hoverable>
                  <div style={{ textAlign: 'center' }}>
                    <MessageOutlined style={{ fontSize: 24, color: '#faad14' }} />
                    <div style={{ marginTop: 8 }}>
                      <Text strong>今日对话</Text>
                    </div>
                    <div>
                      <Text type="secondary">{stats.dialogues.today} 次对话</Text>
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard; 