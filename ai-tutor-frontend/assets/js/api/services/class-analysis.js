// services/class-analysis.js — 教师/家长视角 班级分析 (Phase-I-fix, 2026-08-24, PM P1-9)
import { request } from '../client.js';

export const classAnalysis = {
  async getClassAnalysis({ grade, subject } = {}) {
    return request('GET', `/api/analytics/class/analysis${grade ? `?grade=${grade}` : ''}${subject ? `${grade ? '&' : '?'}subject=${subject}` : ''}`, null, { mockName: 'class_analysis' });
  },
  async getTeacherDashboard({ teacherId } = {}) {
    return request('GET', `/api/analytics/class/teacher${teacherId ? `?teacher_id=${teacherId}` : ''}`, null, { mockName: 'teacher_dashboard' });
  },
  async getStudentProgress(studentId) {
    return request('GET', `/api/analytics/student/${studentId}`, null, { mockName: 'student_progress' });
  },
};