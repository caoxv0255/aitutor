import express from 'express';
import userProfileHandler from '../../handlers/user-profile.js';
import userSubjectsHandler from '../../handlers/user-subjects.js';
import userInitializeHandler from '../../handlers/user-initialize.js';
import subjectsHandler from '../../handlers/subjects.js';
import { getProvinces as provincesHandler } from '../../handlers/provinces.js';
import { getWrongQuestions, addWrongQuestion, updateWrongQuestion, deleteWrongQuestion, getWrongQuestionStats, exportWrongQuestions } from '../../handlers/wrong-questions.js';
import { getKnowledgeProfile, updateKnowledgeMastery, getLearningSuggestions } from '../../handlers/knowledge-profile.js';

const router = express.Router();

router.get('/profile', userProfileHandler);
router.post('/profile', userProfileHandler);

router.get('/subjects', userSubjectsHandler);
router.post('/subjects', userSubjectsHandler);
router.delete('/subjects', userSubjectsHandler);

router.post('/initialize', userInitializeHandler);

router.get('/list/subjects', subjectsHandler);
router.get('/list/provinces', provincesHandler);

router.get('/wrong-questions', getWrongQuestions);
router.post('/wrong-questions', addWrongQuestion);
router.put('/wrong-questions/:id', updateWrongQuestion);
router.delete('/wrong-questions/:id', deleteWrongQuestion);
router.get('/wrong-questions/stats', getWrongQuestionStats);
router.get('/wrong-questions/export', exportWrongQuestions);

router.get('/knowledge-profile', getKnowledgeProfile);
router.post('/knowledge-mastery', updateKnowledgeMastery);
router.get('/learning-suggestions', getLearningSuggestions);

export default router;
