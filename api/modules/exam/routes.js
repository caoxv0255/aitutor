import express from 'express';
import { getExamPapers, getExamPaperById, createExamPaper } from '../../handlers/exam-papers.js';
import { getExamQuestions, createExamQuestion, batchCreateQuestions } from '../../handlers/exam-questions.js';
import { startExamSession, submitExamSession, getExamHistory } from '../../handlers/exam-session.js';
import generatePaperRouter from '../../handlers/generate-paper.js';
import { generateExamPdf } from '../../handlers/exam-pdf.js';
import questionsRouter from '../../handlers/questions.js';
import explainQuestionRouter from '../../handlers/explain-question.js';

const router = express.Router();

router.get('/papers', getExamPapers);
router.get('/papers/:id', getExamPaperById);
router.post('/papers', createExamPaper);

router.get('/questions/:paperId', getExamQuestions);
router.post('/questions', createExamQuestion);
router.post('/questions/batch', batchCreateQuestions);

router.post('/session/start', startExamSession);
router.post('/session/submit', submitExamSession);
router.get('/session/history', getExamHistory);

router.use('/generate', generatePaperRouter);
// 2026-08-20 DSH: 之前 router.post('/pdf/generate', ...) 没声明 :paperId 占位符,
// 但 generateExamPdf 用 req.params.paperId. 一直 404. 修法: 加 :paperId.
router.post('/pdf/generate/:paperId', generateExamPdf);
router.use('/list', questionsRouter);
router.use('/explain', explainQuestionRouter);

export default router;
