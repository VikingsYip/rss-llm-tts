import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Typography, 
  Spin, 
  Button, 
  Space, 
  Tag, 
  Divider, 
  message,
  Tooltip,
  Breadcrumb
} from 'antd';
import { 
  ArrowLeftOutlined, 
  HeartOutlined, 
  HeartFilled,
  StarOutlined,
  StarFilled,
  EyeOutlined,
  EyeInvisibleOutlined,
  LinkOutlined,
  CalendarOutlined,
  UserOutlined,
  TagOutlined
} from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

const NewsDetail = () => {
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // 获取新闻详情
  const fetchNewsDetail = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/news/${id}`);
      const data = await response.json();
      
      if (data.success) {
        setNews(data.data);
      } else {
        message.error('获取新闻详情失败');
        navigate('/news');
      }
    } catch (error) {
      console.error('获取新闻详情失败:', error);
      message.error('获取新闻详情失败');
      navigate('/news');
    } finally {
      setLoading(false);
    }
  };

  // 更新新闻状态
  const updateNewsStatus = async (statusType, value) => {
    try {
      const response = await fetch(`/api/news/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [statusType]: value }),
      });

      const data = await response.json();
      
      if (data.success) {
        // 更新本地状态
        setNews(prev => ({ ...prev, [statusType]: value }));
        
        const statusText = {
          isRead: value ? '已读' : '未读',
          isFavorite: value ? '收藏' : '取消收藏',
          isIgnored: value ? '忽略' : '取消忽略'
        };
        
        message.success(`${statusText[statusType]}成功`);
      } else {
        message.error('操作失败');
      }
    } catch (error) {
      console.error('更新新闻状态失败:', error);
      message.error('操作失败');
    }
  };

  // 返回新闻列表（保持URL参数）
  const handleBackToList = () => {
    // 从当前URL中提取查询参数
    const searchParams = new URLSearchParams(location.search);
    const queryString = searchParams.toString();
    const backUrl = queryString ? `/news?${queryString}` : '/news';
    navigate(backUrl);
  };

  // 格式化时间
  const formatTime = (time) => {
    if (!time) return '未知时间';
    const date = new Date(time);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 组件加载时获取数据
  useEffect(() => {
    if (id) {
      fetchNewsDetail();
    }
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!news) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <Title level={2}>新闻不存在</Title>
          <Button type="primary" onClick={handleBackToList}>
            返回新闻列表
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 面包屑导航 */}
      <Breadcrumb style={{ marginBottom: 16 }}>
        <Breadcrumb.Item>
          <a onClick={handleBackToList}>新闻列表</a>
        </Breadcrumb.Item>
        <Breadcrumb.Item>新闻详情</Breadcrumb.Item>
      </Breadcrumb>

      <Card>
        {/* 操作按钮 */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={handleBackToList}
          >
            返回列表
          </Button>
          
          <Space>
            <Tooltip title={news.isRead ? '标记为未读' : '标记为已读'}>
              <Button
                icon={news.isRead ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                onClick={() => updateNewsStatus('isRead', !news.isRead)}
              >
                {news.isRead ? '已读' : '未读'}
              </Button>
            </Tooltip>
            
            <Tooltip title={news.isFavorite ? '取消收藏' : '收藏'}>
              <Button
                icon={news.isFavorite ? <HeartFilled style={{ color: '#ff4d4f' }} /> : <HeartOutlined />}
                onClick={() => updateNewsStatus('isFavorite', !news.isFavorite)}
              >
                {news.isFavorite ? '已收藏' : '收藏'}
              </Button>
            </Tooltip>
            
            <Tooltip title={news.isIgnored ? '取消忽略' : '忽略'}>
              <Button
                icon={news.isIgnored ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                onClick={() => updateNewsStatus('isIgnored', !news.isIgnored)}
              >
                {news.isIgnored ? '已忽略' : '忽略'}
              </Button>
            </Tooltip>
            
            {news.link && (
              <Tooltip title="查看原文">
                <Button 
                  icon={<LinkOutlined />}
                  onClick={() => window.open(news.link, '_blank')}
                >
                  原文
                </Button>
              </Tooltip>
            )}
          </Space>
        </div>

        <Divider />

        {/* 新闻标题 */}
        <Title level={1} style={{ marginBottom: 16 }}>
          {news.title}
        </Title>

        {/* 新闻元信息 */}
        <div style={{ marginBottom: 24 }}>
          <Space wrap>
            <Space>
              <CalendarOutlined />
              <Text type="secondary">{formatTime(news.publishedAt)}</Text>
            </Space>
            
            {news.author && (
              <Space>
                <UserOutlined />
                <Text type="secondary">{news.author}</Text>
              </Space>
            )}
            
            <Space>
              <TagOutlined />
              <Tag color="blue">{news.category || '其他'}</Tag>
            </Space>
            
            <Tag color="green">{news.sourceName}</Tag>
            
            {news.rssFeed && (
              <Tag color="orange">{news.rssFeed.name}</Tag>
            )}
          </Space>
        </div>

        <Divider />

        {/* 新闻摘要 */}
        {news.summary && (
          <div style={{ marginBottom: 24 }}>
            <Title level={4}>摘要</Title>
            <Paragraph style={{ fontSize: '16px', color: '#666' }}>
              {news.summary}
            </Paragraph>
          </div>
        )}

        {/* 新闻内容 */}
        <div>
          <Title level={4}>正文</Title>
          <div 
            style={{ 
              fontSize: '16px', 
              lineHeight: '1.8',
              color: '#333'
            }}
            dangerouslySetInnerHTML={{ 
              __html: news.content || news.summary || '暂无内容' 
            }}
          />
        </div>

        {/* 原文链接 */}
        {news.link && (
          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <Button 
              type="primary" 
              size="large"
              icon={<LinkOutlined />}
              onClick={() => window.open(news.link, '_blank')}
            >
              查看原文
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default NewsDetail; 