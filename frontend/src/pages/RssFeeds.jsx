import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Typography, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  Input, 
  Upload, 
  message, 
  Popconfirm,
  Tooltip,
  Divider,
  Alert
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  UploadOutlined, 
  SyncOutlined,
  FileTextOutlined,
  DownloadOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;

const RssFeeds = () => {
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingFeed, setEditingFeed] = useState(null);
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    sortBy: 'createdAt',
    sortOrder: 'DESC'
  });

  const categories = ['科技', 'AI', '互联网', '创业', '开发', '其他'];

  // 获取RSS源列表
  const fetchFeeds = async (sortBy = sortConfig.sortBy, sortOrder = sortConfig.sortOrder) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sortBy: sortBy,
        sortOrder: sortOrder
      });

      const response = await fetch(`/api/rss/feeds?${params}`);
      const data = await response.json();
      if (data.success) {
        setFeeds(data.data);
        setSortConfig({ sortBy, sortOrder });
      } else {
        message.error('获取RSS源列表失败');
      }
    } catch (error) {
      console.error('获取RSS源列表失败:', error);
      message.error('获取RSS源列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时获取RSS源列表
  useEffect(() => {
    fetchFeeds();
  }, []);

  // 处理排序
  const handleSort = (sortBy) => {
    const currentSortOrder = sortConfig.sortBy === sortBy ? sortConfig.sortOrder : 'DESC';
    const newSortOrder = currentSortOrder === 'DESC' ? 'ASC' : 'DESC';
    fetchFeeds(sortBy, newSortOrder);
  };

  // 处理OPML文件上传
  const handleOpmlUpload = (file) => {
    setUploading(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const opmlContent = e.target.result;
        const parsedFeeds = parseOpmlContent(opmlContent);
        
        if (parsedFeeds.length > 0) {
          // 调用后端API保存RSS源
          const response = await fetch('/api/rss/feeds/import-opml', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ feeds: parsedFeeds }),
          });

          const result = await response.json();
          
          if (result.success) {
            message.success(`成功导入 ${result.data.added} 个RSS源，跳过 ${result.data.skipped} 个，错误 ${result.data.errors} 个`);
            // 重新获取RSS源列表
            fetchFeeds();
          } else {
            message.error(`导入失败: ${result.message}`);
          }
        } else {
          message.warning('OPML文件中未找到有效的RSS源配置');
        }
      } catch (error) {
        console.error('OPML解析错误:', error);
        message.error('OPML文件格式错误，请检查文件内容');
      } finally {
        setUploading(false);
      }
    };
    
    reader.readAsText(file);
    return false; // 阻止自动上传
  };

  // 解析OPML内容
  const parseOpmlContent = (opmlContent) => {
    const feeds = [];
    
    try {
      // 创建DOM解析器
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(opmlContent, 'text/xml');
      
      // 检查解析错误
      const parseError = xmlDoc.getElementsByTagName('parsererror');
      if (parseError.length > 0) {
        throw new Error('XML解析失败');
      }
      
      // 查找所有outline元素
      const outlines = xmlDoc.querySelectorAll('outline[type="rss"], outline[xmlUrl]');
      
      outlines.forEach((outline, index) => {
        const title = outline.getAttribute('title') || outline.getAttribute('text') || `RSS源${index + 1}`;
        const xmlUrl = outline.getAttribute('xmlUrl') || outline.getAttribute('url');
        const category = outline.getAttribute('category') || '其他';
        
        if (xmlUrl) {
          feeds.push({
            name: title,
            url: xmlUrl,
            category: category,
            fetchInterval: 3600000
          });
        }
      });
      
      // 如果没有找到type="rss"的outline，尝试查找所有有xmlUrl的outline
      if (feeds.length === 0) {
        const allOutlines = xmlDoc.querySelectorAll('outline[xmlUrl]');
        allOutlines.forEach((outline, index) => {
          const title = outline.getAttribute('title') || outline.getAttribute('text') || `RSS源${index + 1}`;
          const xmlUrl = outline.getAttribute('xmlUrl');
          const category = outline.getAttribute('category') || '其他';
          
          if (xmlUrl) {
            feeds.push({
              name: title,
              url: xmlUrl,
              category: category,
              fetchInterval: 3600000
            });
          }
        });
      }
      
    } catch (error) {
      console.error('OPML解析错误:', error);
      throw new Error('OPML文件格式错误');
    }
    
    return feeds;
  };

  // 生成OPML模板
  const generateOpmlTemplate = () => {
    const template = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>RSS源配置文件</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
    <dateModified>${new Date().toISOString()}</dateModified>
  </head>
  <body>
    <outline text="科技" title="科技">
      <outline type="rss" text="36氪" title="36氪" xmlUrl="https://www.36kr.com/feed" category="科技"/>
      <outline type="rss" text="钛媒体" title="钛媒体" xmlUrl="https://www.tmtpost.com/rss.xml" category="科技"/>
    </outline>
    <outline text="AI" title="AI">
      <outline type="rss" text="机器之心" title="机器之心" xmlUrl="https://www.jiqizhixin.com/rss" category="AI"/>
      <outline type="rss" text="量子位" title="量子位" xmlUrl="https://www.qbitai.com/feed" category="AI"/>
    </outline>
    <outline text="互联网" title="互联网">
      <outline type="rss" text="虎嗅网" title="虎嗅网" xmlUrl="https://www.huxiu.com/rss/0.xml" category="互联网"/>
    </outline>
  </body>
</opml>`;
    
    const blob = new Blob([template], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rss_feeds_template.opml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddFeed = () => {
    setEditingFeed(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEditFeed = (record) => {
    setEditingFeed(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleSaveFeed = async (values) => {
    try {
      if (editingFeed) {
        // 更新现有RSS源
        const response = await fetch(`/api/rss/feeds/${editingFeed.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(values),
        });

        const result = await response.json();
        if (result.success) {
          message.success('RSS源更新成功');
          fetchFeeds();
        } else {
          message.error(`更新失败: ${result.message}`);
        }
      } else {
        // 添加新RSS源
        const response = await fetch('/api/rss/feeds', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(values),
        });

        const result = await response.json();
        if (result.success) {
          message.success('RSS源添加成功');
          fetchFeeds();
        } else {
          message.error(`添加失败: ${result.message}`);
        }
      }
      setIsModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleDeleteFeed = async (id) => {
    try {
      const response = await fetch(`/api/rss/feeds/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        message.success('删除成功');
        fetchFeeds();
      } else {
        message.error(`删除失败: ${result.message}`);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleManualFetch = async (id) => {
    try {
      const response = await fetch(`/api/rss/feeds/${id}/fetch`, {
        method: 'POST',
      });

      const result = await response.json();
      if (result.success) {
        message.success('抓取成功');
        // 刷新RSS源列表以更新文章数
        fetchFeeds();
      } else {
        message.error(`抓取失败: ${result.message}`);
      }
    } catch (error) {
      message.error('抓取失败');
    }
  };

  const handleBatchFetch = async () => {
    try {
      message.loading('正在批量抓取所有RSS源...', 0);
      const response = await fetch('/api/rss/feeds/fetch-all', {
        method: 'POST',
      });

      const result = await response.json();
      message.destroy();
      
      if (result.success) {
        message.success('批量抓取完成');
        // 刷新RSS源列表以更新文章数
        fetchFeeds();
      } else {
        message.error(`批量抓取失败: ${result.message}`);
      }
    } catch (error) {
      message.destroy();
      message.error('批量抓取失败');
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      onHeaderCell: () => ({
        onClick: () => handleSort('name')
      })
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      width: 300,
      ellipsis: true,
      render: (url) => (
        <Tooltip title={url}>
          <a href={url} target="_blank" rel="noopener noreferrer">
            {url}
          </a>
        </Tooltip>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category) => <Tag color="blue">{category}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '文章数',
      dataIndex: 'articleCount',
      key: 'articleCount',
      width: 100,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      onHeaderCell: () => ({
        onClick: () => handleSort('articleCount')
      }),
      render: (count) => count || 0,
    },
    {
      title: '最后抓取',
      dataIndex: 'lastFetchTime',
      key: 'lastFetchTime',
      width: 150,
      sorter: true,
      sortDirections: ['ascend', 'descend'],
      onHeaderCell: () => ({
        onClick: () => handleSort('lastFetchTime')
      }),
      render: (time) => time ? new Date(time).toLocaleString() : '未抓取',
    },
    {
      title: '抓取间隔',
      dataIndex: 'fetchInterval',
      key: 'fetchInterval',
      width: 120,
      render: (interval) => `${interval / 60000}分钟`,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            icon={<EditOutlined />}
            onClick={() => handleEditFeed(record)}
          >
            编辑
          </Button>
          <Button 
            type="link" 
            icon={<SyncOutlined />}
            onClick={() => handleManualFetch(record.id)}
          >
            抓取
          </Button>
          <Popconfirm
            title="确定要删除这个RSS源吗？"
            onConfirm={() => handleDeleteFeed(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="link" 
              danger 
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>RSS源管理</Title>
      
      <Alert
        message="OPML配置文件支持"
        description="您可以通过上传OPML配置文件批量导入RSS源。OPML是RSS源配置的标准格式，支持从其他RSS阅读器导出。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleAddFeed}
          >
            添加RSS源
          </Button>
          
          <Upload
            accept=".opml,.xml"
            beforeUpload={handleOpmlUpload}
            showUploadList={false}
          >
            <Button 
              icon={<UploadOutlined />}
              loading={uploading}
            >
              导入OPML
            </Button>
          </Upload>
          
          <Button 
            icon={<DownloadOutlined />}
            onClick={generateOpmlTemplate}
          >
            下载模板
          </Button>
          
          <Button 
            icon={<SyncOutlined />}
            onClick={handleBatchFetch}
          >
            批量抓取
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={feeds}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个RSS源`,
          }}
          scroll={{ x: 1200 }}
          onChange={(pagination, filters, sorter) => {
            // 处理Ant Design Table的排序事件
            if (sorter && sorter.field) {
              const sortOrder = sorter.order === 'ascend' ? 'ASC' : 'DESC';
              fetchFeeds(sorter.field, sortOrder);
            }
          }}
        />
      </Card>

      <Modal
        title={editingFeed ? '编辑RSS源' : '添加RSS源'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveFeed}
          initialValues={{
            category: '科技',
            fetchInterval: 3600000,
          }}
        >
          <Form.Item
            name="name"
            label="RSS源名称"
            rules={[{ required: true, message: '请输入RSS源名称' }]}
          >
            <Input placeholder="例如：36氪" />
          </Form.Item>

          <Form.Item
            name="url"
            label="RSS Feed URL"
            rules={[
              { required: true, message: '请输入RSS Feed URL' },
              { type: 'url', message: '请输入有效的URL' }
            ]}
          >
            <Input placeholder="https://example.com/feed" />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Input placeholder="请选择分类" />
          </Form.Item>

          <Form.Item
            name="fetchInterval"
            label="抓取间隔(毫秒)"
            rules={[{ required: true, message: '请输入抓取间隔' }]}
          >
            <Input placeholder="3600000 (1小时)" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingFeed ? '更新' : '添加'}
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

export default RssFeeds; 