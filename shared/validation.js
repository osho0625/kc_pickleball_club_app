/**
 * shared/validation.js - バリデーションのピュアロジック
 * GAS版(validation.gs)と同一ロジック。テスト対象としてNode.js側からimport可能。
 */

/**
 * 日付形式チェック (YYYY-MM-DD)
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isValidDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  // 簡易的な日付妥当性チェック
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/**
 * 時刻形式チェック (HH:MM)
 * @param {string} timeStr
 * @returns {boolean}
 */
export function isValidTime(timeStr) {
  if (typeof timeStr !== 'string') return false;
  const match = timeStr.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * セッションパラメータのバリデーションロジック
 * @param {string} date - 日付 (YYYY-MM-DD)
 * @param {string} venue - 会場名
 * @param {string} startTime - 開始時刻 (HH:MM)
 * @param {string} endTime - 終了時刻 (HH:MM)
 * @returns {{ code: string, message: string }|null}
 */
export function validateSessionParamsLogic(date, venue, startTime, endTime) {
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

  // 日付形式チェック
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
 * 出欠パラメータのバリデーションロジック
 * @param {number} rowIndex - 行番号
 * @param {string} memberName - メンバー名
 * @param {string} status - 出欠状態 (○/×/△)
 * @param {string} note - 補足メモ
 * @returns {{ code: string, message: string }|null}
 */
export function validateAttendanceParamsLogic(rowIndex, memberName, status, note) {
  if (!rowIndex || rowIndex < 1) {
    return { code: 'INVALID_PARAMS', message: '行番号が不正です' };
  }
  if (!memberName) {
    return { code: 'INVALID_PARAMS', message: 'メンバー名は必須です' };
  }
  const validStatuses = ['○', '×', '△'];
  if (!status || !validStatuses.includes(status)) {
    return { code: 'INVALID_PARAMS', message: 'ステータスは ○, ×, △ のいずれかを指定してください' };
  }
  // note の長さチェック（最大20文字）
  if (note && note.length > 20) {
    return { code: 'INVALID_PARAMS', message: 'メモは20文字以内で入力してください' };
  }
  return null;
}

/**
 * 行内容の一致検証ロジック
 * @param {string} actualDate - 実際の日付
 * @param {string} actualVenue - 実際の会場
 * @param {string} actualStartTime - 実際の開始時刻
 * @param {string} expectedDate - 期待する日付
 * @param {string} expectedVenue - 期待する会場
 * @param {string} expectedStartTime - 期待する開始時刻
 * @returns {{ code: string, message: string }|null}
 */
export function verifyRowContentLogic(actualDate, actualVenue, actualStartTime, expectedDate, expectedVenue, expectedStartTime) {
  if (actualDate !== expectedDate || actualVenue !== expectedVenue || actualStartTime !== expectedStartTime) {
    return { code: 'ROW_MISMATCH', message: '行の内容が変更されています。再読み込みしてください' };
  }
  return null;
}

/**
 * ノート長バリデーション（出欠メモ用、最大20文字）
 * @param {string} note
 * @returns {boolean} true=有効、false=無効（20文字超過）
 */
export function validateNote(note) {
  if (note === null || note === undefined || note === '') return true;
  return String(note).length <= 20;
}
