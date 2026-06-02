export function swaggerUI(req, res) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Tutor API Documentation</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
<style>body{margin:0;background:#fafafa}</style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
SwaggerUIBundle({
  url: '/api-docs.json',
  dom_id: '#swagger-ui',
  presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
  layout: 'BaseLayout',
  lang: 'zh-CN'
})
</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

export function swaggerSpec(req, res) {
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'AI Tutor API',
      description: '高考/中考错题诊断与预测学习平台 API 文档',
      version: '1.0.0'
    },
    servers: [
      { url: 'http://localhost:3002', description: '本地开发服务器' }
    ],
    tags: [
      { name: '认证', description: '用户注册、登录、密码重置' },
      { name: '省份', description: '省份高考数据查询' },
      { name: '试卷', description: '试卷和题目管理' },
      { name: '错题', description: '错题本管理' },
      { name: '报告', description: '诊断报告生成' },
      { name: '学习', description: '学习路径、仪表盘、练习' },
      { name: '激励', description: '打卡、积分、徽章' }
    ],
    paths: {
      '/api/login': {
        post: {
          tags: ['认证'],
          summary: '用户登录',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } }
          },
          responses: {
            200: { description: '登录成功', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
            401: { description: '邮箱或密码错误' }
          }
        }
      },
      '/api/register': {
        post: {
          tags: ['认证'],
          summary: '用户注册',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } }
          },
          responses: {
            201: { description: '注册成功' },
            400: { description: '参数错误或邮箱已注册' }
          }
        }
      },
      '/api/provinces': {
        get: {
          tags: ['省份'],
          summary: '获取省份列表',
          parameters: [
            { name: 'exam_level', in: 'query', schema: { type: 'string', enum: ['gaokao', 'zhongkao'] }, description: '考试类型' }
          ],
          responses: { 200: { description: '省份列表' } }
        }
      },
      '/api/provinces/{code}': {
        get: {
          tags: ['省份'],
          summary: '获取省份详情',
          parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: '省份详情' }, 404: { description: '省份不存在' } }
        }
      },
      '/api/province-trends/{code}': {
        get: {
          tags: ['省份'],
          summary: '获取省份命题趋势',
          parameters: [
            { name: 'code', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'years', in: 'query', schema: { type: 'integer', default: 5 }, description: '分析年数' }
          ],
          responses: { 200: { description: '趋势数据' } }
        }
      },
      '/api/exam-papers': {
        get: {
          tags: ['试卷'],
          summary: '获取试卷列表',
          parameters: [
            { name: 'province', in: 'query', schema: { type: 'string' }, description: '省份代码' },
            { name: 'year', in: 'query', schema: { type: 'integer' }, description: '年份' },
            { name: 'subject', in: 'query', schema: { type: 'string' }, description: '学科' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } }
          ],
          responses: { 200: { description: '试卷列表' } }
        }
      },
      '/api/exam-questions/{paperId}': {
        get: {
          tags: ['试卷'],
          summary: '获取试卷题目',
          parameters: [
            { name: 'paperId', in: 'path', required: true, schema: { type: 'integer' } },
            { name: 'type', in: 'query', schema: { type: 'string' }, description: '题型筛选' },
            { name: 'difficulty', in: 'query', schema: { type: 'integer' }, description: '难度筛选' }
          ],
          responses: { 200: { description: '题目列表' }, 404: { description: '试卷不存在' } }
        }
      },
      '/api/questions': {
        get: {
          tags: ['错题'],
          summary: '获取错题列表',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'subject', in: 'query', schema: { type: 'string' }, description: '学科筛选' }
          ],
          responses: { 200: { description: '错题列表' }, 401: { description: '未认证' } }
        },
        post: {
          tags: ['错题'],
          summary: '添加错题',
          security: [{ bearerAuth: [] }],
          responses: { 201: { description: '添加成功' }, 401: { description: '未认证' } }
        }
      },
      '/api/learning-dashboard': {
        get: {
          tags: ['学习'],
          summary: '获取学习仪表盘',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: '仪表盘数据' }, 401: { description: '未认证' } }
        }
      },
      '/api/exam-session/start': {
        post: {
          tags: ['学习'],
          summary: '开始练习',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ExamStartRequest' } } }
          },
          responses: { 200: { description: '练习会话创建成功' }, 401: { description: '未认证' } }
        }
      },
      '/api/exam-session/submit': {
        post: {
          tags: ['学习'],
          summary: '提交练习',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: '提交成功，返回成绩' }, 401: { description: '未认证' } }
        }
      },
      '/api/checkin': {
        post: {
          tags: ['激励'],
          summary: '每日打卡',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: '打卡成功' }, 400: { description: '今日已打卡' } }
        }
      },
      '/api/badges': {
        get: {
          tags: ['激励'],
          summary: '获取徽章列表',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: '徽章列表' }, 401: { description: '未认证' } }
        }
      },
      '/api/points': {
        get: {
          tags: ['激励'],
          summary: '获取积分历史',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: '积分历史' }, 401: { description: '未认证' } }
        }
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'student@example.com' },
            password: { type: 'string', minLength: 6, example: '123456' }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'grade'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            grade: { type: 'string', enum: ['小学', '初中', '高中'] }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            token: { type: 'string' },
            user: { type: 'object', properties: { email: { type: 'string' }, grade: { type: 'string' } } }
          }
        },
        ExamStartRequest: {
          type: 'object',
          required: ['subject'],
          properties: {
            subject: { type: 'string', example: 'math' },
            province_code: { type: 'string', example: 'beijing' },
            year: { type: 'integer', example: 2025 },
            time_limit: { type: 'integer', default: 120, description: '限时（分钟）' },
            question_count: { type: 'integer', default: 20 }
          }
        }
      }
    }
  };

  res.json(spec);
}
