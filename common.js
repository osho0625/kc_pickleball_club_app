/**
 * common.js - 練習日管理アプリ 共通ユーティリティ
 * API通信、ソート、フォーマット、キャッシュ、バリデーション
 */

// =============================================================================
// 定数
// =============================================================================

/** GAS WebアプリURL（デプロイ後に設定） */
export const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbyS3Spt0RRnmNgRxvOzFOfEmylh4m_G5ezUa_yyJ2Rbg2uWPD_8qyudBzENVREPH_7D/exec';

/** LocalStorageキー */
const CACHE_KEY = 'pb_cache';
const USER_KEY = 'pb_currentUser';

// =============================================================================
// API通信
// =============================================================================

/**
 * GAS APIとの通信ラッパー（15秒タイムアウト付き）
 * @param {Object} options - リクエストオプション
 * @param {string} options.action - APIアクション名
 * @param {string} [options.method='GET'] - HTTPメソッド
 * @param {Object|null} [options.body=null] - POSTボディ
 * @returns {Promise<Object>} パース済みJSONレスポンス
 * @throws {Error} タイムアウトまたは通信エラー
 */
export async function fetchAPI({ action, method = 'GET', body = null }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    let url = GAS_API_URL;
    const options = {
      method,
      signal: controller.signal,
    };

    if (method === 'GET') {
      url += `?action=${encodeURIComponent(action)}`;
    } else {
      options.headers = { 'Content-Type': 'text/plain' };
      options.body = JSON.stringify({ action, ...body });
    }

    const response = await fetch(url, options);
    const data = await response.json();
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('タイムアウトしました');
    }
    throw new Error('通信エラーが発生しました');
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// ソート・フィルタ
// =============================================================================

/**
 * セッション配列を date ASC → startTime ASC でソート（非破壊）
 * @param {Array} sessions - Practice_Session配列
 * @returns {Array} ソート済み配列（新しい配列を返す）
 */
export function sortSessions(sessions) {
  return [...sessions].sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    if (a.startTime < b.startTime) return -1;
    if (a.startTime > b.startTime) return 1;
    return 0;
  });
}

/**
 * 過去日判定
 * @param {string} dateStr - 日付文字列 (YYYY-MM-DD)
 * @param {string} today - 今日の日付文字列 (YYYY-MM-DD)
 * @returns {boolean} dateStr < today なら true
 */
export function isPastSession(dateStr, today) {
  return dateStr < today;
}

// =============================================================================
// 出欠フォーマット
// =============================================================================

/**
 * 出欠表示フォーマット
 * @param {string} status - 出欠ステータス (○/×/△/"")
 * @param {string|null|undefined} note - 補足メモ
 * @returns {string} フォーマット済み表示文字列
 */
export function formatAttendance(status, note) {
  if (status === '△') {
    if (note && note.length > 0) {
      return `△（${note}）`;
    }
    return '△（未定）';
  }
  return status || '';
}

/**
 * 参加者カウント（○ + △ の合計）
 * @param {Array} attendance - Attendance配列 [{ status, ... }]
 * @returns {number} 参加者数
 */
export function countParticipants(attendance) {
  if (!Array.isArray(attendance)) return 0;
  return attendance.filter(a => a.status === '○' || a.status === '△').length;
}

// =============================================================================
// バリデーション
// =============================================================================

/**
 * セッションフォームバリデーション
 * shared/validation.js の validateSessionParamsLogic と同一ロジック
 * @param {Object} data - { date, venue, startTime, endTime }
 * @returns {{ code: string, message: string }|null} エラーまたはnull
 */
export function validateSessionForm(data) {
  const { date, venue, startTime, endTime } = data || {};

  // 必須チェック
  if (!date) {
    return { code: 'INVALID_PARAMS', message: '日付は必須です' };
  }
  if (!venue) {
    return { code: 'INVALID_PARAMS', message: '会場は必須です' };
  }
  if (!startTime) {
    return { code: 'INVALID_PARAMS', message: '開始時刻は必須です' };
  }
  if (!endTime) {
    return { code: 'INVALID_PARAMS', message: '終了時刻は必須です' };
  }

  // 日付形式チェック (YYYY-MM-DD)
  if (!isValidDate(date)) {
    return { code: 'INVALID_PARAMS', message: '日付の形式が不正です (YYYY-MM-DD)' };
  }

  // 会場文字数チェック
  if (venue.length < 1 || venue.length > 100) {
    return { code: 'INVALID_PARAMS', message: '会場名は1〜100文字で入力してください' };
  }

  // 時刻形式チェック
  if (!isValidTime(startTime)) {
    return { code: 'INVALID_PARAMS', message: '開始時刻の形式が不正です (HH:MM)' };
  }
  if (!isValidTime(endTime)) {
    return { code: 'INVALID_PARAMS', message: '終了時刻の形式が不正です (HH:MM)' };
  }

  // endTime > startTime チェック
  if (endTime <= startTime) {
    return { code: 'INVALID_PARAMS', message: '終了時刻は開始時刻より後にしてください' };
  }

  return null;
}

/**
 * ノート長バリデーション（最大20文字）
 * @param {string|null|undefined} note
 * @returns {boolean} true=有効、false=無効（20文字超過）
 */
export function validateNote(note) {
  if (note === null || note === undefined || note === '') return true;
  return String(note).length <= 20;
}

// =============================================================================
// バリデーション ヘルパー（内部利用）
// =============================================================================

/**
 * 日付形式チェック (YYYY-MM-DD)
 * @param {string} dateStr
 * @returns {boolean}
 */
function isValidDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/**
 * 時刻形式チェック (HH:MM)
 * @param {string} timeStr
 * @returns {boolean}
 */
function isValidTime(timeStr) {
  if (typeof timeStr !== 'string') return false;
  const match = timeStr.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

// =============================================================================
// LocalStorage キャッシュ
// =============================================================================

/**
 * セッション・メンバーデータをLocalStorageにキャッシュ
 * @param {Array} sessions - Practice_Session配列
 * @param {Array} members - メンバー名配列
 */
export function cacheData(sessions, members) {
  const now = new Date();
  // JST (UTC+9) のISO 8601形式タイムスタンプを生成
  const jstOffset = 9 * 60 * 60 * 1000;
  const jst = new Date(now.getTime() + jstOffset);
  const isoStr = jst.toISOString().replace('Z', '+09:00');

  const cache = {
    lastFetched: isoStr,
    sessions,
    members,
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

/**
 * キャッシュデータを取得
 * @returns {{ lastFetched: string, sessions: Array, members: Array }|null}
 */
export function getCachedData() {
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.lastFetched && Array.isArray(parsed.sessions) && Array.isArray(parsed.members)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// LocalStorage ユーザー管理
// =============================================================================

/**
 * 現在のユーザー名を取得
 * @returns {string|null} ユーザー名、未設定時はnull
 */
export function getCurrentUser() {
  return localStorage.getItem(USER_KEY) || null;
}

/**
 * 現在のユーザー名を設定
 * @param {string} name - メンバー名
 */
export function setCurrentUser(name) {
  localStorage.setItem(USER_KEY, name);
}
