import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Divider,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Switch,
  Tabs,
  Typography,
  message,
} from 'antd';
import {
  ClockCircleOutlined,
  ExperimentOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  SendOutlined,
  SettingOutlined,
  WechatOutlined,
} from '@ant-design/icons';

const { Title } = Typography;

const defaultDailyTaskConfig = {
  enabled: false,
  executionTime: '09:00',
  host: '叶总',
  guest: '甲方视觉CIO庞总',
  rounds: 10,
  pushToWeChat: false,
};

const ttsProviderOptions = [
  { label: 'Edge (Recommended)', value: 'edge' },
  { label: 'OpenAI', value: 'openai' },
];

const edgeVoiceOptions = [
  { label: '晓晓 - zh-CN-XiaoxiaoNeural', value: 'zh-CN-XiaoxiaoNeural' },
  { label: '云希 - zh-CN-YunxiNeural', value: 'zh-CN-YunxiNeural' },
  { label: '云扬 - zh-CN-YunyangNeural', value: 'zh-CN-YunyangNeural' },
  { label: '晓伊 - zh-CN-XiaoyiNeural', value: 'zh-CN-XiaoyiNeural' },
  { label: '晓辰 - zh-CN-XiaochenNeural', value: 'zh-CN-XiaochenNeural' },
  { label: '晓涵 - zh-CN-XiaohanNeural', value: 'zh-CN-XiaohanNeural' },
  { label: '晓墨 - zh-CN-XiaomoNeural', value: 'zh-CN-XiaomoNeural' },
  { label: '晓秋 - zh-CN-XiaoqiuNeural', value: 'zh-CN-XiaoqiuNeural' },
  { label: '晓睿 - zh-CN-XiaoruiNeural', value: 'zh-CN-XiaoruiNeural' },
  { label: '晓双 - zh-CN-XiaoshuangNeural', value: 'zh-CN-XiaoshuangNeural' },
  { label: '晓颜 - zh-CN-XiaoyanNeural', value: 'zh-CN-XiaoyanNeural' },
  { label: '云夏 - zh-CN-YunxiaNeural', value: 'zh-CN-YunxiaNeural' },
  { label: '云野 - zh-CN-YunyeNeural', value: 'zh-CN-YunyeNeural' },
];

const Settings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [wechatConfig, setWechatConfig] = useState({
    appId: '',
    appSecret: '',
    token: '',
    encodingAESKey: '',
    templateId: '',
    userOpenId: '',
    enabled: false,
  });
  const [wechatSaving, setWechatSaving] = useState(false);
  const [dailyTaskConfig, setDailyTaskConfig] = useState(defaultDailyTaskConfig);
  const [dailyTaskSaving, setDailyTaskSaving] = useState(false);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/config');
      const data = await response.json();

      if (!data.success) {
        message.error('获取配置失败');
        return;
      }

      form.setFieldsValue({
        llmApiUrl: data.data.llm_api_url || 'https://api.deepseek.com/v1/chat/completions',
        llmApiKey: data.data.llm_api_key || '',
        llmModel: data.data.llm_model || 'deepseek-chat',
        ttsProvider: data.data.tts_provider || 'edge',
        ttsApiUrl: data.data.tts_api_url || '',
        ttsApiKey: data.data.tts_api_key || '',
        ttsApiSecret: data.data.tts_api_secret || '',
        ttsVoice: data.data.tts_voice || 'zh-CN-XiaoxiaoNeural',
        ttsVoiceHost: data.data.tts_voice_host || 'zh-CN-YunxiNeural',
        ttsVoiceGuest: data.data.tts_voice_guest || 'zh-CN-XiaoxiaoNeural',
        ttsEnabled: data.data.tts_enabled !== 'false',
        rssFetchInterval: data.data.rss_fetch_interval || 3600000,
        newsRetentionHours: data.data.news_retention_hours || 24,
        dialogueNewsCount: data.data.dialogue_news_count || 5,
        dialogueRounds: data.data.dialogue_rounds || 8,
        httpProxy: data.data.http_proxy || '',
        httpsProxy: data.data.https_proxy || '',
        noProxy: data.data.no_proxy || '',
        httpProxyEnabled: data.data.http_proxy_enabled === 'true',
        httpProxyUrl: data.data.http_proxy_url || '',
      });
      setInitialized(true);
    } catch (error) {
      console.error('获取配置失败:', error);
      message.error('获取配置失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchWechatConfig = async () => {
    try {
      const response = await fetch('/api/wechat-mp/config');
      const data = await response.json();
      if (!data.success) {
        return;
      }
      setWechatConfig({
        appId: data.data.appId || '',
        appSecret: data.data.appSecret || '',
        token: data.data.token || '',
        encodingAESKey: data.data.encodingAESKey || '',
        templateId: data.data.templateId || '',
        userOpenId: data.data.userOpenId || '',
        enabled: data.data.enabled || false,
      });
    } catch (error) {
      console.error('获取微信公众号配置失败:', error);
    }
  };

  const fetchDailyTaskConfig = async () => {
    try {
      const response = await fetch('/api/daily-task/config');
      const data = await response.json();
      if (data.success) {
        setDailyTaskConfig({
          ...defaultDailyTaskConfig,
          ...data.data,
        });
      }
    } catch (error) {
      console.error('获取每日任务配置失败:', error);
    }
  };

  useEffect(() => {
    fetchConfigs();
    fetchWechatConfig();
    fetchDailyTaskConfig();
  }, []);

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const saveValues = {
        ...values,
        ttsEnabled: values.ttsEnabled ? 'true' : 'false',
        httpProxyEnabled: values.httpProxyEnabled ? 'true' : 'false',
      };

      const response = await fetch('/api/config/system', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(saveValues),
      });

      const result = await response.json();
      if (result.success) {
        message.success('设置保存成功');
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

  const handleTestLLM = async () => {
    message.loading('正在测试 LLM 连接...', 0);
    try {
      const response = await fetch('/api/config/test/llm', {
        method: 'POST',
      });
      const result = await response.json();
      message.destroy();
      if (result.success && result.data?.success) {
        message.success('LLM 连接测试成功');
      } else {
        message.error(`LLM 连接测试失败: ${result.data?.message || result.message}`);
      }
    } catch (error) {
      message.destroy();
      console.error('测试 LLM 连接失败:', error);
      message.error('测试 LLM 连接失败');
    }
  };

  const handleTestTTS = async () => {
    const values = form.getFieldsValue(['ttsProvider', 'ttsVoice']);
    if (!values.ttsProvider || !values.ttsVoice) {
      message.error('请先填写完整的 TTS 配置');
      return;
    }

    message.loading('正在测试 TTS 连接...', 0);
    try {
      const response = await fetch('/api/config/test/tts', {
        method: 'POST',
      });
      const result = await response.json();
      message.destroy();
      if (result.success && result.data?.success) {
        message.success('TTS 连接测试成功');
      } else {
        message.error(`TTS 连接测试失败: ${result.data?.message || result.message}`);
      }
    } catch (error) {
      message.destroy();
      console.error('测试 TTS 连接失败:', error);
      message.error('测试 TTS 连接失败');
    }
  };

  const handleTestProxy = async () => {
    const values = form.getFieldsValue(['httpProxyEnabled', 'httpProxyUrl', 'httpProxy', 'httpsProxy', 'noProxy']);
    if (!values.httpProxyEnabled) {
      message.warning('请先启用 HTTP 代理');
      return;
    }

    const proxyUrl = values.httpProxyUrl || values.httpProxy;
    if (!proxyUrl) {
      message.error('请先填写代理地址');
      return;
    }

    message.loading('正在测试代理连接...', 0);
    try {
      const response = await fetch('/api/config/test/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proxyUrl,
          httpsProxy: values.httpsProxy,
          noProxy: values.noProxy,
        }),
      });
      const result = await response.json();
      message.destroy();
      if (result.success && result.data?.success) {
        message.success('代理连接测试成功');
      } else {
        message.error(`代理连接测试失败: ${result.data?.message || result.message}`);
      }
    } catch (error) {
      message.destroy();
      console.error('测试代理连接失败:', error);
      message.error('测试代理连接失败');
    }
  };

  const handleReset = async () => {
    try {
      const response = await fetch('/api/config/reset', {
        method: 'POST',
      });
      const result = await response.json();
      if (result.success) {
        message.success('配置已重置为默认值');
        fetchConfigs();
      } else {
        message.error(`重置失败: ${result.message}`);
      }
    } catch (error) {
      console.error('重置配置失败:', error);
      message.error('重置配置失败');
    }
  };

  const handleWechatSave = async () => {
    setWechatSaving(true);
    try {
      const response = await fetch('/api/wechat-mp/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wechatConfig),
      });
      const data = await response.json();
      if (data.success) {
        message.success('微信公众号配置保存成功');
      } else {
        message.error(`保存失败: ${data.message}`);
      }
    } catch (error) {
      console.error('保存微信公众号配置失败:', error);
      message.error('保存失败');
    } finally {
      setWechatSaving(false);
    }
  };

  const handleWechatTest = async () => {
    try {
      const response = await fetch('/api/wechat-mp/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: '测试消息',
          content: '这是一条测试消息，用于验证微信公众号配置是否正确。',
        }),
      });
      const data = await response.json();
      if (data.success) {
        message.success('测试消息发送成功');
      } else {
        message.error(`发送失败: ${data.message}`);
      }
    } catch (error) {
      console.error('测试发送失败:', error);
      message.error('发送失败');
    }
  };

  const handleDailyTaskSave = async () => {
    setDailyTaskSaving(true);
    try {
      const response = await fetch('/api/daily-task/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dailyTaskConfig),
      });
      const data = await response.json();
      if (data.success) {
        message.success('每日任务配置保存成功');
      } else {
        message.error(`保存失败: ${data.message}`);
      }
    } catch (error) {
      console.error('保存每日任务配置失败:', error);
      message.error('保存失败');
    } finally {
      setDailyTaskSaving(false);
    }
  };

  const handleDailyTaskTrigger = async () => {
    try {
      const response = await fetch('/api/daily-task/trigger', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        message.success('每日任务已触发');
      } else {
        message.error(`触发失败: ${data.message}`);
      }
    } catch (error) {
      console.error('触发每日任务失败:', error);
      message.error('触发失败');
    }
  };

  const items = [
    {
      key: 'api',
      label: 'API 配置',
      children: (
        <div>
          <Alert
            message="API 配置说明"
            description="DeepSeek 用于生成对话内容。TTS 现支持 Edge 和 OpenAI 两种 provider，当前推荐直接使用 Edge voices。只有在切换到 OpenAI provider 时，才需要填写 TTS API URL 和 API Key。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Title level={4}>DeepSeek LLM 配置</Title>
          <Form.Item
            name="llmApiUrl"
            label="LLM API 地址"
            rules={[{ required: true, message: '请输入 LLM API 地址' }]}
          >
            <Input placeholder="https://api.deepseek.com/v1/chat/completions" />
          </Form.Item>
          <Form.Item
            name="llmApiKey"
            label="LLM API Key"
            rules={[{ required: true, message: '请输入 LLM API Key' }]}
          >
            <Input.Password placeholder="请输入 DeepSeek API Key" />
          </Form.Item>
          <Form.Item
            name="llmModel"
            label="LLM 模型"
            rules={[{ required: true, message: '请输入 LLM 模型名称' }]}
          >
            <Input placeholder="deepseek-chat" />
          </Form.Item>
          <Space>
            <Button icon={<ExperimentOutlined />} onClick={handleTestLLM}>
              测试 LLM 连接
            </Button>
          </Space>

          <Divider />

          <Title level={4}>TTS 配置</Title>
          <Form.Item
            name="ttsEnabled"
            label="启用 TTS"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) =>
              prev.ttsEnabled !== curr.ttsEnabled || prev.ttsProvider !== curr.ttsProvider
            }
          >
            {() => {
              const enabled = form.getFieldValue('ttsEnabled');
              const provider = form.getFieldValue('ttsProvider') || 'edge';
              if (enabled === false) {
                return null;
              }

              return (
                <>
                  <Form.Item
                    name="ttsProvider"
                    label="TTS Provider"
                    rules={[{ required: true, message: '请选择 TTS Provider' }]}
                  >
                    <Select options={ttsProviderOptions} />
                  </Form.Item>

                  {provider === 'openai' && (
                    <>
                      <Form.Item
                        name="ttsApiUrl"
                        label="TTS API 地址"
                        rules={[{ required: true, message: '请输入 TTS API 地址' }]}
                      >
                        <Input placeholder="https://api.openai.com/v1/audio/speech" />
                      </Form.Item>
                      <Form.Item
                        name="ttsApiKey"
                        label="TTS API Key"
                        rules={[{ required: true, message: '请输入 TTS API Key' }]}
                      >
                        <Input.Password placeholder="请输入 OpenAI TTS API Key" />
                      </Form.Item>
                      <Form.Item
                        name="ttsApiSecret"
                        label="TTS API Secret"
                      >
                        <Input.Password placeholder="通常留空即可" />
                      </Form.Item>
                    </>
                  )}

                  {provider === 'edge' && (
                    <Alert
                      message="Edge provider 已启用"
                      description="Edge TTS 默认走内置 WebSocket 通道，不需要额外的 App ID、API Secret 或专用网关地址。"
                      type="success"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                  )}

                  <Form.Item
                    name="ttsVoice"
                    label="默认发音人"
                    rules={[{ required: true, message: '请输入默认发音人' }]}
                    extra="常用 Edge 发音人：zh-CN-XiaoxiaoNeural、zh-CN-YunxiNeural"
                  >
                    <Select
                      showSearch
                      options={edgeVoiceOptions}
                      placeholder="请选择默认发音人"
                      optionFilterProp="label"
                    />
                  </Form.Item>
                  <Form.Item
                    name="ttsVoiceHost"
                    label="主持人发音人"
                    rules={[{ required: true, message: '请输入主持人发音人' }]}
                    extra="推荐：zh-CN-YunxiNeural"
                  >
                    <Select
                      showSearch
                      options={edgeVoiceOptions}
                      placeholder="请选择主持人发音人"
                      optionFilterProp="label"
                    />
                  </Form.Item>
                  <Form.Item
                    name="ttsVoiceGuest"
                    label="嘉宾发音人"
                    rules={[{ required: true, message: '请输入嘉宾发音人' }]}
                    extra="推荐：zh-CN-XiaoxiaoNeural"
                  >
                    <Select
                      showSearch
                      options={edgeVoiceOptions}
                      placeholder="请选择嘉宾发音人"
                      optionFilterProp="label"
                    />
                  </Form.Item>
                  <Space>
                    <Button icon={<ExperimentOutlined />} onClick={handleTestTTS}>
                      测试 TTS 连接
                    </Button>
                  </Space>
                </>
              );
            }}
          </Form.Item>
        </div>
      ),
    },
    {
      key: 'system',
      label: '系统配置',
      children: (
        <div>
          <Title level={4}>RSS 抓取配置</Title>
          <Form.Item
            name="rssFetchInterval"
            label="RSS 抓取间隔（毫秒）"
            rules={[{ required: true, message: '请输入抓取间隔' }]}
          >
            <Input placeholder="3600000" />
          </Form.Item>
          <Form.Item
            name="newsRetentionHours"
            label="新闻保留时长（小时）"
            rules={[{ required: true, message: '请输入保留时长' }]}
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
            description="如果当前网络环境需要代理才能访问外网，请填写以下代理设置；不需要时保持为空即可。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form.Item
            name="httpProxyEnabled"
            label="启用 HTTP 代理"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="httpProxyUrl"
            label="HTTP 代理地址"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!getFieldValue('httpProxyEnabled') || value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('启用 HTTP 代理时，代理地址不能为空'));
                },
              }),
            ]}
          >
            <Input placeholder="http://proxy.example.com:8080" />
          </Form.Item>
          <Form.Item
            name="httpProxy"
            label="HTTP 代理地址（旧版兼容）"
          >
            <Input placeholder="http://proxy.example.com:8080" />
          </Form.Item>
          <Form.Item
            name="httpsProxy"
            label="HTTPS 代理地址"
          >
            <Input placeholder="https://proxy.example.com:8080" />
          </Form.Item>
          <Form.Item
            name="noProxy"
            label="不使用代理的地址"
          >
            <Input placeholder="localhost,127.0.0.1,.example.com" />
          </Form.Item>
          <Space>
            <Button icon={<ExperimentOutlined />} onClick={handleTestProxy}>
              测试代理连接
            </Button>
          </Space>
        </div>
      ),
    },
    {
      key: 'wechat',
      label: <span><WechatOutlined /> 微信公众号</span>,
      children: (
        <div>
          <Alert
            message="微信公众号配置说明"
            description="配置完成后，可将对话内容推送到微信公众号。回调地址格式为 http://your-domain/api/wechat-mp/callback。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item label="启用微信公众号推送">
            <Switch
              checked={wechatConfig.enabled}
              onChange={(checked) => setWechatConfig({ ...wechatConfig, enabled: checked })}
            />
          </Form.Item>

          <Title level={4}>公众号基本信息</Title>
          <Form.Item label="AppID">
            <Input
              placeholder="请输入微信公众号 AppID"
              value={wechatConfig.appId}
              onChange={(e) => setWechatConfig({ ...wechatConfig, appId: e.target.value })}
            />
          </Form.Item>
          <Form.Item label="AppSecret">
            <Input
              placeholder="请输入微信公众号 AppSecret"
              value={wechatConfig.appSecret}
              onChange={(e) => setWechatConfig({ ...wechatConfig, appSecret: e.target.value })}
            />
          </Form.Item>

          <Divider />

          <Title level={4}>服务器配置</Title>
          <Form.Item label="Token">
            <Input
              placeholder="请输入微信公众号 Token"
              value={wechatConfig.token}
              onChange={(e) => setWechatConfig({ ...wechatConfig, token: e.target.value })}
            />
          </Form.Item>
          <Form.Item label="EncodingAESKey">
            <Input
              placeholder="可选"
              value={wechatConfig.encodingAESKey}
              onChange={(e) => setWechatConfig({ ...wechatConfig, encodingAESKey: e.target.value })}
            />
          </Form.Item>

          <Divider />

          <Title level={4}>消息推送配置</Title>
          <Form.Item label="模板消息 ID">
            <Input
              placeholder="请输入模板消息 ID"
              value={wechatConfig.templateId}
              onChange={(e) => setWechatConfig({ ...wechatConfig, templateId: e.target.value })}
            />
          </Form.Item>
          <Form.Item label="用户 OpenID">
            <Input
              placeholder="请输入接收通知的用户 OpenID"
              value={wechatConfig.userOpenId}
              onChange={(e) => setWechatConfig({ ...wechatConfig, userOpenId: e.target.value })}
            />
          </Form.Item>

          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleWechatSave}
              loading={wechatSaving}
            >
              保存配置
            </Button>
            <Button
              icon={<SendOutlined />}
              onClick={handleWechatTest}
              disabled={!wechatConfig.enabled}
            >
              测试发送
            </Button>
          </Space>
        </div>
      ),
    },
    {
      key: 'daily-task',
      label: <span><ClockCircleOutlined /> 每日任务</span>,
      children: (
        <div>
          <Alert
            message="每日任务说明"
            description="每日任务会根据当天收藏的文章自动生成对话，并可选择推送到微信公众号。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item label="启用每日任务">
            <Switch
              checked={dailyTaskConfig.enabled}
              onChange={(checked) => setDailyTaskConfig({ ...dailyTaskConfig, enabled: checked })}
            />
          </Form.Item>
          <Form.Item label="执行时间">
            <Input
              placeholder="09:00"
              value={dailyTaskConfig.executionTime}
              onChange={(e) => setDailyTaskConfig({ ...dailyTaskConfig, executionTime: e.target.value })}
              style={{ width: 150 }}
            />
          </Form.Item>
          <Form.Item label="主持人">
            <Input
              placeholder="叶总"
              value={dailyTaskConfig.host}
              onChange={(e) => setDailyTaskConfig({ ...dailyTaskConfig, host: e.target.value })}
              style={{ width: 200 }}
            />
          </Form.Item>
          <Form.Item label="嘉宾">
            <Input
              placeholder="甲方视觉CIO庞总"
              value={dailyTaskConfig.guest}
              onChange={(e) => setDailyTaskConfig({ ...dailyTaskConfig, guest: e.target.value })}
              style={{ width: 300 }}
            />
          </Form.Item>
          <Form.Item label="对话轮次">
            <Input
              type="number"
              placeholder="10"
              value={dailyTaskConfig.rounds}
              onChange={(e) =>
                setDailyTaskConfig({ ...dailyTaskConfig, rounds: parseInt(e.target.value, 10) || 10 })
              }
              style={{ width: 100 }}
            />
          </Form.Item>
          <Form.Item label="推送到微信公众号">
            <Switch
              checked={dailyTaskConfig.pushToWeChat}
              onChange={(checked) => setDailyTaskConfig({ ...dailyTaskConfig, pushToWeChat: checked })}
              disabled={!dailyTaskConfig.enabled}
            />
          </Form.Item>

          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleDailyTaskSave}
              loading={dailyTaskSaving}
            >
              保存配置
            </Button>
            <Button
              icon={<PlayCircleOutlined />}
              onClick={handleDailyTaskTrigger}
              disabled={!dailyTaskConfig.enabled}
            >
              手动触发
            </Button>
          </Space>
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
