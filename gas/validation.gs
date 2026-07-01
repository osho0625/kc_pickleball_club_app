/**
 * validation.gs - パラメータバリデーション
 * リクエストパラメータの検証を行い、不正な場合はエラーレスポンスを返す。
 */

/**
 * セッション関連パラメータをバリデーションする
 * @param {string} date - 日付 (YYYY-MM-DD)
 * @param {string} venue - 会場名
 * @param {string} startTime - 開始時刻 (HH:MM)
 * @param {string} endTime - 終了時刻 (HH:MM)
 * @returns {GoogleAppsScript.Content.TextOutput|null} エラーレスポンスまたはnull(OK)
 */
function validateSessionParams(date, venue, startTime, endTime) {
  var result = validateSessionParamsLogic(date, venue, startTime, endTime);
  if (result) {
    return errorResponse(result.code, result.message);
  }
  return null;
}

/**
 * 出欠関連パラメータをバリデーションする
 * @param {number} rowIndex - 行番号
 * @param {string} memberName - メンバー名
 * @param {string} status - 出欠状態 (○/×/△)
 * @param {string} note - 補足メモ
 * @returns {GoogleAppsScript.Content.TextOutput|null} エラーレスポンスまたはnull(OK)
 */
function validateAttendanceParams(rowIndex, memberName, status, note) {
  var result = validateAttendanceParamsLogic(rowIndex, memberName, status, note);
  if (result) {
    return errorResponse(result.code, result.message);
  }
  return null;
}

/**
 * 指定行の内容が期待値と一致するか検証する（楽観的排他制御）
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - シートオブジェクト
 * @param {number} rowIndex - 行番号
 * @param {string} expectedDate - 期待する日付
 * @param {string} expectedVenue - 期待する会場
 * @param {string} expectedStartTime - 期待する開始時刻
 * @returns {GoogleAppsScript.Content.TextOutput|null} エラーレスポンスまたはnull(OK)
 */
function verifyRowContent(sheet, rowIndex, expectedDate, expectedVenue, expectedStartTime) {
  var row = sheet.getRange(rowIndex, 1, 1, 4).getValues()[0]; // A〜D列
  var actualDate = formatDate(row[0]);
  var actualVenue = String(row[2]);
  var actualStartTime = formatTime(row[3]);

  var result = verifyRowContentLogic(
    actualDate, actualVenue, actualStartTime,
    expectedDate, expectedVenue, expectedStartTime
  );
  if (result) {
    return errorResponse(result.code, result.message);
  }
  return null;
}

// --- ピュアロジック（テスト可能） ---

/**
 * セッションパラメータのバリデーションロジック
 * @returns {{ code: string, message: string }|null}
 */
function validateSessionParamsLogic(date, venue, startTime, endTime) {
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

  // 時刻形式チェック (HH:MM)
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
 * @returns {{ code: string, message: string }|null}
 */
function validateAttendanceParamsLogic(rowIndex, memberName, status, note) {
  if (!rowIndex || rowIndex < 1) {
    return { code: 'INVALID_PARAMS', message: '行番号が不正です' };
  }
  if (!memberName) {
    return { code: 'INVALID_PARAMS', message: 'メンバー名は必須です' };
  }
  var validStatuses = ['○', '×', '△'];
  if (!status || validStatuses.indexOf(status) === -1) {
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
 * @returns {{ code: string, message: string }|null}
 */
function verifyRowContentLogic(actualDate, actualVenue, actualStartTime, expectedDate, expectedVenue, expectedStartTime) {
  if (actualDate !== expectedDate || actualVenue !== expectedVenue || actualStartTime !== expectedStartTime) {
    return { code: 'ROW_MISMATCH', message: '行の内容が変更されています。再読み込みしてください' };
  }
  return null;
}

/**
 * 日付形式チェック (YYYY-MM-DD)
 * @param {string} dateStr
 * @returns {boolean}
 */
function isValidDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  var match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  var year = parseInt(match[1], 10);
  var month = parseInt(match[2], 10);
  var day = parseInt(match[3], 10);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  // 簡易的な日付妥当性チェック
  var d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/**
 * 時刻形式チェック (HH:MM)
 * @param {string} timeStr
 * @returns {boolean}
 */
function isValidTime(timeStr) {
  if (typeof timeStr !== 'string') return false;
  var match = timeStr.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  var hours = parseInt(match[1], 10);
  var minutes = parseInt(match[2], 10);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}
