import React, { useState } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, InputNumber, message } from 'antd';
import { PlusOutlined, PlayCircleOutlined, DownloadOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;

const Dialogues = () => {
  const [dialogues, setDialogues] = useState([
    {
      id: 1,
      title: '主持人与嘉宾的访谈对话',
      dialogueType: 'interview',
      character1: '主持人',
      character2: '嘉宾',
      status: 'completed',
      rounds: 8,
      newsCount: 5,
      audioFile: 'dialogue_1_1234567890.mp3',
      duration: 120,
      createdAt: '2024-01-01 12:00:00'
    },
    {
      id: 2,
      title: '两位评论员分析热点话题',
      dialogueType: 'commentary',
      character1: '评论员A',
      character2: '评论员B',
      status: 'generating',
      rounds: 6,
      newsCount: 3,
      audioFile: null,
      duration: null,
      createdAt: '2024-01-01 13:00:00'
    }
  ]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
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

  const handleCreateDialogue = async (values) => {
    setLoading(true);
    try {
      // 这里应该调用API创建对话
      console.log('创建对话:', values);
      const newDialogue = {
        id: Date.now(),
        title: values.title,
        dialogueType: values.dialogueType,
        character1: values.character1,
        character2: values.character2,
        status: 'generating',
        rounds: values.rounds,
        newsCount: values.newsCount,
        audioFile: null,
        duration: null,
        createdAt: new Date().toLocaleString()
      };
      setDialogues([newDialogue, ...dialogues]);
      message.success('对话创建成功，正在生成中...');
      setIsModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('创建对话失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个对话吗？',
      onOk: () => {
        setDialogues(dialogues.filter(d => d.id !== id));
        message.success('删除成功');
      }
    });
  };

  const handlePlayAudio = (audioFile) => {
    const audio = new Audio(`/uploads/${audioFile}`);
    audio.play();
  };

  const handleDownloadAudio = (audioFile) => {
    const link = document.createElement('a');
    link.href = `/uploads/${audioFile}`;
    link.download = audioFile;
    link.click();
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
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
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => navigate(`/dialogues/${record.id}`)}
          >
            查看
          </Button>
          {record.audioFile && (
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
    <div className="dialogues">
      <Card className="custom-card">
        <div style={{ marginBottom: 16 }}>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setIsModalVisible(true)}
          >
            创建对话
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={dialogues}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          scroll={{ x: 1200 }}
        />

        <Modal
          title="创建新对话"
          open={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          footer={null}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCreateDialogue}
            initialValues={{
              dialogueType: 'interview',
              rounds: 8,
              newsCount: 5,
            }}
          >
            <Form.Item
              name="title"
              label="对话标题"
              rules={[{ required: true, message: '请输入对话标题' }]}
            >
              <Input placeholder="请输入对话标题" />
            </Form.Item>

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

            <Form.Item
              name="character1"
              label="角色1"
              rules={[{ required: true, message: '请输入角色1名称' }]}
            >
              <Input placeholder="例如：主持人" />
            </Form.Item>

            <Form.Item
              name="character2"
              label="角色2"
              rules={[{ required: true, message: '请输入角色2名称' }]}
            >
              <Input placeholder="例如：嘉宾" />
            </Form.Item>

            <Form.Item
              name="rounds"
              label="对话轮次"
              rules={[{ required: true, message: '请输入对话轮次' }]}
            >
              <InputNumber min={1} max={20} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="newsCount"
              label="使用的新闻数量"
              rules={[{ required: true, message: '请输入新闻数量' }]}
            >
              <InputNumber min={1} max={20} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={loading}>
                  创建对话
                </Button>
                <Button onClick={() => setIsModalVisible(false)}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default Dialogues; 