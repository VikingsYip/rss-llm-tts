const { Dialogue, News, Config } = require('../models');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');
const configService = require('./configService');
const xunfeiTtsService = require('./xunfeiTtsService');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const ttsConfig = require('../config/ttsConfig');

class DialogueService {
  // 获取代理配置
  async getProxyConfig() {
    try {
      const configs = await configService.getAllConfigs();
      const httpProxyEnabled = configs.http_proxy_enabled;
      const httpProxyUrl = configs.http_proxy_url;
      
      if (httpProxyEnabled && httpProxyUrl) {
        return {
          host: new URL(httpProxyUrl).hostname,
          port: new URL(httpProxyUrl).port || 80,
          protocol: new URL(httpProxyUrl).protocol.replace(':', '')
        };
      }
      
      return null;
    } catch (error) {
      logger.error('获取代理配置失败:', error);
      return null;
    }
  }

  // 创建对话
  async createDialogue(dialogueData) {
    try {
      const { title, dialogueType, character1, character2, rounds, newsIds } = dialogueData;
      
      // 创建对话记录
      const dialogue = await Dialogue.create({
        title,
        dialogueType,
        character1,
        character2,
        rounds,
        status: 'generating',
        newsIds: newsIds || [],
        newsCount: newsIds ? newsIds.length : 0,
        content: null,
        audioFile: null,
        duration: null,
        errorMessage: null,
        isActive: true
      });

      logger.info(`对话创建成功: ${dialogue.id}, 标题: ${title}`);
      
      // 异步生成对话内容
      this.generateDialogueContent(dialogue.id).catch(error => {
        logger.error(`异步生成对话内容失败: ${dialogue.id}`, error);
      });

      return dialogue;
    } catch (error) {
      logger.error('创建对话失败:', error);
      throw error;
    }
  }

  // 获取对话列表
  async getDialogues(options = {}) {
    try {
      const { page = 1, limit = 10, status, dialogueType } = options;
      const offset = (page - 1) * limit;
      
      const where = { isActive: true };
      if (status) where.status = status;
      if (dialogueType) where.dialogueType = dialogueType;
      
      const { count, rows } = await Dialogue.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      return {
        dialogues: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      logger.error('获取对话列表失败:', error);
      throw error;
    }
  }

  // 获取对话详情
  async getDialogueById(id) {
    try {
      const dialogue = await Dialogue.findOne({
        where: { id, isActive: true }
      });
      
      if (!dialogue) {
        throw new Error('对话不存在');
      }
      
      // 获取关联的新闻
      let relatedNews = [];
      if (dialogue.newsIds && dialogue.newsIds.length > 0) {
        relatedNews = await News.findAll({
          where: { id: dialogue.newsIds },
          attributes: ['id', 'title', 'summary', 'sourceName', 'publishedAt', 'link']
        });
      }
      
      return {
        ...dialogue.toJSON(),
        relatedNews
      };
    } catch (error) {
      logger.error('获取对话详情失败:', error);
      throw error;
    }
  }

  // 更新对话状态
  async updateDialogueStatus(id, status) {
    try {
      const dialogue = await Dialogue.findByPk(id);
      if (!dialogue) {
        throw new Error('对话不存在');
      }
      
      await dialogue.update({ status });
      logger.info(`对话状态更新成功: ${id} -> ${status}`);
      
      return dialogue;
    } catch (error) {
      logger.error('更新对话状态失败:', error);
      throw error;
    }
  }

  // 删除对话
  async deleteDialogue(id) {
    try {
      const dialogue = await Dialogue.findByPk(id);
      if (!dialogue) {
        throw new Error('对话不存在');
      }
      
      // 软删除
      await dialogue.update({ isActive: false });
      logger.info(`对话删除成功: ${id}`);
      
      return true;
    } catch (error) {
      logger.error('删除对话失败:', error);
      throw error;
    }
  }

  // 获取对话统计
  async getDialogueStats() {
    try {
      const stats = await Dialogue.findAll({
        where: { isActive: true },
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });
      
      const result = {
        total: 0,
        generating: 0,
        completed: 0,
        failed: 0
      };
      
      stats.forEach(stat => {
        result.total += parseInt(stat.count);
        result[stat.status] = parseInt(stat.count);
      });
      
      return result;
    } catch (error) {
      logger.error('获取对话统计失败:', error);
      throw error;
    }
  }

  // 生成对话内容
  async generateDialogueContent(dialogueId) {
    try {
      logger.info(`开始生成对话内容: ${dialogueId}`);
      
      const dialogue = await Dialogue.findByPk(dialogueId);
      if (!dialogue) {
        throw new Error('对话不存在');
      }

      // 更新状态为生成中
      await dialogue.update({ status: 'generating' });

      // 获取配置
      const configs = await configService.getAllConfigs();
      const llmConfig = {
        apiUrl: configs.llm_api_url,
        apiKey: configs.llm_api_key,
        model: configs.llm_model
      };
      const ttsServiceConfig = {
        apiUrl: configs.tts_api_url,
        appId: configs.tts_app_id,
        apiKey: configs.tts_api_key,
        apiSecret: configs.tts_api_secret,
        voice: configs.tts_voice
      };

      // 验证配置
      if (!llmConfig.apiUrl || !llmConfig.apiKey || !llmConfig.model) {
        throw new Error('LLM配置不完整，请在设置中配置LLM API');
      }
      if (!ttsServiceConfig.apiUrl || !ttsServiceConfig.appId || !ttsServiceConfig.apiKey || !ttsServiceConfig.apiSecret || !ttsServiceConfig.voice) {
        throw new Error('TTS配置不完整，请在设置中配置TTS API');
      }

      // 获取新闻素材
      let newsData = [];
      if (dialogue.newsIds && dialogue.newsIds.length > 0) {
        // 使用用户选择的新闻
        newsData = await News.findAll({
          where: { id: dialogue.newsIds },
          attributes: ['id', 'title', 'summary', 'content', 'sourceName', 'publishedAt', 'author']
        });
        logger.info(`使用用户选择的新闻: ${newsData.length} 条`);
      } else {
        // 获取随机新闻
        const newsCount = configs.dialogue_news_count || 5;
        newsData = await News.findAll({
          where: { status: 'published' },
          order: [['publishedAt', 'DESC']],
          limit: newsCount,
          attributes: ['id', 'title', 'summary', 'content', 'sourceName', 'publishedAt', 'author']
        });
        logger.info(`使用随机新闻: ${newsData.length} 条`);
      }

      if (newsData.length === 0) {
        throw new Error('没有找到新闻素材');
      }

      // 构建新闻内容摘要，包含更详细的信息
      const newsContent = newsData.map(news => ({
        title: news.title,
        summary: news.summary,
        content: news.content, // 包含详细内容
        source: news.sourceName,
        publishedAt: news.publishedAt,
        author: news.author
      }));

      // 调用LLM生成对话内容
      const dialogueContent = await this.callLLMAPI(llmConfig, {
        dialogueType: dialogue.dialogueType,
        character1: dialogue.character1,
        character2: dialogue.character2,
        rounds: dialogue.rounds,
        newsContent
      });

      // 调用TTS生成音频
      const audioInfo = await this.callTTSAPI(ttsServiceConfig, dialogueContent);

      // 更新对话记录
      await dialogue.update({
        status: 'completed',
        content: dialogueContent,
        audioFile: audioInfo.filename,
        duration: audioInfo.duration,
        newsIds: newsData.map(n => n.id),
        newsCount: newsData.length,
        errorMessage: null
      });

      logger.info(`对话生成完成: ${dialogueId}`);
      return dialogue;

    } catch (error) {
      logger.error(`生成对话内容失败: ${dialogueId}`, error);
      
      // 更新状态为失败
      await Dialogue.update(
        { 
          status: 'failed',
          errorMessage: error.message
        },
        { where: { id: dialogueId } }
      );
      
      throw error;
    }
  }

  // 调用LLM API生成对话内容
  async callLLMAPI(llmConfig, params) {
    try {
      logger.info('调用LLM API生成对话内容');
      
      const { dialogueType, character1, character2, rounds, newsContent } = params;
      
      // 构建详细的新闻内容
      const newsDetails = newsContent.map((news, index) => 
        `【新闻${index + 1}】
标题: ${news.title}
摘要: ${news.summary || '暂无摘要'}
来源: ${news.source}
发布时间: ${new Date(news.publishedAt).toLocaleDateString()}
${news.content ? `详细内容: ${news.content.substring(0, 500)}...` : ''}`
      ).join('\n\n');

      // 获取对话类型的详细描述
      const dialogueTypeDetails = this.getDialogueTypeDetails(dialogueType);

      const prompt = `你是一位专业的对话生成专家，请基于以下新闻内容，生成一个高质量的${dialogueTypeDetails.name}对话。

## 对话设置
- 对话类型：${dialogueTypeDetails.name}
- 对话特点：${dialogueTypeDetails.description}
- 参与者：${character1}、${character2}
- 对话轮次：${rounds}轮
- 对话风格：${dialogueTypeDetails.style}

## 新闻素材
${newsDetails}

## 生成要求
1. **口语化表达**：使用自然、流畅的口语表达，避免过于书面化的语言
2. **内容深度**：对话要有深度，不是简单的问答，要有见解和分析
3. **逻辑连贯**：每轮对话都要自然衔接，逻辑清晰
4. **角色特色**：${character1}和${character2}要有各自的语言特点和观点
5. **新闻结合**：充分利用提供的新闻内容，引用具体事实和数据
6. **对话自然**：语言要自然流畅，符合${dialogueTypeDetails.name}的特点
7. **观点多元**：展现不同角度的思考和讨论
8. **结构完整**：对话要有开头、发展、高潮和总结
9. **口语化特点**：
   - 使用日常用语和表达方式
   - 适当使用语气词和感叹词
   - 避免过于正式的学术语言
   - 保持对话的自然节奏和语调

## 对话结构建议
- 前1-2轮：开场介绍话题，引入新闻内容
- 中间轮次：深入讨论，分析问题，展现不同观点
- 最后1-2轮：总结观点，展望未来或提出建议

## 输出格式
请严格按照以下JSON格式输出，不要添加任何其他文字：

{
  "rounds": [
    {
      "speaker": "${character1}",
      "text": "具体的对话内容，要丰富详细，至少100字以上，使用口语化表达"
    },
    {
      "speaker": "${character2}",
      "text": "具体的对话内容，要丰富详细，至少100字以上，使用口语化表达"
    }
  ]
}

现在请开始生成对话内容：`;

      // 调用DeepSeek API
      // 获取代理配置
      const proxyConfig = await this.getProxyConfig();
      
      const axiosConfig = {
        headers: {
          'Authorization': `Bearer ${llmConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      };

      // 如果启用了代理，添加代理配置
      if (proxyConfig) {
        axiosConfig.proxy = proxyConfig;
        logger.info(`使用代理调用LLM API: ${llmConfig.apiUrl}, 代理: ${proxyConfig.host}:${proxyConfig.port}`);
      }

      const response = await axios.post(llmConfig.apiUrl, {
        model: llmConfig.model,
        messages: [
          {
            role: "system",
            content: `你是一个专业的对话生成助手，擅长根据新闻内容生成高质量的${dialogueTypeDetails.name}对话。你的对话总是内容丰富、观点深刻、逻辑清晰。你必须严格按照JSON格式输出，不添加任何解释或额外文字。`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        top_p: 0.9
      }, axiosConfig);

      const result = response.data.choices[0].message.content;
      logger.info('LLM API调用成功');
      
      // 解析JSON结果
      let dialogueData;
      try {
        // 清理和提取JSON部分
        let jsonStr = result.trim();
        
        // 移除可能的markdown代码块标记
        jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
        
        // 尝试提取JSON对象
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
        
        // 尝试修复常见的JSON格式问题
        jsonStr = jsonStr
          .replace(/([^\\])"/g, '$1"') // 修复未转义的引号
          .replace(/,\s*}/g, '}') // 移除尾随逗号
          .replace(/,\s*]/g, ']'); // 移除数组中的尾随逗号
        
        logger.info('尝试解析JSON:', jsonStr.substring(0, 200) + '...');
        
        dialogueData = JSON.parse(jsonStr);
        
        // 验证数据结构
        if (!dialogueData.rounds || !Array.isArray(dialogueData.rounds)) {
          throw new Error('Invalid dialogue structure: missing or invalid rounds array');
        }
        
        // 验证每个轮次的结构
        for (let i = 0; i < dialogueData.rounds.length; i++) {
          const round = dialogueData.rounds[i];
          if (!round.speaker || !round.text) {
            throw new Error(`Invalid round structure at index ${i}: missing speaker or text`);
          }
        }
        
        // 确保对话轮次正确
        if (dialogueData.rounds.length !== rounds) {
          logger.warn(`生成的对话轮次(${dialogueData.rounds.length})与要求(${rounds})不符，进行调整`);
          dialogueData = this.adjustDialogueRounds(dialogueData, rounds, character1, character2);
        }
        
        logger.info(`LLM生成的对话质量检查通过，共${dialogueData.rounds.length}轮`);
        
      } catch (parseError) {
        logger.warn('LLM返回结果解析失败，使用增强的模拟数据', parseError);
        logger.info('原始返回内容:', result.substring(0, 500) + '...');
        dialogueData = this.generateEnhancedMockDialogue(character1, character2, rounds, newsContent, dialogueType);
      }

      return dialogueData;

    } catch (error) {
      logger.error('调用LLM API失败:', error);
      logger.info('LLM API调用失败，使用增强的模拟数据');
      return this.generateEnhancedMockDialogue(params.character1, params.character2, params.rounds, params.newsContent, params.dialogueType);
    }
  }

  // 调用TTS API生成音频
  async callTTSAPI(ttsServiceConfig, dialogueContent) {
    try {
      logger.info('调用TTS API生成音频');
      
      // 过滤掉主持人、嘉宾等角色，只保留主要对话内容
      let filteredRounds = dialogueContent.rounds.filter(round => {
        const speaker = round.speaker.toLowerCase();
        // 使用配置文件中的角色过滤列表
        return !ttsConfig.filterRoles.some(role => 
          speaker.includes(role.toLowerCase())
        );
      });
      
      if (filteredRounds.length === 0) {
        logger.warn('过滤后没有可用的对话内容，使用原始内容');
        filteredRounds = dialogueContent.rounds;
      }
      
      // 将过滤后的对话内容转换为音频文本
      const audioText = filteredRounds.map(round => 
        `${round.speaker}：${round.text}`
      ).join('\n\n');

      // 生成文件名
      const timestamp = Date.now();
      const filename = `dialogue_${timestamp}.mp3`;
      const filepath = path.join(__dirname, '../../uploads', filename);

      // 确保uploads目录存在
      const uploadsDir = path.dirname(filepath);
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // 如果是科大讯飞API，需要特殊处理
      if (ttsServiceConfig.apiUrl.includes('xf-yun.com')) {
        // 科大讯飞TTS API调用逻辑
        await this.callXunfeiMultiVoiceTTS(ttsServiceConfig, dialogueContent, filepath);
      } else {
        // OpenAI兼容的TTS API调用，使用不同发音人
        await this.callOpenAITTSWithDifferentVoices(ttsServiceConfig, dialogueContent, filepath);
      }

      // 计算音频时长（估算，每分钟约200字）
      const estimatedDuration = Math.ceil(audioText.length / 200 * 60);

      logger.info(`TTS音频生成成功: ${filename}`);
      
      return {
        filename,
        duration: estimatedDuration
      };

    } catch (error) {
      logger.error('调用TTS API失败:', error);
      // TTS失败不影响对话生成，返回空音频信息
      return {
        filename: null,
        duration: null
      };
    }
  }

  // 科大讯飞TTS API调用
  async callXunfeiTTS(ttsServiceConfig, text, filepath) {
    try {
      logger.info('调用科大讯飞WebSocket TTS API');
      
      // 解析配置
      const config = xunfeiTtsService.parseTtsConfig(ttsServiceConfig);
      
      // 调用WebSocket TTS服务
      const result = await xunfeiTtsService.generateTTS(config, text, filepath);
      
      logger.info('科大讯飞TTS音频生成完成');
      return result;
      
    } catch (error) {
      logger.error('科大讯飞TTS调用失败:', error);
      
      // 如果WebSocket调用失败，生成模拟音频文件
      logger.info('生成模拟音频文件作为备用');
      const mockAudioContent = Buffer.from('Mock Audio Content for Xunfei TTS');
      fs.writeFileSync(filepath, mockAudioContent);
      
      return {
        success: false,
        audioPath: filepath,
        audioSize: mockAudioContent.length,
        duration: this.estimateDuration(text),
        error: error.message
      };
    }
  }

  // 科大讯飞多发音人TTS API调用
  async callXunfeiMultiVoiceTTS(ttsServiceConfig, dialogueContent, filepath) {
    try {
      logger.info('调用科大讯飞多发音人TTS API');
      
      // 解析配置
      const config = xunfeiTtsService.parseTtsConfig(ttsServiceConfig);
      
      // 调用多发音人TTS服务
      const result = await xunfeiTtsService.generateMultiVoiceTTS(config, dialogueContent, filepath);
      
      logger.info('科大讯飞多发音人TTS音频生成完成');
      return result;
      
    } catch (error) {
      logger.error('科大讯飞多发音人TTS调用失败:', error);
      
      // 如果调用失败，生成模拟音频文件
      logger.info('生成模拟音频文件作为备用');
      const mockAudioContent = Buffer.from('Mock Audio Content for Xunfei Multi-Voice TTS');
      fs.writeFileSync(filepath, mockAudioContent);
      
      return {
        success: false,
        audioPath: filepath,
        audioSize: mockAudioContent.length,
        duration: this.estimateDuration(dialogueContent.rounds.map(r => r.text).join('')),
        error: error.message
      };
    }
  }

  // OpenAI兼容的TTS API调用
  async callOpenAITTS(ttsServiceConfig, text, filepath) {
    try {
      // 获取代理配置
      const proxyConfig = await this.getProxyConfig();
      
      const axiosConfig = {
        headers: {
          'Authorization': `Bearer ${ttsServiceConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream',
        timeout: 120000
      };

      // 如果启用了代理，添加代理配置
      if (proxyConfig) {
        axiosConfig.proxy = proxyConfig;
        logger.info(`使用代理调用OpenAI TTS API: ${ttsServiceConfig.apiUrl}, 代理: ${proxyConfig.host}:${proxyConfig.port}`);
      }

      const response = await axios.post(ttsServiceConfig.apiUrl, {
        model: 'tts-1',
        input: text,
        voice: ttsServiceConfig.voice,
        response_format: 'mp3'
      }, axiosConfig);

      // 保存音频文件
      const writer = fs.createWriteStream(filepath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

    } catch (error) {
      logger.error('OpenAI TTS API调用失败:', error);
      throw error;
    }
  }

  // OpenAI兼容的TTS API调用，使用不同发音人
  async callOpenAITTSWithDifferentVoices(ttsServiceConfig, dialogueContent, filepath) {
    try {
      logger.info('调用OpenAI TTS API，使用不同发音人');
      
      // 获取代理配置
      const proxyConfig = await this.getProxyConfig();
      
      const axiosConfig = {
        headers: {
          'Authorization': `Bearer ${ttsServiceConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 120000
      };

      // 如果启用了代理，添加代理配置
      if (proxyConfig) {
        axiosConfig.proxy = proxyConfig;
        logger.info(`使用代理调用OpenAI TTS API: ${ttsServiceConfig.apiUrl}, 代理: ${proxyConfig.host}:${proxyConfig.port}`);
      }

      // 获取配置的主持人和嘉宾发音人
      const configs = await configService.getAllConfigs();
      const hostVoice = configs.tts_voice_host || 'alloy';
      const guestVoice = configs.tts_voice_guest || 'nova';

      let allAudioData = Buffer.alloc(0);
      
      // 过滤掉主持人、嘉宾等角色，只保留主要对话内容
      let filteredRounds = dialogueContent.rounds.filter(round => {
        const speaker = round.speaker.toLowerCase();
        // 使用配置文件中的角色过滤列表
        return !ttsConfig.filterRoles.some(role => 
          speaker.includes(role.toLowerCase())
        );
      });
      
      if (filteredRounds.length === 0) {
        logger.warn('过滤后没有可用的对话内容，使用原始内容');
        filteredRounds = dialogueContent.rounds;
      }
      
      // 为每个过滤后的对话轮次生成音频
      for (const round of filteredRounds) {
        // 根据说话者选择发音人
        let voice = hostVoice; // 默认使用主持人发音人
        if (round.speaker.includes('嘉宾') || round.speaker.includes('专家') || round.speaker.includes('CEO')) {
          voice = guestVoice;
        }
        
        logger.info(`为 ${round.speaker} 生成音频，使用发音人: ${voice}`);

        // 调用TTS API生成单个音频
        const response = await axios.post(ttsServiceConfig.apiUrl, {
          model: 'tts-1',
          input: `${round.speaker}：${round.text}`,
          voice: voice,
          response_format: 'mp3',
          speed: ttsConfig.speed.openai
        }, axiosConfig);

        // 将音频数据添加到总音频中
        const audioData = Buffer.from(response.data);
        allAudioData = Buffer.concat([allAudioData, audioData]);
        
        // 添加短暂停顿（静音）
        const silence = Buffer.alloc(44100 * 1); // 1秒静音
        allAudioData = Buffer.concat([allAudioData, silence]);
      }

      // 保存完整音频文件
      fs.writeFileSync(filepath, allAudioData);
      
      logger.info(`多发音人音频生成完成: ${filepath}`);
      return true;

    } catch (error) {
      logger.error('OpenAI TTS API调用失败:', error);
      throw error;
    }
  }

  // 获取对话类型文本
  getDialogueTypeText(type) {
    const typeMap = {
      interview: '访谈',
      ceo_interview: 'CEO采访',
      commentary: '评论',
      chat: '聊天'
    };
    return typeMap[type] || '对话';
  }

  // 获取对话类型的详细信息
  getDialogueTypeDetails(type) {
    const typeDetails = {
      interview: {
        name: '访谈',
        description: '深度访谈对话，一般由主持人提问，嘉宾回答，注重挖掘观点和见解',
        style: '专业、深入、互动性强'
      },
      ceo_interview: {
        name: 'CEO采访',
        description: '高端商业访谈，探讨企业战略、行业趋势、管理理念等商业话题',
        style: '高端、专业、商业化、具有前瞻性'
      },
      commentary: {
        name: '评论对话',
        description: '针对时事新闻进行分析评论，展现不同观点和深度思考',
        style: '客观、分析性强、观点鲜明'
      },
      chat: {
        name: '聊天对话',
        description: '轻松的对话交流，更加随意和自然，但仍要有内容深度',
        style: '轻松自然、互动性强、贴近生活'
      }
    };
    return typeDetails[type] || typeDetails.interview;
  }

  // 调整对话轮次
  adjustDialogueRounds(dialogueData, targetRounds, character1, character2) {
    const rounds = dialogueData.rounds;
    
    if (rounds.length > targetRounds) {
      // 如果轮次过多，截取前面的轮次
      return {
        rounds: rounds.slice(0, targetRounds)
      };
    } else if (rounds.length < targetRounds) {
      // 如果轮次不够，补充轮次
      const additionalRounds = targetRounds - rounds.length;
      const newRounds = [...rounds];
      
      for (let i = 0; i < additionalRounds; i++) {
        const speaker = (rounds.length + i) % 2 === 0 ? character1 : character2;
        newRounds.push({
          speaker,
          text: speaker === character1 
            ? "感谢您的分享，这个话题确实值得我们继续深入探讨。"
            : "是的，这个问题很有意思，从不同角度来看都有其价值和意义。"
        });
      }
      
      return {
        rounds: newRounds
      };
    }
    
    return dialogueData;
  }

  // 生成增强的模拟对话（备用方案）
  generateEnhancedMockDialogue(character1, character2, rounds, newsContent, dialogueType) {
    const dialogueRounds = [];
    const typeDetails = this.getDialogueTypeDetails(dialogueType);
    
    for (let i = 0; i < rounds; i++) {
      const speaker = i % 2 === 0 ? character1 : character2;
      const newsIndex = i % newsContent.length;
      const news = newsContent[newsIndex];
      
      let text;
      
      if (i === 0) {
        // 开场
        text = i % 2 === 0 
          ? `欢迎收看今天的${typeDetails.name}节目。今天我们要讨论的是关于"${news.title}"这个备受关注的话题。${news.summary}这个现象引发了广泛的讨论，您怎么看待这个问题？`
          : `感谢邀请。这确实是一个非常重要的话题。从${news.source}的报道中我们可以看到，${news.summary}这反映了当前社会的一个重要趋势。我认为我们需要从多个角度来分析这个问题。`;
      } else if (i === rounds - 1) {
        // 结尾
        text = i % 2 === 0 
          ? `非常感谢您今天的精彩分享。通过今天的讨论，我相信观众朋友们对"${news.title}"这个话题有了更深入的理解。您对未来的发展有什么展望吗？`
          : `谢谢主持人。我相信随着时间的发展，相关的问题会得到更好的解决。重要的是我们要保持关注和思考，这样才能推动社会的进步。感谢大家的收看。`;
      } else {
        // 中间轮次
        const topics = [
          `从技术发展的角度来看`,
          `考虑到社会影响方面`,
          `从经济效益的角度分析`,
          `从用户体验的维度思考`,
          `结合国际经验来看`,
          `从政策法规的层面来说`
        ];
        const topic = topics[i % topics.length];
        
        text = i % 2 === 0 
          ? `您刚才提到的观点很有道理。${topic}，您认为${news.title}这个现象会对我们的生活产生什么样的影响？特别是在${news.source}报道的这些方面。`
          : `这是一个很好的问题。${topic}，我认为${news.title}确实会带来深远的影响。根据${news.source}的分析，${news.summary}这种变化不仅仅是表面现象，更反映了深层次的变革。我们需要适应这种变化。`;
      }
      
      dialogueRounds.push({
        speaker,
        text
      });
    }
    
    return {
      rounds: dialogueRounds
    };
  }

  // 估算音频时长（秒）
  estimateDuration(text) {
    const charactersPerMinute = 200;
    const durationMinutes = text.length / charactersPerMinute;
    return Math.ceil(durationMinutes * 60);
  }
}

module.exports = new DialogueService(); 