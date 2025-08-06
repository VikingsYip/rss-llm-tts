import React, { useState, useEffect } from 'react';
import { 
  List, 
  Card, 
  Typography, 
  Input, 
  Select, 
  Button, 
  Space, 
  Tag, 
  Pagination, 
  Spin, 
  Empty, 
  Tooltip,
  message,
  Row,
  Col,
  Statistic
} from 'antd';
import { 
  FilterOutlined, 
  EyeOutlined, 
  HeartOutlined, 
  HeartFilled,
  StarOutlined,
  StarFilled,
  EyeInvisibleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

const NewsList = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, unread: 0, favorite: 0 });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    keyword: '',
    category: '',
    source: '',
    isRead: '',
    isFavorite: '',
    isIgnored: ''
  });
  const [categories, setCategories] = useState([]);
  const [sources, setSources] = useState([]);
  
  const navigate = useNavigate();

  // 获取新闻列表
  const fetchNews = async (page = 1, filters = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.pageSize.toString(),
        ...filters
      });

      const response = await fetch(`/api/news?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setNews(data.data.news);
        setPagination(prev => ({
          ...prev,
          current: data.data.pagination.page,
          total: data.data.pagination.total
        }));
      } else {
        message.error('获取新闻列表失败');
      }
    } catch (error) {
      console.error('获取新闻列表失败:', error);
      message.error('获取新闻列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取新闻统计
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/news/stats/overview');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('获取新闻统计失败:', error);
    }
  };

  // 获取分类和来源列表
  const fetchFilters = async () => {
    try {
      // 获取RSS源列表来提取分类和来源
      const response = await fetch('/api/rss/feeds');
      const data = await response.json();
      
      if (data.success) {
        const feeds = data.data;
        const categories = [...new Set(feeds.map(feed => feed.category).filter(Boolean))];
        const sources = [...new Set(feeds.map(feed => feed.name).filter(Boolean))];
        
        setCategories(categories);
        setSources(sources);
      }
    } catch (error) {
      console.error('获取筛选选项失败:', error);
    }
  };

  // 更新新闻状态
  const updateNewsStatus = async (newsId, statusType, value) => {
    try {
      const response = await fetch(`/api/news/${newsId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [statusType]: value }),
      });

      const data = await response.json();
      
      if (data.success) {
        // 更新本地状态
        setNews(prev => prev.map(item => 
          item.id === newsId ? { ...item, [statusType]: value } : item
        ));
        
        // 刷新统计
        fetchStats();
        
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

  // 处理搜索
  const handleSearch = (value) => {
    const newFilters = { ...filters, keyword: value };
    setFilters(newFilters);
    fetchNews(1, newFilters);
  };

  // 处理筛选
  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    fetchNews(1, newFilters);
  };

  // 处理分页
  const handlePageChange = (page) => {
    fetchNews(page, filters);
  };

  // 重置筛选
  const handleResetFilters = () => {
    const newFilters = {
      keyword: '',
      category: '',
      source: '',
      isRead: '',
      isFavorite: '',
      isIgnored: ''
    };
    setFilters(newFilters);
    fetchNews(1, newFilters);
  };

  // 组件加载时获取数据
  useEffect(() => {
    fetchNews();
    fetchStats();
    fetchFilters();
  }, []);

  // 格式化时间
  const formatTime = (time) => {
    if (!time) return '未知时间';
    const date = new Date(time);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    
    return date.toLocaleDateString();
  };

  // 截取摘要
  const truncateSummary = (text, maxLength = 150) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>新闻列表</Title>
      
      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总新闻数" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="未读新闻" value={stats.unread} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="收藏新闻" value={stats.favorite} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="今日新增" value={news.filter(item => {
              const today = new Date();
              const newsDate = new Date(item.publishedAt);
              return today.toDateString() === newsDate.toDateString();
            }).length} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
      </Row>

      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Search
              placeholder="搜索新闻标题或内容"
              allowClear
              style={{ width: 300 }}
              onSearch={handleSearch}
              defaultValue={filters.keyword}
            />
            
            <Select
              placeholder="选择分类"
              allowClear
              style={{ width: 120 }}
              onChange={(value) => handleFilterChange('category', value)}
              value={filters.category}
            >
              {categories.map(category => (
                <Option key={category} value={category}>{category}</Option>
              ))}
            </Select>
            
            <Select
              placeholder="选择来源"
              allowClear
              style={{ width: 150 }}
              onChange={(value) => handleFilterChange('source', value)}
              value={filters.source}
            >
              {sources.map(source => (
                <Option key={source} value={source}>{source}</Option>
              ))}
            </Select>
            
            <Select
              placeholder="阅读状态"
              allowClear
              style={{ width: 100 }}
              onChange={(value) => handleFilterChange('isRead', value)}
              value={filters.isRead}
            >
              <Option value="false">未读</Option>
              <Option value="true">已读</Option>
            </Select>
            
            <Select
              placeholder="收藏状态"
              allowClear
              style={{ width: 100 }}
              onChange={(value) => handleFilterChange('isFavorite', value)}
              value={filters.isFavorite}
            >
              <Option value="true">已收藏</Option>
              <Option value="false">未收藏</Option>
            </Select>
          </Space>
          
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => fetchNews(pagination.current, filters)}
            >
              刷新
            </Button>
            <Button 
              icon={<FilterOutlined />} 
              onClick={handleResetFilters}
            >
              重置筛选
            </Button>
          </Space>
        </Space>
      </Card>

      {/* 新闻列表 */}
      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
          </div>
        ) : news.length === 0 ? (
          <Empty description="暂无新闻数据" />
        ) : (
          <>
            <List
              grid={{ gutter: 16, column: 1 }}
              dataSource={news}
              renderItem={(item) => (
                <List.Item>
                  <Card 
                    hoverable
                    style={{ 
                      opacity: item.isIgnored ? 0.6 : 1,
                      borderLeft: item.isRead ? '4px solid #d9d9d9' : '4px solid #1890ff'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ marginBottom: 8 }}>
                          <Space>
                            <Text 
                              strong 
                              style={{ 
                                fontSize: '16px',
                                color: item.isRead ? '#666' : '#000',
                                cursor: 'pointer'
                              }}
                              onClick={() => navigate(`/news/${item.id}`)}
                            >
                              {item.title}
                            </Text>
                            {item.isFavorite && <HeartFilled style={{ color: '#ff4d4f' }} />}
                            {item.isIgnored && <EyeInvisibleOutlined style={{ color: '#999' }} />}
                          </Space>
                        </div>
                        
                        <div style={{ marginBottom: 8 }}>
                          <Text type="secondary">
                            {truncateSummary(item.summary)}
                          </Text>
                        </div>
                        
                        <div style={{ marginBottom: 8 }}>
                          <Space>
                            <Tag color="blue">{item.category || '其他'}</Tag>
                            <Tag color="green">{item.sourceName}</Tag>
                            {item.author && <Tag color="orange">{item.author}</Tag>}
                          </Space>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {formatTime(item.publishedAt)}
                          </Text>
                          
                          <Space>
                            <Tooltip title={item.isRead ? '标记为未读' : '标记为已读'}>
                              <Button
                                type="text"
                                size="small"
                                icon={item.isRead ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                                onClick={() => updateNewsStatus(item.id, 'isRead', !item.isRead)}
                              />
                            </Tooltip>
                            
                            <Tooltip title={item.isFavorite ? '取消收藏' : '收藏'}>
                              <Button
                                type="text"
                                size="small"
                                icon={item.isFavorite ? <HeartFilled style={{ color: '#ff4d4f' }} /> : <HeartOutlined />}
                                onClick={() => updateNewsStatus(item.id, 'isFavorite', !item.isFavorite)}
                              />
                            </Tooltip>
                            
                            <Tooltip title={item.isIgnored ? '取消忽略' : '忽略'}>
                              <Button
                                type="text"
                                size="small"
                                icon={item.isIgnored ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                                onClick={() => updateNewsStatus(item.id, 'isIgnored', !item.isIgnored)}
                              />
                            </Tooltip>
                          </Space>
                        </div>
                      </div>
                    </div>
                  </Card>
                </List.Item>
              )}
            />
            
            {/* 分页 */}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Pagination
                current={pagination.current}
                pageSize={pagination.pageSize}
                total={pagination.total}
                onChange={handlePageChange}
                showSizeChanger={false}
                showQuickJumper
                showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条新闻`}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default NewsList; 