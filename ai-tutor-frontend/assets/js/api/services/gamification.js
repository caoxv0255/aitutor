// services/gamification.js — 打卡 + 积分 + 徽章 (Phase F-fix, 2026-08-24)
// Phase-F-fix (2026-08-24): F1 — 新建 frontend service, 接后端 api/modules/gamification/routes.js
//   修复 P1.7 audit: 4 个 endpoint 此前无前端消费者, 用户看不到打卡/积分/徽章.
//
// 后端端点 (api/modules/gamification/routes.js, 2026-08-23 D-Bug-D v2):
//   POST /api/gamification/checkin           — 每日打卡
//   GET  /api/gamification/checkin/status    — 当天打卡 + streak
//   GET  /api/gamification/points            — 积分历史 + 总和
//   GET  /api/gamification/badges            — 全部徽章 + 进度
//
// 出口契约 (D062 envelope, 2026-08-15): 返回完整 envelope {success, message, data}
//   page 层统一 res.data.X 消费, 不再 res.data.data.X (P0.7 解包统一)
//
// mock 文件: assets/js/api/mock/gamification_{checkin,status,points,badges}.json

import { request } from '../client.js';

export const gamification = {
  /**
   * 今日打卡, 连续天数 +1, 累加积分, 可能解锁徽章.
   * @returns {Promise<{success: boolean, message?: string, data: {checkinDate, streakDays, pointsEarned, newBadges}}>}
   */
  async checkin() {
    return request('POST', '/api/gamification/checkin', null, { mockName: 'gamification_checkin' });
  },

  /**
   * 当前打卡状态: 今日是否已打卡 + 连续天数.
   * @returns {Promise<{success: boolean, data: {todayCheckedIn, currentStreak, totalCheckins, recentCheckins[]}}>}
   */
  async getCheckinStatus() {
    return request('GET', '/api/gamification/checkin/status', null, { mockName: 'gamification_status' });
  },

  /**
   * 积分历史 (limit/offset 分页) + 当前总积分.
   * @returns {Promise<{success: boolean, data: {totalPoints, history: Array}}>}
   */
  async getPoints() {
    return request('GET', '/api/gamification/points', null, { mockName: 'gamification_points' });
  },

  /**
   * 全部徽章列表 + 是否已获得 + 进度.
   * @returns {Promise<{success: boolean, data: {totalBadges, earnedCount, badges: Array}}>}
   */
  async getBadges() {
    return request('GET', '/api/gamification/badges', null, { mockName: 'gamification_badges' });
  },
};