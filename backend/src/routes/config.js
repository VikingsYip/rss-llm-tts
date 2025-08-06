const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

// 获取所有配置
router.get('/', configController.getAllConfigs);

// 获取配置分组
router.get('/groups', configController.getConfigGroups);

// 获取单个配置
router.get('/:key', configController.getConfig);

// 保存配置
router.post('/', configController.saveConfig);

// 批量保存配置
router.post('/batch', configController.saveConfigs);

// 保存系统设置
router.post('/system', configController.saveSystemSettings);

// 删除配置
router.delete('/:key', configController.deleteConfig);

// 测试LLM连接
router.post('/test/llm', configController.testLLMConnection);

// 测试TTS连接
router.post('/test/tts', configController.testTTSConnection);

// 重置为默认值
router.post('/reset', configController.resetToDefaults);

module.exports = router; 