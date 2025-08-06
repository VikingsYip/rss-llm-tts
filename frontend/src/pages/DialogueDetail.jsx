import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Typography, 
  Spin, 
  Tag, 
  Button, 
  Space, 
  Divider, 
  List, 
  message,
  Empty,
  Row,
  Col,
  Tooltip
} from 'antd';
import { 
  ArrowLeftOutlined, 
  PlayCircleOutlined, 
  DownloadOutlined,
  SyncOutlined,
  FileTextOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

const DialogueDetail = () => {
  const [dialogue, setDialogue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { id } = useParams();
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

  // 获取对话详情
  const fetchDialogueDetail = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dialogue/${id}`);
      const data = await response.json();
      
      if (data.success) {
        setDialogue(data.data);
      } else {
        message.error('获取对话详情失败');
      }
    } catch (error) {
      console.error('获取对话详情失败:', error);
      message.error('获取对话详情失败');
    } finally {
      setLoading(false);
    }
  };

  // 手动生成对话内容
  const handleGenerateContent = async () => {
    setGenerating(true);
    try {
      message.loading('正在生成对话内容...', 0);
      const response = await fetch(`/api/dialogue/${id}/generate`, {
        method: 'POST',
      });

      const result = await response.json();
      message.destroy();
      
      if (result.success) {
        message.success('对话内容生成完成');
        fetchDialogueDetail(); // 刷新详情
      } else {
        message.error(`生成失败: ${result.message}`);
      }
    } catch (error) {
      message.destroy();
      console.error('生成对话内容失败:', error);
      message.error('生成对话内容失败');
    } finally {
      setGenerating(false);
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

  // 解析对话内容
  const parseDialogueContent = () => {
    if (!dialogue?.content) return null;
    
    try {
      // 如果content已经是对象，直接返回
      if (typeof dialogue.content === 'object') {
        return dialogue.content;
      }
      
      // 如果content是字符串，尝试解析JSON
      if (typeof dialogue.content === 'string') {
        return JSON.parse(dialogue.content);
      }
      
      return null;
    } catch (error) {
      console.error('解析对话内容失败:', error);
      return null;
    }
  };

  // 格式化时间
  const formatTime = (time) => {
    return new Date(time).toLocaleString();
  };

  useEffect(() => {
    if (id) {
      fetchDialogueDetail();
    }
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!dialogue) {
    return (
      <div style={{ padding: '24px' }}>
        <Empty description="对话不存在" />
      </div>
    );
  }

  const dialogueContent = parseDialogueContent();

  return (
    <div style={{ padding: '24px' }}>
      {/* 面包屑导航 */}
      <div style={{ marginBottom: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/dialogues')}
        >
          返回对话列表
        </Button>
      </div>

      {/* 对话基本信息 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={16}>
            <Title level={3}>{dialogue.title}</Title>
            <Space size="large" style={{ marginBottom: 16 }}>
              <Tag color={typeMap[dialogue.dialogueType]?.color}>
                {typeMap[dialogue.dialogueType]?.text}
              </Tag>
              <Tag color={statusMap[dialogue.status]?.color}>
                {statusMap[dialogue.status]?.text}
              </Tag>
            </Space>
            <div>
              <Text type="secondary">
                <UserOutlined /> {dialogue.character1} & {dialogue.character2}
              </Text>
            </div>
          </Col>
          <Col span={8} style={{ textAlign: 'right' }}>
            <Space direction="vertical" size="small">
              <div>
                <Text type="secondary">轮次: {dialogue.rounds}</Text>
              </div>
              <div>
                <Text type="secondary">新闻数: {dialogue.newsCount}</Text>
              </div>
              {dialogue.duration && (
                <div>
                  <Text type="secondary">
                    <ClockCircleOutlined /> {dialogue.duration}秒
                  </Text>
                </div>
              )}
              <div>
                <Text type="secondary">
                  <CalendarOutlined /> {formatTime(dialogue.createdAt)}
                </Text>
              </div>
            </Space>
          </Col>
        </Row>

        {/* 操作按钮 */}
        <Divider />
        <Space>
          {dialogue.status === 'generating' && (
            <Button 
              type="primary" 
              icon={<SyncOutlined />}
              onClick={handleGenerateContent}
              loading={generating}
            >
              手动生成内容
            </Button>
          )}
          {dialogue.audioFile && dialogue.status === 'completed' && (
            <>
              <Button 
                icon={<PlayCircleOutlined />}
                onClick={() => handlePlayAudio(dialogue.audioFile)}
              >
                播放音频
              </Button>
              <Button 
                icon={<DownloadOutlined />}
                onClick={() => handleDownloadAudio(dialogue.audioFile)}
              >
                下载音频
              </Button>
            </>
          )}
        </Space>
      </Card>

      {/* 对话内容 */}
      {dialogueContent ? (
        <Card title="对话内容" style={{ marginBottom: 16 }}>
          {dialogueContent.summary && (
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 6 }}>
              <Text strong>对话摘要：</Text>
              <Paragraph style={{ margin: '8px 0 0 0' }}>
                {dialogueContent.summary}
              </Paragraph>
            </div>
          )}
          
          <List
            dataSource={dialogueContent.rounds || []}
            renderItem={(round, index) => (
              <List.Item style={{ border: 'none', padding: '12px 0' }}>
                <div style={{ width: '100%' }}>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong style={{ color: '#1890ff' }}>
                      第{index + 1}轮
                    </Text>
                  </div>
                  <div style={{ 
                    padding: '12px 16px',
                    backgroundColor: round.speaker === dialogue.character1 ? '#e6f7ff' : '#f6ffed',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${round.speaker === dialogue.character1 ? '#1890ff' : '#52c41a'}`
                  }}>
                    <div style={{ marginBottom: 8 }}>
                      <Text strong style={{ 
                        color: round.speaker === dialogue.character1 ? '#1890ff' : '#52c41a',
                        fontSize: '14px'
                      }}>
                        {round.speaker}：
                      </Text>
                    </div>
                    <div style={{ lineHeight: '1.6', fontSize: '14px' }}>
                      <Text>{round.text}</Text>
                    </div>
                  </div>
                </div>
              </List.Item>
            )}
          />
        </Card>
      ) : (
        <Card title="对话内容">
          {dialogue.status === 'generating' ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">正在生成对话内容，请稍候...</Text>
              </div>
            </div>
          ) : dialogue.status === 'failed' ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Empty 
                description={
                  <div>
                    <div>对话内容生成失败</div>
                    {dialogue.errorMessage && (
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        错误信息: {dialogue.errorMessage}
                      </Text>
                    )}
                  </div>
                }
              />
            </div>
          ) : (
            <Empty description="暂无对话内容" />
          )}
        </Card>
      )}

      {/* 相关新闻 */}
      {dialogue.relatedNews && dialogue.relatedNews.length > 0 && (
        <Card title="相关新闻" extra={<FileTextOutlined />}>
          <List
            dataSource={dialogue.relatedNews}
            renderItem={(news) => (
              <List.Item>
                <div style={{ width: '100%' }}>
                  <div style={{ marginBottom: 4 }}>
                    <Text strong>{news.title}</Text>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <Text type="secondary">{news.summary}</Text>
                  </div>
                  <div>
                    <Space size="small">
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        来源: {news.sourceName}
                      </Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        时间: {formatTime(news.publishedAt)}
                      </Text>
                    </Space>
                  </div>
                </div>
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
};

export default DialogueDetail; 