/* ============================================================================
 * imageHostPolicy.js — 作文图片 URL 宿主白名单 (唯一实现)
 *
 * 为什么存在:
 *   作文批改/转写会把入参里的图片地址直接塞进 image_url 交给视觉模型回抓。若允许
 *   任意 host, 一个已登录用户可以把它当成 SSRF 探针: 任意外网地址 + 内网地址能被
 *   回抓一次, 抓取成功/失败的差异即可判主机与端口存活, 且图片内容会经模型转录回流
 *   到响应里。合法来源只有本站 /api/upload/image 签发的地址 (前端用 location.origin
 *   解析成绝对地址后回传), 因此宿主必须收敛。
 *
 * 配置 (2026-09-23 起与 CORS 解耦):
 *   ESSAY_IMAGE_HOSTS  作文图片宿主专用配置, 逗号分隔, 可写 origin 或裸 host
 *                      (https://staging.example.com 或 staging.example.com)。
 *   未设/为空时        回退到旧的组合: SELF_BASE_URL 的 host + ALLOWED_ORIGINS 的
 *                      host。回退是为了不破坏线上: 现有部署只配了 ALLOWED_ORIGINS,
 *                      若未设就直接拒绝会把线上作文图片整批打掉。
 *   无论哪种情况, loopback (localhost / 127.0.0.1 / ::1) 与 SELF_BASE_URL 的 host
 *   始终放行 —— 前者是本机联调与单测, 后者是本服务自己的地址, 两者都不引入新的
 *   暴露面, 但能避免"改了 ESSAY_IMAGE_HOSTS 却漏掉自身域名"导致的整批拒绝。
 *
 * 比对口径:
 *   - 只比 hostname, 不比端口。前端页面端口与 API 端口本就不必相同。
 *   - 只接受 http(s); data: / ftp: / file: 一律拒绝。
 *   - 每次调用重新求值 process.env, 不在模块加载时固化, 否则测试改 env 不生效。
 *
 * 调用方: essayService.js (gradeEssay 第 0 步)、transcribeService.js (ImageUrlSchema)
 * ============================================================================ */

'use strict';

/** 恒定放行的回环地址 (本机联调 / 单测) */
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '::1'];

/**
 * 从配置项里取 hostname. 支持 origin (https://a.example.com) 与裸 host
 * (a.example.com); 解析不出就返回 null —— 宁可漏配不可放行。
 * @param {unknown} raw
 * @returns {string|null}
 */
function parseHost(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  for (const candidate of [value, `https://${value}`]) {
    try {
      const host = new URL(candidate).hostname.toLowerCase();
      // `new URL('localhost:3002')` 会把 'localhost:' 当协议, hostname 为空串
      if (host) return host;
    } catch (_) {
      /* 换下一种写法再试 */
    }
  }
  return null;
}

/** 逗号分隔配置 → hostname 列表 (去空 / 去重靠外层 Set) */
function splitHosts(raw) {
  return String(raw || '')
    .split(',')
    .map(parseHost)
    .filter(Boolean);
}

/** 本服务自调用基址的 host (默认 127.0.0.1, 即回环) */
function selfBaseHost() {
  const raw = process.env.SELF_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3002}`;
  return parseHost(raw);
}

/**
 * 当前生效的宿主白名单 (不含 loopback 常量, 调用方自行并集).
 * @returns {Set<string>}
 */
export function allowedImageHosts() {
  const hosts = new Set(LOOPBACK_HOSTS);

  const explicit = splitHosts(process.env.ESSAY_IMAGE_HOSTS);
  const fallback = explicit.length ? explicit : splitHosts(process.env.ALLOWED_ORIGINS);

  for (const host of fallback) hosts.add(host);

  const self = selfBaseHost();
  if (self) hosts.add(self);

  return hosts;
}

/**
 * 图片 URL 是否落在宿主白名单内.
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isAllowedImageUrl(raw) {
  if (typeof raw !== 'string' || raw === '') return false;
  if (!/^https?:\/\//i.test(raw)) return false; // data: / ftp: / file: 一律拒绝
  try {
    return allowedImageHosts().has(new URL(raw).hostname.toLowerCase());
  } catch (_) {
    return false;
  }
}
