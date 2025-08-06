const llmService = require('../services/llmService');
const ttsService = require('../services/ttsService');
const { Dialogue } = require('../models');
const logger = require('../utils/logger');

class DialogueController {
  // 生成对话
  async generateDialogue(req, res) {
    try {
      const {
        dialogueType = 'interview',
        character1 = '主持人',
        character2 = '嘉宾',
        rounds = 8,
        newsCount = 5
      } = req.body;

      // 创建对话记录
      const dialogue = await Dialogue.create({
        title: `${character1}与${character2}的对话`,
        content: '[]',
        dialogueType,
        character1,
        character2,
        rounds,
        newsCount,
        status: 'generating'
      });

      // 异步生成对话内容
      this.generateDialogueAsync(dialogue.id, {
        dialogueType,
        character1,
        character2,
        rounds,
        newsCount
      });

      res.json({
        success: true,
        message: '对话生成已开始',
        data: {
          id: dialogue.id,
          status: 'generating'
        }
      });
    } catch (error) {
      logger.error('生成对话失败:', error);
      res.status(500).json({
        success: false,
        message: '生成对话失败',
        error: error.message
      });
    }
  }

  // 异步生成对话
  async generateDialogueAsync(dialogueId, params) {
    try {
      // 生成对话内容
      const result = await llmService.generateDialogue(params);

      // 更新对话记录
      await Dialogue.update({
        title: result.title,
        content: JSON.stringify(result.content),
        status: 'completed'
      }, {
        where: { id: dialogueId }
      });

      logger.info(`对话生成完成: ${dialogueId}`);
    } catch (error) {
      logger.error(`对话生成失败: ${dialogueId}`, error);
      
      // 更新状态为失败
      await Dialogue.update({
        status: 'failed'
      }, {
        where: { id: dialogueId }
      });
    }
  }

  // 获取对话列表
  async getDialogues(req, res) {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const offset = (page - 1) * limit;
      const where = {};

      if (status) {
        where.status = status;
      }

      const { count, rows } = await Dialogue.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          dialogues: rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            pages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      logger.error('获取对话列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取对话列表失败',
        error: error.message
      });
    }
  }

  // 获取对话详情
  async getDialogueDetail(req, res) {
    try {
      const { id } = req.params;

      const dialogue = await Dialogue.findByPk(id);
      if (!dialogue) {
        return res.status(404).json({
          success: false,
          message: '对话不存在'
        });
      }

      // 解析对话内容
      let content = [];
      try {
        content = JSON.parse(dialogue.content);
      } catch (error) {
        logger.error('解析对话内容失败:', error);
      }

      res.json({
        success: true,
        data: {
          ...dialogue.toJSON(),
          content
        }
      });
    } catch (error) {
      logger.error('获取对话详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取对话详情失败',
        error: error.message
      });
    }
  }

  // 生成语音
  async generateSpeech(req, res) {
    try {
      const { id } = req.params;

      const dialogue = await Dialogue.findByPk(id);
      if (!dialogue) {
        return res.status(404).json({
          success: false,
          message: '对话不存在'
        });
      }

      if (dialogue.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: '对话尚未生成完成'
        });
      }

      // 解析对话内容
      let content = [];
      try {
        content = JSON.parse(dialogue.content);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: '对话内容格式错误'
        });
      }

      // 异步生成语音
      this.generateSpeechAsync(dialogue.id, content, dialogue.character1, dialogue.character2);

      res.json({
        success: true,
        message: '语音生成已开始',
        data: {
          id: dialogue.id,
          status: 'generating'
        }
      });
    } catch (error) {
      logger.error('生成语音失败:', error);
      res.status(500).json({
        success: false,
        message: '生成语音失败',
        error: error.message
      });
    }
  }

  // 异步生成语音
  async generateSpeechAsync(dialogueId, content, character1, character2) {
    try {
      // 为对话内容添加角色信息
      const dialogueWithRoles = content.map(turn => ({
        ...turn,
        character1,
        character2
      }));

      // 生成语音文件
      const result = await ttsService.generateDialogueSpeech(dialogueWithRoles, dialogueId);

      // 更新对话记录
      await Dialogue.update({
        audioFile: result.filename,
        duration: result.duration
      }, {
        where: { id: dialogueId }
      });

      logger.info(`语音生成完成: ${dialogueId}`);
    } catch (error) {
      logger.error(`语音生成失败: ${dialogueId}`, error);
    }
  }

  // 删除对话
  async deleteDialogue(req, res) {
    try {
      const { id } = req.params;

      const dialogue = await Dialogue.findByPk(id);
      if (!dialogue) {
        return res.status(404).json({
          success: false,
          message: '对话不存在'
        });
      }

      // 删除音频文件
      if (dialogue.audioFile) {
        await ttsService.deleteAudioFile(dialogue.audioFile);
      }

      // 删除对话记录
      await dialogue.destroy();

      res.json({
        success: true,
        message: '对话删除成功'
      });
    } catch (error) {
      logger.error('删除对话失败:', error);
      res.status(500).json({
        success: false,
        message: '删除对话失败',
        error: error.message
      });
    }
  }

  // 测试LLM连接
  async testLLMConnection(req, res) {
    try {
      const result = await llmService.testConnection();

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('测试LLM连接失败:', error);
      res.status(500).json({
        success: false,
        message: '测试LLM连接失败',
        error: error.message
      });
    }
  }

  // 测试TTS连接
  async testTTSConnection(req, res) {
    try {
      const result = await ttsService.testConnection();

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('测试TTS连接失败:', error);
      res.status(500).json({
        success: false,
        message: '测试TTS连接失败',
        error: error.message
      });
    }
  }

  // 获取可用的语音列表
  async getAvailableVoices(req, res) {
    try {
      const voices = ttsService.getAvailableVoices();

      res.json({
        success: true,
        data: voices
      });
    } catch (error) {
      logger.error('获取语音列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取语音列表失败',
        error: error.message
      });
    }
  }
}

module.exports = new DialogueController(); 