import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Modal, message, Typography, Pagination } from 'antd';
import { ReloadOutlined, SendOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const DailyTaskLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  const navigate = useNavigate();

  // 获取日志列表
  const fetchLogs = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/daily-task/logs?page=${page}&limit=${pageSize}`);
      const data = await response.json();

      if (data.success) {
        setLogs(data.data.logs);
        setPagination({
          current: data.data.pagination.page,
          pageSize: data.data.pagination.limit,
          total: data.data.pagination.total
        });
      } else {
        message.error('获取日志失败');
      }
    } catch (error) {
      console.error('获取日志失败:', error);
      message.error('获取日志失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时获取日志
  useEffect(() => {
    fetchLogs();
  }, []);

  // 处理分页变化
  const handleTableChange = (pag) => {
    fetchLogs(pag.current, pag.pageSize);
  };

  // 手动推送微信
  const handlePushToWeChat = async (log) => {
    Modal.confirm({
      title: '确认推送',
      content: `确定要将对话 "${log.title}" 推送到微信公众号草稿箱吗？`,
      onOk: async () => {
        try {
          message.loading('正在推送...', 0);
          const response = await fetch(`/api/wechat-mp/dialogue/${log.dialogueId}/push`, {
            method: 'POST',
          });

          const result = await response.json();
          message.destroy();

          if (result.success) {
            message.success(`推送成功，media_id: ${result.data.media_id}`);
            fetchLogs(pagination.current, pagination.pageSize);
          } else {
            message.error(`推送失败: ${result.message}`);
          }
        } catch (error) {
          message.destroy();
          console.error('推送失败:', error);
          message.error('推送失败');
        }
      }
    });
  };

  // 状态映射
  const statusMap = {
    success: { text: '成功', color: 'success' },
    failed: { text: '失败', color: 'error' },
    running: { text: '运行中', color: 'processing' },
    skipped: { text: '跳过', color: 'default' }
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 80,
    },
    {
      title: '主持人',
      dataIndex: 'host',
      key: 'host',
      width: 100,
    },
    {
      title: '嘉宾',
      dataIndex: 'guest',
      key: 'guest',
      width: 150,
    },
    {
      title: '轮次',
      dataIndex: 'rounds',
      key: 'rounds',
      width: 60,
    },
    {
      title: '新闻数',
      dataIndex: 'newsCount',
      key: 'newsCount',
      width: 70,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tag color={statusMap[status]?.color}>
          {statusMap[status]?.text}
        </Tag>
      ),
    },
    {
      title: '微信推送',
      dataIndex: 'wechatPushed',
      key: 'wechatPushed',
      width: 80,
      render: (pushed, record) => (
        pushed ? (
          <Tag color="success">已推送</Tag>
        ) : record.status === 'success' ? (
          <Tag color="warning">未推送</Tag>
        ) : (
          <Tag color="default">-</Tag>
        )
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (duration) => duration ? `${duration}ms` : '-',
    },
    {
      title: '触发时间',
      dataIndex: 'triggerTime',
      key: 'triggerTime',
      width: 160,
      render: (time) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: '错误信息',
      dataIndex: 'errorMsg',
      key: 'errorMsg',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/dialogues/${record.dialogueId}`)}
            disabled={!record.dialogueId}
          >
            查看
          </Button>
          {(record.status === 'success' && !record.wechatPushed) && (
            <Button
              type="link"
              icon={<SendOutlined />}
              onClick={() => handlePushToWeChat(record)}
            >
              推送
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={2} style={{ margin: 0 }}>
            每日任务日志
          </Title>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchLogs(pagination.current, pagination.pageSize)}
            loading={loading}
          >
            刷新
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 1200 }}
        />

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Pagination
            current={pagination.current}
            pageSize={pagination.pageSize}
            total={pagination.total}
            onChange={handleTableChange}
            showSizeChanger={false}
            showTotal={(total) => `共 ${total} 条记录`}
          />
        </div>
      </Card>
    </div>
  );
};

export default DailyTaskLogs;
