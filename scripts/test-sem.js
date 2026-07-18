import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

import { generateSemanticDescription } from '../services/subject-parser.js';

console.log('测试generateSemanticDescription...');
const result = await generateSemanticDescription('函数f(x)=x³的单调区间', 'math');
console.log('结果:', result);
console.log('长度:', result?.length);
console.log('是否为空:', !result || result.trim() === '');