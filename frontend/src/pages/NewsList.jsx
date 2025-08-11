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
  Statistic,
  Drawer,
  Form
} from 'antd';
import { 
  FilterOutlined, 
  EyeOutlined, 
  HeartOutlined, 
  HeartFilled,
  StarOutlined,
  StarFilled,
  EyeInvisibleOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

// Cookie工具函数
const CookieUtils = {
  // 设置cookie
  setCookie: (name, value, days = 7) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/`;
  },

  // 获取cookie
  getCookie: (name) => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    }
    return null;
  },

  // 删除cookie
  deleteCookie: (name) => {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
  }
};

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
  const [isMobile, setIsMobile] = useState(false);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  // 检测是否为移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 从URL参数解析状态
  const parseUrlParams = () => {
    try {
      // 处理双重编码的问题
      let searchString = location.search;
      if (searchString.includes('%3F')) {
        searchString = decodeURIComponent(searchString);
      }
      
      const searchParams = new URLSearchParams(searchString);
      const urlFilters = {
        keyword: searchParams.get('keyword') || '',
        category: searchParams.get('category') || '',
        source: searchParams.get('source') || '',
        isRead: searchParams.get('isRead') || '',
        isFavorite: searchParams.get('isFavorite') || '',
        isIgnored: searchParams.get('isIgnored') || ''
      };
      const page = parseInt(searchParams.get('page')) || 1;
      return { filters: urlFilters, page };
    } catch (error) {
      console.error('解析URL参数失败:', error);
      return { 
        filters: {
          keyword: '',
          category: '',
          source: '',
          isRead: '',
          isFavorite: '',
          isIgnored: ''
        }, 
        page: 1 
      };
    }
  };

  // 从Cookie加载筛选状态
  const loadFiltersFromCookie = () => {
    try {
      const savedFilters = CookieUtils.getCookie('newsListFilters');
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        return {
          keyword: parsed.keyword || '',
          category: parsed.category || '',
          source: parsed.source || '',
          isRead: parsed.isRead || '',
          isFavorite: parsed.isFavorite || '',
          isIgnored: parsed.isIgnored || ''
        };
      }
    } catch (error) {
      console.error('解析Cookie中的筛选状态失败:', error);
    }
    return {
      keyword: '',
      category: '',
      source: '',
      isRead: '',
      isFavorite: '',
      isIgnored: ''
    };
  };

  // 保存筛选状态到Cookie
  const saveFiltersToCookie = (newFilters) => {
    try {
      // 只保存重要的筛选条件：关键词和分类
      const importantFilters = {
        keyword: newFilters.keyword,
        category: newFilters.category
      };
      CookieUtils.setCookie('newsListFilters', JSON.stringify(importantFilters), 30); // 保存30天
    } catch (error) {
      console.error('保存筛选状态到Cookie失败:', error);
    }
  };

  // 更新URL参数
  const updateUrlParams = (newFilters, page = 1) => {
    const searchParams = new URLSearchParams();
    
    // 添加非空的筛选参数
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        searchParams.set(key, value);
      }
    });
    
    // 添加页码
    if (page > 1) {
      searchParams.set('page', page.toString());
    }
    
    const newUrl = `${location.pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    navigate(newUrl, { replace: true });
  };

  // 获取新闻列表
  const fetchNews = async (page = 1, filters = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.pageSize.toString()
      });

      // 添加筛选参数
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params.set(key, value);
        }
      });

      console.log('发送API请求参数:', params.toString()); // 调试日志

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
    saveFiltersToCookie(newFilters); // 保存到Cookie
    updateUrlParams(newFilters, 1);
    fetchNews(1, newFilters);
  };

  // 处理筛选
  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    saveFiltersToCookie(newFilters); // 保存到Cookie
    updateUrlParams(newFilters, 1);
    fetchNews(1, newFilters);
    
    // 在移动端应用筛选后关闭抽屉
    if (isMobile) {
      setFilterDrawerVisible(false);
    }
  };

  // 处理分页
  const handlePageChange = (page) => {
    updateUrlParams(filters, page);
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
    saveFiltersToCookie(newFilters); // 保存到Cookie
    updateUrlParams(newFilters, 1);
    fetchNews(1, newFilters);
  };

  // 处理新闻点击
  const handleNewsClick = (newsId) => {
    navigate(`/news/${newsId}?${location.search}`);
  };

  // 组件加载时获取数据
  useEffect(() => {
    // 优先从URL参数恢复状态，如果没有则从Cookie加载
    const { filters: urlFilters, page } = parseUrlParams();
    const cookieFilters = loadFiltersFromCookie();
    
    // 合并URL参数和Cookie中的状态，URL参数优先级更高
    const mergedFilters = {
      ...cookieFilters,
      ...urlFilters
    };
    
    console.log('恢复的筛选状态:', mergedFilters); // 调试日志
    setFilters(mergedFilters);
    
    // 如果URL中没有筛选参数，但有Cookie中的状态，则更新URL
    if (!location.search && (cookieFilters.keyword || cookieFilters.category)) {
      updateUrlParams(mergedFilters, page);
    }
    
    fetchNews(page, mergedFilters);
    fetchStats();
    fetchFilters();
  }, []);

  // 监听URL变化
  useEffect(() => {
    const { filters: urlFilters, page } = parseUrlParams();
    console.log('URL变化，新的筛选状态:', urlFilters); // 调试日志
    setFilters(urlFilters);
    fetchNews(page, urlFilters);
  }, [location.search]);

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

  // 移动端筛选抽屉
  const renderMobileFilters = () => (
    <Drawer
      title="筛选条件"
      placement="right"
      onClose={() => setFilterDrawerVisible(false)}
      open={filterDrawerVisible}
      width={300}
    >
      <Form layout="vertical">
        <Form.Item label="关键词搜索">
          <Search
            placeholder="搜索新闻标题或内容"
            allowClear
            onSearch={handleSearch}
            defaultValue={filters.keyword}
          />
        </Form.Item>
        
        <Form.Item label="分类">
          <Select
            placeholder="选择分类"
            allowClear
            style={{ width: '100%' }}
            onChange={(value) => handleFilterChange('category', value)}
            value={filters.category}
          >
            {categories.map(category => (
              <Option key={category} value={category}>{category}</Option>
            ))}
          </Select>
        </Form.Item>
        
        <Form.Item label="来源">
          <Select
            placeholder="选择来源"
            allowClear
            style={{ width: '100%' }}
            onChange={(value) => handleFilterChange('source', value)}
            value={filters.source}
          >
            {sources.map(source => (
              <Option key={source} value={source}>{source}</Option>
            ))}
          </Select>
        </Form.Item>
        
        <Form.Item label="阅读状态">
          <Select
            placeholder="阅读状态"
            allowClear
            style={{ width: '100%' }}
            onChange={(value) => handleFilterChange('isRead', value)}
            value={filters.isRead}
          >
            <Option value="false">未读</Option>
            <Option value="true">已读</Option>
          </Select>
        </Form.Item>
        
        <Form.Item label="收藏状态">
          <Select
            placeholder="收藏状态"
            allowClear
            style={{ width: '100%' }}
            onChange={(value) => handleFilterChange('isFavorite', value)}
            value={filters.isFavorite}
          >
            <Option value="true">已收藏</Option>
            <Option value="false">未收藏</Option>
          </Select>
        </Form.Item>
        
        <Form.Item>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => {
                handleResetFilters();
                setFilterDrawerVisible(false);
              }}
            >
              重置
            </Button>
            <Button 
              type="primary" 
              onClick={() => setFilterDrawerVisible(false)}
            >
              确定
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Drawer>
  );

  return (
    <div style={{ padding: isMobile ? '16px' : '24px' }}>
      <Title level={isMobile ? 3 : 2}>新闻列表</Title>
      
      {/* 统计信息 - 移动端简化显示 */}
      {isMobile ? (
        <Row gutter={8} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Card size="small">
              <Statistic title="总数" value={stats.total} />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small">
              <Statistic title="未读" value={stats.unread} valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
        </Row>
      ) : (
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
      )}

      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: 16 }}>
        {isMobile ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Search
              placeholder="搜索新闻标题或内容"
              allowClear
              onSearch={handleSearch}
              defaultValue={filters.keyword}
              size="large"
            />
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Button 
                icon={<FilterOutlined />} 
                onClick={() => setFilterDrawerVisible(true)}
                size="large"
              >
                筛选条件
              </Button>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={() => fetchNews(pagination.current, filters)}
                size="large"
              >
                刷新
              </Button>
            </Space>
          </Space>
        ) : (
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
        )}
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
              grid={{ 
                gutter: isMobile ? 8 : 16, 
                column: 1 
              }}
              dataSource={news}
              renderItem={(item) => (
                <List.Item>
                  <Card 
                    hoverable
                    size={isMobile ? "small" : "default"}
                    style={{ 
                      opacity: item.isIgnored ? 0.6 : 1,
                      borderLeft: item.isRead ? '4px solid #d9d9d9' : '4px solid #1890ff'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        {/* 可点击区域：标题和摘要 */}
                        <div 
                          style={{ 
                            cursor: 'pointer',
                            padding: '8px',
                            margin: '-8px',
                            borderRadius: '4px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f5f5f5';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          onClick={() => handleNewsClick(item.id)}
                        >
                          <div style={{ marginBottom: 8 }}>
                            <Space wrap>
                              <Text 
                                strong 
                                style={{ 
                                  fontSize: isMobile ? '14px' : '16px',
                                  color: item.isRead ? '#666' : '#000'
                                }}
                              >
                                {item.title}
                              </Text>
                              {item.isFavorite && <HeartFilled style={{ color: '#ff4d4f' }} />}
                              {item.isIgnored && <EyeInvisibleOutlined style={{ color: '#999' }} />}
                            </Space>
                          </div>
                          
                          <div style={{ marginBottom: 8 }}>
                            <Text type="secondary" style={{ fontSize: isMobile ? '12px' : '14px' }}>
                              {truncateSummary(item.summary, isMobile ? 100 : 150)}
                            </Text>
                          </div>
                        </div>
                        
                        <div style={{ marginBottom: 8 }}>
                          <Space wrap>
                            <Tag color="blue" size={isMobile ? "small" : "default"}>{item.category || '其他'}</Tag>
                            <Tag color="green" size={isMobile ? "small" : "default"}>{item.sourceName}</Tag>
                            {item.author && <Tag color="orange" size={isMobile ? "small" : "default"}>{item.author}</Tag>}
                          </Space>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text type="secondary" style={{ fontSize: isMobile ? '10px' : '12px' }}>
                            {formatTime(item.publishedAt)}
                          </Text>
                          
                          <Space size={isMobile ? "small" : "middle"}>
                            <Tooltip title={item.isRead ? '标记为未读' : '标记为已读'}>
                              <Button
                                type="text"
                                size={isMobile ? "small" : "small"}
                                icon={item.isRead ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateNewsStatus(item.id, 'isRead', !item.isRead);
                                }}
                              />
                            </Tooltip>
                            
                            <Tooltip title={item.isFavorite ? '取消收藏' : '收藏'}>
                              <Button
                                type="text"
                                size={isMobile ? "small" : "small"}
                                icon={item.isFavorite ? <HeartFilled style={{ color: '#ff4d4f' }} /> : <HeartOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateNewsStatus(item.id, 'isFavorite', !item.isFavorite);
                                }}
                              />
                            </Tooltip>
                            
                            <Tooltip title={item.isIgnored ? '取消忽略' : '忽略'}>
                              <Button
                                type="text"
                                size={isMobile ? "small" : "small"}
                                icon={item.isIgnored ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateNewsStatus(item.id, 'isIgnored', !item.isIgnored);
                                }}
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
                showQuickJumper={!isMobile}
                showTotal={!isMobile ? (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条新闻` : undefined}
                size={isMobile ? "small" : "default"}
                simple={isMobile}
              />
            </div>
          </>
        )}
      </Card>

      {/* 移动端筛选抽屉 */}
      {renderMobileFilters()}
    </div>
  );
};

export default NewsList; 