/**
 * common.js - 練習日管理アプリ 共通ユーティリティ
 * API通信、ソート、フォーマット、キャッシュ、バリデーション
 */

// =============================================================================
// 定数
// =============================================================================

/** GAS WebアプリURL（デプロイ後に設定） */
export const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbyS3Spt0RRnmNgRxvOzFOfEmylh4m_G5ezUa_yyJ2Rbg2uWPD_8qyudBzENVREPH_7D/exec';

/** Supabase設定（Push通知用） */
const SUPABASE_URL = 'https://kcukmlrwrfmahagbqhpl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdWttbHJ3cmZtYWhhZ2JxaHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NDQ0MTgsImV4cCI6MjEwMjUyMDQxOH0.6ptYoF79utLV1BG43AiSkHj0VMr3DtzFXcz-a5o9oqI';

/** VAPID公開鍵（generate-vapid-keys.jsで生成したものを設定） */
const VAPID_PUBLIC_KEY = 'BIYUoBoj99JEl1CpQ_mlLVLJ-5IhOCuog8844y7nT3JJy8LtRrm78l6SAa5aU0Whyort46BRzsCoVN_1bD_6k1A';

/** LocalStorageキー */
const CACHE_KEY = 'pb_cache';
const USER_KEY = 'pb_currentUser';
const DEVICE_ID_KEY = 'pb_device_id';
const PUSH_ENABLED_KEY = 'pb_push_enabled';

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


// =============================================================================
// Push通知
// =============================================================================

/**
 * デバイスIDを取得（なければ生成して保存）
 * @returns {string} UUID形式のデバイスID
 */
export function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Push通知が有効かどうか
 * @returns {boolean}
 */
export function isPushEnabled() {
  return localStorage.getItem(PUSH_ENABLED_KEY) === 'true';
}

/**
 * Push通知の有効/無効を保存
 * @param {boolean} enabled
 */
export function setPushEnabled(enabled) {
  localStorage.setItem(PUSH_ENABLED_KEY, String(enabled));
}

/**
 * Service Workerを登録する
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker非対応ブラウザです');
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    return registration;
  } catch (error) {
    console.error('Service Worker登録失敗:', error);
    return null;
  }
}

/**
 * Push通知の購読を作成し、Supabaseに保存する
 * @param {string|null} memberName - メンバー名
 * @returns {Promise<boolean>} 成功時true
 */
export async function subscribePush(memberName) {
  try {
    const registration = await registerServiceWorker();
    if (!registration) return false;

    // 通知権限リクエスト
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('通知権限が拒否されました');
      return false;
    }

    // 既存の購読を確認
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      // 新規購読作成
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Supabaseにupsert
    const deviceId = getDeviceId();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        device_id: deviceId,
        subscription: subscription.toJSON(),
        member_name: memberName || null,
      }),
    });

    if (response.ok || response.status === 201) {
      setPushEnabled(true);
      return true;
    }
    console.error('購読登録失敗:', response.status);
    return false;
  } catch (error) {
    console.error('Push購読エラー:', error);
    return false;
  }
}

/**
 * Push通知の購読を解除する
 * @returns {Promise<boolean>} 成功時true
 */
export async function unsubscribePush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }

    // Supabaseから削除
    const deviceId = getDeviceId();
    await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?device_id=eq.${deviceId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });

    setPushEnabled(false);
    return true;
  } catch (error) {
    console.error('Push購読解除エラー:', error);
    return false;
  }
}

/**
 * Base64 URL文字列をUint8Arrayに変換（VAPID鍵変換用）
 * @param {string} base64String - Base64 URL エンコードされた文字列
 * @returns {Uint8Array}
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
