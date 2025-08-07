import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  Input, 
  Select, 
  InputNumber, 
  message,
  Spin,
  Empty,
  Tooltip,
  Typography,
  List,
  Checkbox,
  Divider,
  Row,
  Col,
  Pagination
} from 'antd';
import { 
  PlusOutlined, 
  PlayCircleOutlined, 
  DownloadOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  ReloadOutlined,
  SyncOutlined,
  SearchOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;
const { Title } = Typography;
const { Search } = Input;
const { Text } = Typography;

const Dialogues = () => {
  const [dialogues, setDialogues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [creating, setCreating] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  
  // 新闻选择相关状态
  const [newsList, setNewsList] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [selectedNews, setSelectedNews] = useState([]);
  const [newsSearchKeyword, setNewsSearchKeyword] = useState('');
  const [newsSelectedCategory, setNewsSelectedCategory] = useState(''); // 新增：选中的分类
  const [showNewsSelector, setShowNewsSelector] = useState(false);
  const [newsPagination, setNewsPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  
  // 新闻分类列表
  const newsCategories = [
    { value: '', label: '全部分类' },
    { value: '官媒新闻', label: '官媒新闻' },
    { value: '科技媒体', label: '科技媒体' },
    { value: '财经商业', label: '财经商业' },
    { value: '国际媒体', label: '国际媒体' },
    { value: '自媒体博客', label: '自媒体博客' },
    { value: '社区论坛', label: '社区论坛' },
    { value: '生活文化', label: '生活文化' },
    { value: '其他', label: '其他' }
  ];

  // 分类颜色映射
  const categoryColors = {
    '官媒新闻': 'red',
    '科技媒体': 'blue',
    '财经商业': 'green',
    '国际媒体': 'purple',
    '自媒体博客': 'orange',
    '社区论坛': 'cyan',
    '生活文化': 'pink',
    '其他': 'default'
  };

  // 获取分类颜色
  const getCategoryColor = (category) => {
    return categoryColors[category] || 'default';
  };
  
  const navigate = useNavigate();

  const typeMap = {
    interview: { text: '访谈', color: 'blue' },
    ceo_interview: { text: 'CEO采访', color: 'purple' },
    commentary: { text: '评论', color: 'green' },
    chat: { text: '聊天', color: 'orange' },
  };

  const statusMap = {
    generating: { text: '生成中', color: 'processing' },
    completed: { text: '已完成', color: 'success' },
    failed: { text: '失败', color: 'error' },
  };

  // 获取对话列表
  const fetchDialogues = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString()
      });

      const response = await fetch(`/api/dialogue?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setDialogues(data.data);
        setPagination({
          current: data.pagination.page,
          pageSize: data.pagination.limit,
          total: data.pagination.total
        });
      } else {
        message.error('获取对话列表失败');
      }
    } catch (error) {
      console.error('获取对话列表失败:', error);
      message.error('获取对话列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取新闻列表
  const fetchNews = async (page = 1, keyword = '', category = '') => {
    setNewsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        keyword: keyword,
        category: category // 添加分类参数
      });

      const response = await fetch(`/api/news?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setNewsList(data.data.news);
        setNewsPagination({
          current: data.data.pagination.page,
          pageSize: data.data.pagination.limit,
          total: data.data.pagination.total
        });
      } else {
        message.error('获取新闻列表失败');
      }
    } catch (error) {
      console.error('获取新闻列表失败:', error);
      message.error('获取新闻列表失败');
    } finally {
      setNewsLoading(false);
    }
  };

  // 组件加载时获取对话列表
  useEffect(() => {
    fetchDialogues();
  }, []);

  // 处理新闻搜索
  const handleNewsSearch = (value) => {
    setNewsSearchKeyword(value);
    fetchNews(1, value, newsSelectedCategory);
  };

  // 处理新闻分页
  const handleNewsPagination = (page) => {
    fetchNews(page, newsSearchKeyword, newsSelectedCategory);
  };

  // 处理分类筛选
  const handleCategoryChange = (value) => {
    setNewsSelectedCategory(value);
    fetchNews(1, newsSearchKeyword, value);
  };

  // 重置新闻筛选条件
  const handleResetNewsFilter = () => {
    setNewsSearchKeyword('');
    setNewsSelectedCategory('');
    fetchNews(1, '', '');
  };

  // 处理新闻选择
  const handleNewsSelect = (newsId, checked) => {
    if (checked) {
      const news = newsList.find(n => n.id === newsId);
      if (news && selectedNews.length < 10) { // 限制最多选择10条新闻
        setSelectedNews([...selectedNews, news]);
      } else if (selectedNews.length >= 10) {
        message.warning('最多只能选择10条新闻');
      }
    } else {
      setSelectedNews(selectedNews.filter(n => n.id !== newsId));
    }
  };

  // 移除已选择的新闻
  const handleRemoveNews = (newsId) => {
    setSelectedNews(selectedNews.filter(n => n.id !== newsId));
  };

  // 清空已选择的新闻
  const handleClearNews = () => {
    setSelectedNews([]);
  };

  // 创建对话
  const handleCreateDialogue = async (values) => {
    // 移除强制选择新闻的限制，因为系统可以使用随机新闻
    // if (selectedNews.length === 0) {
    //   message.error('请至少选择一条新闻');
    //   return;
    // }

    setCreating(true);
    try {
      const requestData = {
        ...values,
        newsIds: selectedNews.map(n => n.id),
        newsCount: selectedNews.length
      };

      const response = await fetch('/api/dialogue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();
      
      if (result.success) {
        message.success(result.message);
        setIsModalVisible(false);
        form.resetFields();
        setSelectedNews([]);
        setShowNewsSelector(false);
        // 刷新对话列表
        fetchDialogues();
      } else {
        message.error(`创建失败: ${result.message}`);
      }
    } catch (error) {
      console.error('创建对话失败:', error);
      message.error('创建对话失败');
    } finally {
      setCreating(false);
    }
  };

  // 删除对话
  const handleDelete = async (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个对话吗？',
      onOk: async () => {
        try {
          const response = await fetch(`/api/dialogue/${id}`, {
            method: 'DELETE',
          });

          const result = await response.json();
          
          if (result.success) {
            message.success('删除成功');
            fetchDialogues();
          } else {
            message.error(`删除失败: ${result.message}`);
          }
        } catch (error) {
          console.error('删除对话失败:', error);
          message.error('删除对话失败');
        }
      }
    });
  };

  // 手动生成对话内容
  const handleGenerateContent = async (id) => {
    try {
      message.loading('正在生成对话内容...', 0);
      const response = await fetch(`/api/dialogue/${id}/generate`, {
        method: 'POST',
      });

      const result = await response.json();
      message.destroy();
      
      if (result.success) {
        message.success('对话内容生成完成');
        fetchDialogues();
      } else {
        message.error(`生成失败: ${result.message}`);
      }
    } catch (error) {
      message.destroy();
      console.error('生成对话内容失败:', error);
      message.error('生成对话内容失败');
    }
  };

  // 播放音频
  const handlePlayAudio = (audioFile) => {
    try {
      message.loading('正在加载音频...', 0);
      const audio = new Audio(`/uploads/${audioFile}`);
      
      audio.addEventListener('loadstart', () => {
        message.loading('正在加载音频...', 0);
      });
      
      audio.addEventListener('canplay', () => {
        message.destroy();
        message.success('音频加载完成，开始播放');
      });
      
      audio.addEventListener('error', (e) => {
        message.destroy();
        console.error('音频播放错误:', e);
        message.error('音频播放失败，请检查文件是否存在');
      });
      
      audio.addEventListener('ended', () => {
        message.success('音频播放完成');
      });
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          message.destroy();
          console.error('音频播放失败:', error);
          message.error('音频播放失败: ' + error.message);
        });
      }
    } catch (error) {
      message.destroy();
      console.error('创建音频对象失败:', error);
      message.error('音频播放失败');
    }
  };

  // 下载音频
  const handleDownloadAudio = (audioFile) => {
    const link = document.createElement('a');
    link.href = `/uploads/${audioFile}`;
    link.download = audioFile;
    link.click();
  };

  // 处理分页变化
  const handleTableChange = (pagination) => {
    fetchDialogues(pagination.current, pagination.pageSize);
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'dialogueType',
      key: 'dialogueType',
      width: 100,
      render: (type) => (
        <Tag color={typeMap[type]?.color}>
          {typeMap[type]?.text}
        </Tag>
      ),
    },
    {
      title: '角色',
      key: 'characters',
      width: 150,
      render: (_, record) => `${record.character1} & ${record.character2}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={statusMap[status]?.color}>
          {statusMap[status]?.text}
        </Tag>
      ),
    },
    {
      title: '轮次',
      dataIndex: 'rounds',
      key: 'rounds',
      width: 80,
    },
    {
      title: '新闻数',
      dataIndex: 'newsCount',
      key: 'newsCount',
      width: 80,
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (duration) => duration ? `${duration}秒` : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (time) => new Date(time).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 250,
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => navigate(`/dialogues/${record.id}`)}
          >
            查看
          </Button>
          {record.status === 'generating' && (
            <Tooltip title="手动生成内容">
              <Button 
                type="link" 
                icon={<SyncOutlined />}
                onClick={() => handleGenerateContent(record.id)}
              >
                生成
              </Button>
            </Tooltip>
          )}
          {record.audioFile && record.status === 'completed' && (
            <>
              <Button 
                type="link" 
                icon={<PlayCircleOutlined />}
                onClick={() => handlePlayAudio(record.audioFile)}
              >
                播放
              </Button>
              <Button 
                type="link" 
                icon={<DownloadOutlined />}
                onClick={() => handleDownloadAudio(record.audioFile)}
              >
                下载
              </Button>
            </>
          )}
          <Button 
            type="link" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>对话管理</Title>
      
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => {
              setIsModalVisible(true);
              setSelectedNews([]);
              setShowNewsSelector(false);
            }}
          >
            创建对话
          </Button>
          <Button 
            icon={<ReloadOutlined />}
            onClick={() => fetchDialogues()}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={dialogues}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: <Empty description="暂无对话记录" />
          }}
        />
      </Card>

      <Modal
        title="创建新对话"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateDialogue}
          initialValues={{
            dialogueType: 'interview',
            rounds: 8,
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="title"
                label="对话标题"
                rules={[{ required: true, message: '请输入对话标题' }]}
              >
                <Input placeholder="请输入对话标题" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dialogueType"
                label="对话类型"
                rules={[{ required: true, message: '请选择对话类型' }]}
              >
                <Select placeholder="请选择对话类型">
                  <Option value="interview">访谈</Option>
                  <Option value="ceo_interview">CEO采访</Option>
                  <Option value="commentary">评论</Option>
                  <Option value="chat">聊天</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="character1"
                label="角色1"
                rules={[{ required: true, message: '请输入角色1名称' }]}
              >
                <Input placeholder="例如：主持人" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="character2"
                label="角色2"
                rules={[{ required: true, message: '请输入角色2名称' }]}
              >
                <Input placeholder="例如：嘉宾" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="rounds"
                label="对话轮次"
                rules={[{ required: true, message: '请输入对话轮次' }]}
              >
                <InputNumber min={1} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="已选新闻数量">
                <div style={{ padding: '4px 11px', border: '1px solid #d9d9d9', borderRadius: '6px', backgroundColor: '#fafafa' }}>
                  {selectedNews.length} 条新闻
                </div>
              </Form.Item>
            </Col>
          </Row>

          {/* 新闻选择区域 */}
          <Divider orientation="left">选择新闻素材</Divider>
          
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Button 
                type={showNewsSelector ? 'primary' : 'default'}
                icon={<FileTextOutlined />}
                onClick={() => {
                  setShowNewsSelector(!showNewsSelector);
                  if (!showNewsSelector) {
                    // 重置筛选条件并加载数据
                    setNewsSearchKeyword('');
                    setNewsSelectedCategory('');
                    fetchNews(1, '', '');
                  }
                }}
              >
                {showNewsSelector ? '隐藏新闻选择器' : '显示新闻选择器'}
              </Button>
              {selectedNews.length > 0 && (
                <Button onClick={handleClearNews}>
                  清空已选
                </Button>
              )}
            </Space>
          </div>

          {showNewsSelector && (
            <div style={{ border: '1px solid #d9d9d9', borderRadius: '6px', padding: '16px', marginBottom: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Select
                    style={{ width: 150 }}
                    placeholder="选择分类"
                    value={newsSelectedCategory}
                    onChange={handleCategoryChange}
                  >
                    {newsCategories.map(category => (
                      <Option key={category.value} value={category.value}>
                        {category.label}
                      </Option>
                    ))}
                  </Select>
                  <Search
                    placeholder="搜索新闻标题或内容"
                    onSearch={handleNewsSearch}
                    style={{ width: 300 }}
                    allowClear
                  />
                  {newsSearchKeyword || newsSelectedCategory ? (
                    <Button 
                      type="link" 
                      size="small" 
                      onClick={handleResetNewsFilter}
                    >
                      重置
                    </Button>
                  ) : null}
                </Space>
                <div style={{ marginTop: 8, color: '#666', fontSize: '12px' }}>
                  共找到 {newsPagination.total} 条新闻
                  {newsSelectedCategory && ` (分类: ${newsCategories.find(c => c.value === newsSelectedCategory)?.label})`}
                  {newsSearchKeyword && ` (关键词: ${newsSearchKeyword})`}
                </div>
              </div>

              <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                {newsLoading ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <Spin />
                  </div>
                ) : (
                  <>
                    <List
                      dataSource={newsList}
                      renderItem={(news) => (
                        <List.Item style={{ padding: '8px 0' }}>
                          <Checkbox
                            checked={selectedNews.some(n => n.id === news.id)}
                            onChange={(e) => handleNewsSelect(news.id, e.target.checked)}
                          >
                            <div style={{ marginLeft: 8, width: '100%' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                <div style={{ fontWeight: 'bold', flex: 1 }}>
                                  {news.title}
                                </div>
                                <Tag color={getCategoryColor(news.category)} style={{ marginLeft: 8 }}>
                                  {news.category || '未分类'}
                                </Tag>
                              </div>
                              <div style={{ color: '#666', fontSize: '12px', marginBottom: 4 }}>
                                {news.summary?.substring(0, 100)}...
                              </div>
                              <div style={{ color: '#999', fontSize: '12px' }}>
                                来源: {news.sourceName} | 时间: {new Date(news.publishedAt).toLocaleDateString()}
                              </div>
                            </div>
                          </Checkbox>
                        </List.Item>
                      )}
                      locale={{
                        emptyText: <Empty description="暂无新闻数据" />
                      }}
                    />
                    {newsPagination.total > newsPagination.pageSize && (
                      <div style={{ textAlign: 'center', marginTop: 16 }}>
                        <Pagination
                          current={newsPagination.current}
                          pageSize={newsPagination.pageSize}
                          total={newsPagination.total}
                          showSizeChanger={false}
                          showQuickJumper
                          showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
                          onChange={handleNewsPagination}
                          size="small"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* 已选新闻展示 */}
          {selectedNews.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}>
                <Text strong>已选择的新闻 ({selectedNews.length} 条):</Text>
              </div>
              <div style={{ maxHeight: '150px', overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: '6px', padding: '8px' }}>
                {selectedNews.map((news) => (
                  <div key={news.id} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '4px 0',
                    borderBottom: '1px solid #f0f0f0'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '12px', flex: 1 }}>
                          {news.title}
                        </div>
                        <Tag color={getCategoryColor(news.category)} size="small" style={{ marginLeft: 8 }}>
                          {news.category || '未分类'}
                        </Tag>
                      </div>
                      <div style={{ color: '#666', fontSize: '11px' }}>
                        {news.sourceName} | {new Date(news.publishedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Button 
                      type="link" 
                      size="small" 
                      danger
                      onClick={() => handleRemoveNews(news.id)}
                    >
                      移除
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={creating}>
                创建对话
              </Button>
              <Button onClick={() => setIsModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Dialogues; 