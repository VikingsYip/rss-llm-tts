const express = require('express');
const router = express.Router();
const dialogueController = require('../controllers/dialogueController');

// 对话管理
router.get('/', dialogueController.getDialogues);
router.post('/', dialogueController.generateDialogue);
router.get('/:id', dialogueController.getDialogueDetail);
router.delete('/:id', dialogueController.deleteDialogue);

// 语音生成
router.post('/:id/speech', dialogueController.generateSpeech);

// 连接测试
router.post('/test/llm', dialogueController.testLLMConnection);
router.post('/test/tts', dialogueController.testTTSConnection);

// 语音配置
router.get('/voices', dialogueController.getAvailableVoices);

module.exports = router; 