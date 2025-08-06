const dialogueService = require('../services/dialogueService');
const logger = require('../utils/logger');

class DialogueController {
  // 创建对话
  async createDialogue(req, res) {
    try {
      const { title, dialogueType, character1, character2, rounds, newsIds } = req.body;
      
      // 验证必填字段
      if (!title || !dialogueType || !character1 || !character2 || !rounds) {
        return res.status(400).json({
          success: false,
          message: '标题、对话类型、角色1、角色2和轮次都是必填项'
        });
      }
      
      // 验证新闻ID数组（可选）
      if (newsIds && !Array.isArray(newsIds)) {
        return res.status(400).json({
          success: false,
          message: 'newsIds必须是数组格式'
        });
      }
      
      // 验证轮次数量
      if (rounds < 1 || rounds > 20) {
        return res.status(400).json({
          success: false,
          message: '对话轮次必须在1-20之间'
        });
      }
      
      const dialogue = await dialogueService.createDialogue({
        title,
        dialogueType,
        character1,
        character2,
        rounds: parseInt(rounds),
        newsIds: newsIds || []
      });
      
      res.status(201).json({
        success: true,
        message: '对话创建成功，正在生成中...',
        data: dialogue
      });
    } catch (error) {
      logger.error('创建对话失败:', error);
      res.status(500).json({
        success: false,
        message: '创建对话失败',
        error: error.message
      });
    }
  }

  // 获取对话列表
  async getDialogues(req, res) {
    try {
      const { page = 1, limit = 10, status, dialogueType } = req.query;
      
      const result = await dialogueService.getDialogues({
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        dialogueType
      });
      
      res.json({
        success: true,
        data: result.dialogues,
        pagination: result.pagination
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
      
      const dialogue = await dialogueService.getDialogueById(id);
      
      res.json({
        success: true,
        data: dialogue
      });
    } catch (error) {
      logger.error('获取对话详情失败:', error);
      const status = error.message === '对话不存在' ? 404 : 500;
      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  }

  // 删除对话
  async deleteDialogue(req, res) {
    try {
      const { id } = req.params;
      
      await dialogueService.deleteDialogue(id);
      
      res.json({
        success: true,
        message: '对话删除成功'
      });
    } catch (error) {
      logger.error('删除对话失败:', error);
      const status = error.message === '对话不存在' ? 404 : 500;
      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  }

  // 获取对话统计
  async getDialogueStats(req, res) {
    try {
      const stats = await dialogueService.getDialogueStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('获取对话统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取对话统计失败',
        error: error.message
      });
    }
  }

  // 手动生成对话内容
  async generateDialogueContent(req, res) {
    try {
      const { id } = req.params;
      
      // 立即返回响应，异步处理生成
      res.json({
        success: true,
        message: '开始生成对话内容，请稍后刷新查看结果'
      });
      
      // 异步生成对话内容
      dialogueService.generateDialogueContent(id).catch(error => {
        logger.error(`手动生成对话内容失败: ${id}`, error);
      });
      
    } catch (error) {
      logger.error('手动生成对话内容失败:', error);
      res.status(500).json({
        success: false,
        message: '生成对话内容失败',
        error: error.message
      });
    }
  }

  // 更新对话状态
  async updateDialogueStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({
          success: false,
          message: '状态是必填项'
        });
      }
      
      const dialogue = await dialogueService.updateDialogueStatus(id, status);
      
      res.json({
        success: true,
        message: '状态更新成功',
        data: dialogue
      });
    } catch (error) {
      logger.error('更新对话状态失败:', error);
      const status = error.message === '对话不存在' ? 404 : 500;
      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new DialogueController(); 