// Phase-H3-fix (2026-08-24): 游客状态 + 注册合并
import { idbStorage } from './idb-storage.js';

export const guestState = {
  isGuest() {
    try { return !localStorage.getItem('aitutor.token'); } catch { return true; }
  },
  shouldPersist() { return this.isGuest(); },
  async getGuestDataSummary() {
    const wrongCount = await idbStorage.count('wrong_questions');
    const recordsCount = await idbStorage.count('practice_records');
    return {
      wrong_questions: wrongCount,
      practice_records: recordsCount,
      total: wrongCount + recordsCount,
    };
  },
  async onRegisterSuccess(token) {
    try {
      const merged = await idbStorage.mergeToBackend(token);
      return { merged_count: merged };
    } catch (e) {
      console.warn('[guest] merge failed', e);
      return { merged_count: 0, error: e.message };
    }
  },
};
