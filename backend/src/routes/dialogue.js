const express = require('express');
const router = express.Router();
const dialogueController = require('../controllers/dialogueController');

// 创建对话
router.post('/', dialogueController.createDialogue);

// 获取对话列表
router.get('/', dialogueController.getDialogues);

// 获取对话详情
router.get('/:id', dialogueController.getDialogueDetail);

// 删除对话
router.delete('/:id', dialogueController.deleteDialogue);

// 获取对话统计
router.get('/stats/overview', dialogueController.getDialogueStats);

// 手动生成对话内容
router.post('/:id/generate', dialogueController.generateDialogueContent);

// 更新对话状态
router.put('/:id/status', dialogueController.updateDialogueStatus);

module.exports = router; 