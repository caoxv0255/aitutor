// 模型配置文件 - 切换模型只需修改此文件
// P0-fix (2026-08-24): 模型名修正
//   - 'qwen3-vl-plus' → 'qwen-vl-plus' (DashScope 官方模型名)
//   - 删除 'deepseek-v4-pro' (DeepSeek 官方无此模型), 替换为 'deepseek-reasoner'
export const MODEL_CONFIG = {
  // 当前使用的模型
  currentModel: 'qwen-vl-plus',

  // 可用模型列表
  availableModels: {
    'qwen-vl-plus': { name: 'Qwen VL Plus', supportsVision: true },
    'qwen-vl-max': { name: 'Qwen VL Max', supportsVision: true },
    'qwen-plus': { name: 'Qwen Plus', supportsVision: false },
    'qwen-turbo': { name: 'Qwen Turbo', supportsVision: false },
    'qwen-max': { name: 'Qwen Max', supportsVision: false },
    'deepseek-chat': { name: 'DeepSeek Chat', supportsVision: false },
    'deepseek-reasoner': { name: 'DeepSeek Reasoner', supportsVision: false }
  },

  // API配置 - 使用后端代理保护 API Key
  baseURL: '/api/proxy',

  // 模型参数
  temperature: 0.7,
  maxTokens: 2000
};
