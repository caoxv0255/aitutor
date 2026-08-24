// 跟踪新用户 onboarding 进度
// Phase-G2-fix (2026-08-24)
export const onboardingTracker = {
  trackStep(step) { try { localStorage.setItem('aitutor.onboarding.step', String(step)); } catch {} },
  trackSkip(step) { this.trackStep('skipped_' + step); },
  trackComplete() { try { localStorage.setItem('aitutor.onboarded', 'true'); localStorage.setItem('aitutor.onboarding.completed_at', new Date().toISOString()); } catch {} },
  isFirstVisit() { try { return !localStorage.getItem('aitutor.onboarded'); } catch { return true; } },
  getCurrentStep() { try { return localStorage.getItem('aitutor.onboarding.step') || '0'; } catch { return '0'; } },
};