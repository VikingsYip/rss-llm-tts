import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Space, 
  Divider, 
  Typography, 
  message, 
  Tabs,
  Spin,
  Alert,
  Switch
} from 'antd';
import { 
  SaveOutlined, 
  ExperimentOutlined,
  ReloadOutlined,
  SettingOutlined
} from '@ant-design/icons';

const { Title } = Typography;
const { TextArea } = Input;

const Settings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState({});
  const [initialized, setInitialized] = useState(false);

  // 获取配置
  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      
      if (data.success) {
        setConfigs(data.data);
        
        // 设置表单初始值
        const initialValues = {
          llmApiUrl: data.data.llm_api_url || 'https://api.deepseek.com/v1/chat/completions',
          llmApiKey: data.data.llm_api_key || '',
          llmModel: data.data.llm_model || 'deepseek-chat',
          ttsApiUrl: data.data.tts_api_url || 'wss://cbm01.cn-huabei-1.xf-yun.com/v1/private/mcd9m97e6',
          ttsAppId: data.data.tts_app_id || '',
          ttsApiKey: data.data.tts_api_key || '',
          ttsApiSecret: data.data.tts_api_secret || '',
          ttsVoice: data.data.tts_voice || 'x5_lingfeiyi_flow',
          ttsVoiceHost: data.data.tts_voice_host || 'alloy',
          ttsVoiceGuest: data.data.tts_voice_guest || 'nova',
          rssFetchInterval: data.data.rss_fetch_interval || 3600000,
          newsRetentionHours: data.data.news_retention_hours || 24,
          dialogueNewsCount: data.data.dialogue_news_count || 5,
          dialogueRounds: data.data.dialogue_rounds || 8,
          httpProxy: data.data.http_proxy || '',
          httpsProxy: data.data.https_proxy || '',
          noProxy: data.data.no_proxy || '',
          httpProxyEnabled: data.data.http_proxy_enabled || false,
          httpProxyUrl: data.data.http_proxy_url || '',
        };
        
        form.setFieldsValue(initialValues);
        setInitialized(true);
      } else {
        message.error('获取配置失败');
      }
    } catch (error) {
      console.error('获取配置失败:', error);
      message.error('获取配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时获取配置
  useEffect(() => {
    fetchConfigs();
  }, []);

  // 保存设置
  const handleSave = async (values) => {
    setSaving(true);
    try {
      const response = await fetch('/api/config/system', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();
      
      if (result.success) {
        message.success('设置保存成功');
        // 重新获取配置
        fetchConfigs();
      } else {
        message.error(`保存失败: ${result.message}`);
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      message.error('保存设置失败');
    } finally {
      setSaving(false);
    }
  };

  // 测试LLM连接
  const handleTestLLM = async () => {
    const values = form.getFieldsValue(['llmApiUrl', 'llmApiKey', 'llmModel']);
    
    if (!values.llmApiUrl || !values.llmApiKey || !values.llmModel) {
      message.error('请先填写LLM API配置');
      return;
    }

    message.loading('正在测试LLM连接...', 0);
    try {
      const response = await fetch('/api/config/test/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiUrl: values.llmApiUrl,
          apiKey: values.llmApiKey,
          model: values.llmModel,
        }),
      });

      const result = await response.json();
      message.destroy();
      
      if (result.success) {
        message.success(`LLM连接测试成功！响应时间: ${result.data.responseTime}ms`);
      } else {
        message.error(`LLM连接测试失败: ${result.message}`);
      }
    } catch (error) {
      message.destroy();
      console.error('测试LLM连接失败:', error);
      message.error('测试LLM连接失败');
    }
  };

  // 测试TTS连接
  const handleTestTTS = async () => {
    const values = form.getFieldsValue(['ttsApiUrl', 'ttsAppId', 'ttsApiKey', 'ttsApiSecret', 'ttsVoice']);
    
    if (!values.ttsApiUrl || !values.ttsAppId || !values.ttsApiKey || !values.ttsApiSecret || !values.ttsVoice) {
      message.error('请先填写完整的TTS API配置');
      return;
    }

    message.loading('正在测试TTS连接...', 0);
    try {
      const response = await fetch('/api/config/test/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiUrl: values.ttsApiUrl,
          appId: values.ttsAppId,
          apiKey: values.ttsApiKey,
          apiSecret: values.ttsApiSecret,
          voice: values.ttsVoice,
        }),
      });

      const result = await response.json();
      message.destroy();
      
      if (result.success) {
        message.success(`TTS连接测试成功！响应时间: ${result.data.responseTime}ms`);
      } else {
        message.error(`TTS连接测试失败: ${result.message}`);
      }
    } catch (error) {
      message.destroy();
      console.error('测试TTS连接失败:', error);
      message.error('测试TTS连接失败');
    }
  };

  // 重置为默认值
  const handleReset = async () => {
    try {
      const response = await fetch('/api/config/reset', {
        method: 'POST',
      });

      const result = await response.json();
      
      if (result.success) {
        message.success('配置已重置为默认值');
        // 重新获取配置
        fetchConfigs();
      } else {
        message.error(`重置失败: ${result.message}`);
      }
    } catch (error) {
      console.error('重置配置失败:', error);
      message.error('重置配置失败');
    }
  };

  const items = [
    {
      key: '1',
      label: 'API配置',
      children: (
        <div>
          <Alert
            message="API配置说明"
            description="DeepSeek提供强大的大语言模型服务，科大讯飞提供高质量的语音合成服务。请确保API密钥有效且有足够的配额。科大讯飞TTS需要WebSocket连接，请按照格式 'appId:apiKey:apiSecret' 配置TTS API密钥。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Title level={4}>DeepSeek LLM API配置</Title>
          <Form.Item
            name="llmApiUrl"
            label="LLM API地址"
            rules={[{ required: true, message: '请输入LLM API地址' }]}
          >
            <Input placeholder="https://api.deepseek.com/v1/chat/completions" />
          </Form.Item>
          <Form.Item
            name="llmApiKey"
            label="LLM API密钥"
            rules={[{ required: true, message: '请输入LLM API密钥' }]}
          >
            <Input.Password placeholder="请输入DeepSeek API密钥" />
          </Form.Item>
          <Form.Item
            name="llmModel"
            label="LLM模型"
            rules={[{ required: true, message: '请输入LLM模型名称' }]}
          >
            <Input placeholder="deepseek-chat" />
          </Form.Item>
          <Space>
            <Button icon={<ExperimentOutlined />} onClick={handleTestLLM}>
              测试LLM连接
            </Button>
          </Space>

          <Divider />

          <Title level={4}>科大讯飞 TTS API配置</Title>
          <Form.Item
            name="ttsApiUrl"
            label="TTS API地址"
            rules={[{ required: true, message: '请输入TTS API地址' }]}
          >
            <Input placeholder="wss://cbm01.cn-huabei-1.xf-yun.com/v1/private/mcd9m97e6" />
          </Form.Item>
          <Form.Item
            name="ttsAppId"
            label="TTS App ID"
            rules={[{ required: true, message: '请输入TTS App ID' }]}
          >
            <Input placeholder="请输入科大讯飞App ID" />
          </Form.Item>
          <Form.Item
            name="ttsApiKey"
            label="TTS API Key"
            rules={[{ required: true, message: '请输入TTS API Key' }]}
          >
            <Input.Password placeholder="请输入科大讯飞API Key" />
          </Form.Item>
          <Form.Item
            name="ttsApiSecret"
            label="TTS API Secret"
            rules={[{ required: true, message: '请输入TTS API Secret' }]}
          >
            <Input.Password placeholder="请输入科大讯飞API Secret" />
          </Form.Item>
          <Form.Item
            name="ttsVoice"
            label="TTS发音人"
            rules={[{ required: true, message: '请输入TTS发音人' }]}
            extra="常用发音人: x5_lingfeiyi_flow, xiaoyan, aisxping, asdf_viola 等"
          >
            <Input placeholder="x5_lingfeiyi_flow" />
          </Form.Item>
          <Form.Item
            name="ttsVoiceHost"
            label="TTS发音人（主持人）"
            rules={[{ required: true, message: '请输入主持人发音人' }]}
            extra="主持人音色，建议选择男声：alloy, echo, fable, onyx 等"
          >
            <Input placeholder="alloy" />
          </Form.Item>
          <Form.Item
            name="ttsVoiceGuest"
            label="TTS发音人（嘉宾）"
            rules={[{ required: true, message: '请输入嘉宾发音人' }]}
            extra="嘉宾音色，建议选择女声：nova, shimmer 等"
          >
            <Input placeholder="nova" />
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

          <Divider />

          <Title level={4}>网络代理配置（可选）</Title>
          <Alert
            message="代理配置说明"
            description="如果您的网络环境需要通过代理访问外网，请配置以下代理设置。如果不配置，系统将尝试直接连接。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form.Item
            name="httpProxyEnabled"
            label="启用HTTP代理"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="httpProxyUrl"
            label="HTTP代理地址"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!getFieldValue('httpProxyEnabled') || value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('启用HTTP代理时，代理地址不能为空'));
                },
              }),
            ]}
          >
            <Input placeholder="http://proxy.example.com:8080" />
          </Form.Item>
          <Form.Item
            name="httpProxy"
            label="HTTP代理地址（旧版兼容）"
          >
            <Input placeholder="http://proxy.example.com:8080" />
          </Form.Item>
          <Form.Item
            name="httpsProxy"
            label="HTTPS代理地址"
          >
            <Input placeholder="https://proxy.example.com:8080" />
          </Form.Item>
          <Form.Item
            name="noProxy"
            label="不使用代理的地址"
          >
            <Input placeholder="localhost,127.0.0.1,.example.com" />
          </Form.Item>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>正在加载配置...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={2} style={{ margin: 0 }}>
            <SettingOutlined /> 系统设置
          </Title>
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchConfigs}
              loading={loading}
            >
              刷新配置
            </Button>
            <Button 
              onClick={handleReset}
              danger
            >
              重置默认值
            </Button>
          </Space>
        </div>
        
        {initialized && (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
          >
            <Tabs items={items} />
            
            <Divider />
            
            <Form.Item>
              <Space>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  icon={<SaveOutlined />}
                  loading={saving}
                >
                  保存设置
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  );
};

export default Settings; 