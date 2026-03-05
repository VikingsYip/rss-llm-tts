import React, { useState, useEffect } from 'react';
import { Layout, Card, Table, Button, Tag, Space, Modal, message, Statistic, Row, Col, Select, Input, Drawer, Descriptions, Timeline, Badge, Spin, Alert } from 'antd';
import { ReloadOutlined, PlayCircleOutlined, SyncOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Content } = Layout;

const JobScheduler = () => {
  const [loading, setLoading] = useState(false);
  const [jobsStatus, setJobsStatus] = useState({ tasks: 0, feeds: [], feedNames: {} });
  const [jobLogs, setJobLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, running: 0 });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ feedId: null, status: '', triggerType: '' });
  const [logDetailVisible, setLogDetailVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [triggerModalVisible, setTriggerModalVisible] = useState(false);
  const [selectedFeedId, setSelectedFeedId] = useState(null);
  const [realTimeLogs, setRealTimeLogs] = useState([]);

  // 获取任务状态
  const fetchJobsStatus = async () => {
    try {
      const res = await axios.get('/api/rss/jobs/status');
      if (res.data.success) {
        setJobsStatus(res.data.data);
      }
    } catch (err) {
      console.error('获取任务状态失败:', err);
    }
  };

  // 获取任务日志
  const fetchJobLogs = async () => {
    setLogsLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...(filters.feedId && { feedId: filters.feedId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.triggerType && { triggerType: filters.triggerType }),
      };
      const res = await axios.get('/api/rss/job-logs', { params });
      if (res.data.success) {
        setJobLogs(res.data.data.logs);
        setPagination({ ...pagination, total: res.data.data.total });
      }
    } catch (err) {
      console.error('获取任务日志失败:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  // 获取统计信息
  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/rss/job-logs/stats');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('获取统计失败:', err);
    }
  };

  // 重新加载任务
  const handleReload = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/rss/jobs/reload');
      if (res.data.success) {
        message.success('任务已重新加载');
        fetchJobsStatus();
      }
    } catch (err) {
      message.error('重新加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 手动触发任务
  const handleTrigger = async () => {
    if (!selectedFeedId) {
      message.warning('请选择要触发的RSS源');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`/api/rss/jobs/trigger/${selectedFeedId}`);
      if (res.data.success) {
        message.success('任务已触发');
        setTriggerModalVisible(false);
        setTimeout(() => {
          fetchJobLogs();
          fetchStats();
        }, 1000);
      }
    } catch (err) {
      message.error('触发失败');
    } finally {
      setLoading(false);
    }
  };

  // 查看日志详情
  const handleViewLog = async (record) => {
    try {
      const res = await axios.get(`/api/rss/job-logs/${record.id}`);
      if (res.data.success) {
        setSelectedLog(res.data.data);
        setLogDetailVisible(true);
      }
    } catch (err) {
      message.error('获取日志详情失败');
    }
  };

  // 获取运行中的任务数
  const fetchRunningCount = async () => {
    try {
      const res = await axios.get('/api/rss/job-logs/running');
      if (res.data.success) {
        setStats(prev => ({ ...prev, running: res.data.data.count }));
      }
    } catch (err) {
      console.error('获取运行数失败:', err);
    }
  };

  useEffect(() => {
    fetchJobsStatus();
    fetchJobLogs();
    fetchStats();

    // 定时刷新运行中的任务数
    const interval = setInterval(() => {
      fetchRunningCount();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchJobLogs();
  }, [pagination.current, filters]);

  // 表格列配置
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: 'RSS源',
      dataIndex: 'feedName',
      width: 180,
    },
    {
      title: '触发类型',
      dataIndex: 'triggerType',
      width: 80,
      render: (type) => (
        <Tag color={type === 'manual' ? 'blue' : 'green'}>
          {type === 'manual' ? '手动' : '定时'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status) => {
        const statusMap = {
          running: { color: 'processing', text: '运行中' },
          success: { color: 'success', text: '成功' },
          failed: { color: 'error', text: '失败' },
          timeout: { color: 'warning', text: '超时' },
        };
        const item = statusMap[status] || { color: 'default', text: status };
        return <Badge status={item.color} text={item.text} />;
      },
    },
    {
      title: '新增文章',
      dataIndex: 'newArticles',
      width: 90,
      align: 'right',
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      width: 80,
      render: (ms) => ms ? `${ms}ms` : '-',
    },
    {
      title: '触发时间',
      dataIndex: 'triggerTime',
      width: 160,
      render: (time) => time ? new Date(time).format('yyyy-MM-dd hh:mm:ss') : '-',
    },
    {
      title: '操作',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => handleViewLog(record)}>
          详情
        </Button>
      ),
    },
  ];

  // 任务状态表格列
  const jobColumns = [
    {
      title: 'RSS源ID',
      dataIndex: 'feed_id',
      width: 80,
    },
    {
      title: 'RSS源名称',
      dataIndex: 'feedName',
      width: 200,
    },
    {
      title: '下次执行',
      dataIndex: 'next_run',
      width: 160,
      render: (time) => time ? new Date(time).format('yyyy-MM-dd hh:mm') : '-',
    },
    {
      title: '上次执行',
      dataIndex: 'prev_run',
      width: 160,
      render: (time) => time ? new Date(time).format('yyyy-MM-dd hh:mm') : '-',
    },
  ];

  return (
    <Content style={{ padding: '24px' }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日任务总数"
              value={stats.total}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功"
              value={stats.success}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败"
              value={stats.failed}
              valueStyle={{ color: '#cf1322' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="运行中"
              value={stats.running}
              valueStyle={{ color: '#1890ff' }}
              prefix={<LoadingOutlined spin />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="任务调度"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReload}
              loading={loading}
            >
              重新加载
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => setTriggerModalVisible(true)}
            >
              手动触发
            </Button>
            <Button icon={<SyncOutlined />} onClick={() => {
              fetchJobsStatus();
              fetchJobLogs();
              fetchStats();
            }}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={jobColumns}
          dataSource={jobsStatus.feeds}
          rowKey={(record, index) => index}
          size="small"
          pagination={false}
          scroll={{ x: 600 }}
          title={() => `调度任务数: ${jobsStatus.tasks}`}
        />
      </Card>

      <Card
        title="执行日志"
        style={{ marginTop: 16 }}
        extra={
          <Space>
            <Select
              placeholder="筛选状态"
              style={{ width: 120 }}
              allowClear
              value={filters.status || undefined}
              onChange={(value) => setFilters({ ...filters, status: value })}
            >
              <Select.Option value="running">运行中</Select.Option>
              <Select.Option value="success">成功</Select.Option>
              <Select.Option value="failed">失败</Select.Option>
              <Select.Option value="timeout">超时</Select.Option>
            </Select>
            <Select
              placeholder="触发类型"
              style={{ width: 100 }}
              allowClear
              value={filters.triggerType || undefined}
              onChange={(value) => setFilters({ ...filters, triggerType: value })}
            >
              <Select.Option value="manual">手动</Select.Option>
              <Select.Option value="schedule">定时</Select.Option>
            </Select>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={jobLogs}
          rowKey="id"
          loading={logsLoading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page) => setPagination({ ...pagination, current: page }),
          }}
          scroll={{ x: 1000 }}
          size="small"
        />
      </Card>

      {/* 日志详情抽屉 */}
      <Drawer
        title="日志详情"
        placement="right"
        width={600}
        open={logDetailVisible}
        onClose={() => setLogDetailVisible(false)}
      >
        {selectedLog && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="日志ID">{selectedLog.id}</Descriptions.Item>
            <Descriptions.Item label="RSS源">{selectedLog.feedName}</Descriptions.Item>
            <Descriptions.Item label="RSS源ID">{selectedLog.feedId}</Descriptions.Item>
            <Descriptions.Item label="触发类型">
              <Tag color={selectedLog.triggerType === 'manual' ? 'blue' : 'green'}>
                {selectedLog.triggerType === 'manual' ? '手动' : '定时'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Badge
                status={
                  selectedLog.status === 'success' ? 'success' :
                  selectedLog.status === 'failed' ? 'error' :
                  selectedLog.status === 'running' ? 'processing' : 'warning'
                }
                text={selectedLog.status}
              />
            </Descriptions.Item>
            <Descriptions.Item label="新增文章数">{selectedLog.newArticles}</Descriptions.Item>
            <Descriptions.Item label="总文章数">{selectedLog.totalArticles}</Descriptions.Item>
            <Descriptions.Item label="耗时">{selectedLog.duration}ms</Descriptions.Item>
            <Descriptions.Item label="触发时间">
              {selectedLog.triggerTime ? new Date(selectedLog.triggerTime).format('yyyy-MM-dd hh:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="开始时间">
              {selectedLog.startTime ? new Date(selectedLog.startTime).format('yyyy-MM-dd hh:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="结束时间">
              {selectedLog.endTime ? new Date(selectedLog.endTime).format('yyyy-MM-dd hh:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="执行IP">{selectedLog.executorIp || '-'}</Descriptions.Item>
            <Descriptions.Item label="错误信息">
              <span style={{ color: '#cf1322' }}>{selectedLog.errorMsg || '-'}</span>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* 手动触发弹窗 */}
      <Modal
        title="手动触发任务"
        open={triggerModalVisible}
        onOk={handleTrigger}
        onCancel={() => setTriggerModalVisible(false)}
        confirmLoading={loading}
      >
        <p>选择要触发的RSS源：</p>
        <Select
          style={{ width: '100%' }}
          placeholder="选择RSS源"
          showSearch
          optionFilterProp="children"
          value={selectedFeedId}
          onChange={setSelectedFeedId}
          filterOption={(input, option) =>
            option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
          }
        >
          {jobsStatus.feeds.map((feed) => (
            <Select.Option key={feed.feed_id} value={feed.feed_id}>
              {feed.feedName}
            </Select.Option>
          ))}
        </Select>
      </Modal>
    </Content>
  );
};

// 添加 Date.format 方法
Date.prototype.format = function(fmt) {
  const o = {
    'M+': this.getMonth() + 1,
    'd+': this.getDate(),
    'h+': this.getHours(),
    'm+': this.getMinutes(),
    's+': this.getSeconds(),
    'q+': Math.floor((this.getMonth() + 3) / 3),
    S: this.getMilliseconds(),
  };
  if (/(y+)/.test(fmt)) {
    fmt = fmt.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length));
  }
  for (const k in o) {
    if (new RegExp('(' + k + ')').test(fmt)) {
      fmt = fmt.replace(RegExp.$1, RegExp.$1.length === 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length));
    }
  }
  return fmt;
};

export default JobScheduler;
