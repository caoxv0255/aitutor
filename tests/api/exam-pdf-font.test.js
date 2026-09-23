// B-1 回归测试: exam-pdf 中文字体不再硬编码 Windows 路径
//   - CJK_FONT_PATH 解析到仓库内文件且 fs.existsSync 为真
//   - registerCjkFonts 成功路径: 字体文件可被 pdfkit 真实加载
//   - 缺字体分支: 抛出明确报错文案 (而非神秘 500)
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

vi.mock('../../api/core/db.js', () => ({
  getDb: vi.fn()
}));

import { CJK_FONT_PATH, registerCjkFonts } from '../../api/handlers/exam-pdf.js';

describe('B-1: exam-pdf 中文字体', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('CJK_FONT_PATH 解析到仓库内 assets/fonts 且文件真实存在', () => {
    expect(path.isAbsolute(CJK_FONT_PATH)).toBe(true);
    expect(CJK_FONT_PATH).toContain(path.join('assets', 'fonts'));
    expect(CJK_FONT_PATH.endsWith('NotoSansCJK-Regular.ttc')).toBe(true);
    expect(fs.existsSync(CJK_FONT_PATH)).toBe(true);
  });

  it('registerCjkFonts 成功路径: 字体文件可被 pdfkit 加载', () => {
    const doc = new PDFDocument({ size: 'A4' });
    expect(() => registerCjkFonts(doc)).not.toThrow();
    // 触发真实加载 (fontkit 读文件 + TTC face 选择)
    expect(() => doc.font('simhei')).not.toThrow();
    expect(() => doc.font('simsun')).not.toThrow();
    doc.end();
  });

  it('缺字体分支: 抛出明确报错文案 (含「中文字体缺失」与文件名)', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const doc = new PDFDocument({ size: 'A4' });
    expect(() => registerCjkFonts(doc)).toThrowError(/中文字体缺失/);
    expect(() => registerCjkFonts(doc)).toThrowError(/NotoSansCJK-Regular\.ttc/);
    doc.end();
  });
});
