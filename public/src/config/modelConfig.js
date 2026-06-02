// 模型配置文件 - 切换模型只需修改此文件
export const MODEL_CONFIG = {
  // 当前使用的模型
  currentModel: 'qwen3-vl-plus',

  // 可用模型列表
  availableModels: {
    'qwen3-vl-plus': { name: 'Qwen3 VL Plus', supportsVision: true },
    'qwen-plus': { name: 'Qwen Plus', supportsVision: false },
    'deepseek-v4-pro': { name: 'DeepSeek V4 Pro', supportsVision: true }
  },

  // API配置 - 使用后端代理保护 API Key
  baseURL: '/api/proxy',

  // 模型参数
  temperature: 0.7,
  maxTokens: 2000
};
