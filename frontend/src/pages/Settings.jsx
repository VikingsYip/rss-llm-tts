import React, { useState } from 'react';
import { Card, Form, Input, Button, Space, Divider, Typography, message, Tabs } from 'antd';
import { SaveOutlined, ExperimentOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { TextArea } = Input;

const Settings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSave = async (values) => {
    setLoading(true);
    try {
      // 这里应该调用API保存设置
      console.log('保存设置:', values);
      message.success('设置保存成功');
    } catch (error) {
      message.error('设置保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTestLLM = () => {
    message.info('正在测试LLM连接...');
  };

  const handleTestTTS = () => {
    message.info('正在测试TTS连接...');
  };

  const items = [
    {
      key: '1',
      label: 'API配置',
      children: (
        <div>
          <Title level={4}>LLM API配置</Title>
          <Form.Item
            name="llmApiUrl"
            label="LLM API地址"
            rules={[{ required: true, message: '请输入LLM API地址' }]}
          >
            <Input placeholder="https://api.openai.com/v1/chat/completions" />
          </Form.Item>
          <Form.Item
            name="llmApiKey"
            label="LLM API密钥"
            rules={[{ required: true, message: '请输入LLM API密钥' }]}
          >
            <Input.Password placeholder="请输入LLM API密钥" />
          </Form.Item>
          <Form.Item
            name="llmModel"
            label="LLM模型"
            rules={[{ required: true, message: '请输入LLM模型名称' }]}
          >
            <Input placeholder="gpt-3.5-turbo" />
          </Form.Item>
          <Space>
            <Button icon={<ExperimentOutlined />} onClick={handleTestLLM}>
              测试LLM连接
            </Button>
          </Space>

          <Divider />

          <Title level={4}>TTS API配置</Title>
          <Form.Item
            name="ttsApiUrl"
            label="TTS API地址"
            rules={[{ required: true, message: '请输入TTS API地址' }]}
          >
            <Input placeholder="https://api.openai.com/v1/audio/speech" />
          </Form.Item>
          <Form.Item
            name="ttsApiKey"
            label="TTS API密钥"
            rules={[{ required: true, message: '请输入TTS API密钥' }]}
          >
            <Input.Password placeholder="请输入TTS API密钥" />
          </Form.Item>
          <Form.Item
            name="ttsVoice"
            label="TTS语音"
            rules={[{ required: true, message: '请输入TTS语音' }]}
          >
            <Input placeholder="alloy" />
          </Form.Item>
          <Space>
            <Button icon={<ExperimentOutlined />} onClick={handleTestTTS}>
              测试TTS连接
            </Button>
          </Space>
        </div>
      ),
    },
    {
      key: '2',
      label: '系统配置',
      children: (
        <div>
          <Title level={4}>RSS抓取配置</Title>
          <Form.Item
            name="rssFetchInterval"
            label="RSS抓取间隔(毫秒)"
            rules={[{ required: true, message: '请输入抓取间隔' }]}
          >
            <Input placeholder="3600000" />
          </Form.Item>
          <Form.Item
            name="newsRetentionHours"
            label="新闻保留时间(小时)"
            rules={[{ required: true, message: '请输入保留时间' }]}
          >
            <Input placeholder="24" />
          </Form.Item>

          <Divider />

          <Title level={4}>对话生成配置</Title>
          <Form.Item
            name="dialogueNewsCount"
            label="对话使用的新闻数量"
            rules={[{ required: true, message: '请输入新闻数量' }]}
          >
            <Input placeholder="5" />
          </Form.Item>
          <Form.Item
            name="dialogueRounds"
            label="对话轮次"
            rules={[{ required: true, message: '请输入对话轮次' }]}
          >
            <Input placeholder="8" />
          </Form.Item>
        </div>
      ),
    },
  ];

  return (
    <div className="settings">
      <Card className="custom-card">
        <Title level={2}>系统设置</Title>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            llmApiUrl: 'https://api.openai.com/v1/chat/completions',
            llmModel: 'gpt-3.5-turbo',
            ttsApiUrl: 'https://api.openai.com/v1/audio/speech',
            ttsVoice: 'alloy',
            rssFetchInterval: '3600000',
            newsRetentionHours: '24',
            dialogueNewsCount: '5',
            dialogueRounds: '8',
          }}
        >
          <Tabs items={items} />
          
          <Divider />
          
          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                icon={<SaveOutlined />}
                loading={loading}
              >
                保存设置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Settings; 