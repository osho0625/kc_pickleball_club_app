/**
 * spreadsheet.gs - スプレッドシート読み書きロジック
 * 既存xlsxスプレッドシートとの双方向連携を提供する。
 * 
 * スプレッドシート構造:
 * Row 1-4: ヘッダーエリア（タイトル等）
 * Row 5: カラムヘッダー - 日付, 曜日, 会場, 開始時刻, 終了時刻, 予約ID, 備考, 参加人数, メンバー名...
 * Row 6+: データ行
 * 
 * カラムマッピング:
 * A=日付, B=曜日, C=会場, D=開始時刻, E=終了時刻, F=予約ID, G=備考, H=参加人数, I+=メンバー出欠
 */

/** スプレッドシートID */
const SPREADSHEET_ID = '1fL-p266yVU2M8CZv2spousWvpY4TmjIv';

/** ヘッダー行番号（メンバー名が入っている行） */
const HEADER_ROW = 5;

/** データ開始行番号 */
const DATA_START_ROW = 6;

/** メンバー出欠が始まるカラムインデックス（0始まり） */
const MEMBER_START_COL_INDEX = 8;

// ===== 読み込みロジック =====

/**
 * スプレッドシートを開いてシートを返す
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} アクティブシート
 */
function openSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheets()[0];
}

/**
 * ヘッダー行からメンバー名リストを取得する
 * @returns {string[]} メンバー名の配列
 */
function getMembers() {
  var sheet = openSheet();
  var lastCol = sheet.getLastColumn();
  if (lastCol < MEMBER_START_COL_INDEX + 1) {
    return [];
  }
  var headerRange = sheet.getRange(HEADER_ROW, MEMBER_START_COL_INDEX + 1, 1, lastCol - MEMBER_START_COL_INDEX);
  var headerValues = headerRange.getValues()[0];
  var members = [];
  for (var i = 0; i < headerValues.length; i++) {
    var name = String(headerValues[i]).trim();
    if (name !== '') {
      members.push(name);
    }
  }
  return members;
}

/**
 * 全データ行を読み込み Practice_Session[] に変換する
 * @returns {{ sessions: Object[], members: string[] }} セッション配列とメンバーリスト
 */
function getSessions() {
  var sheet = openSheet();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < DATA_START_ROW) {
    return { sessions: [], members: [] };
  }

  // ヘッダー行からメンバー名取得
  var headerRange = sheet.getRange(HEADER_ROW, MEMBER_START_COL_INDEX + 1, 1, lastCol - MEMBER_START_COL_INDEX);
  var headerValues = headerRange.getValues()[0];
  var members = [];
  for (var i = 0; i < headerValues.length; i++) {
    var name = String(headerValues[i]).trim();
    if (name !== '') {
      members.push(name);
    }
  }

  // データ行取得
  var numRows = lastRow - DATA_START_ROW + 1;
  var dataRange = sheet.getRange(DATA_START_ROW, 1, numRows, lastCol);
  var dataValues = dataRange.getValues();

  var sessions = [];
  for (var r = 0; r < dataValues.length; r++) {
    var row = dataValues[r];
    // 日付が空の行はスキップ
    if (!row[0] && row[0] !== 0) {
      continue;
    }
    var session = rowToSession(row, DATA_START_ROW + r, members);
    sessions.push(session);
  }

  return { sessions: sessions, members: members };
}

/**
 * スプレッドシートの1行を Practice_Session オブジェクトに変換する
 * @param {Array} row - 行データ配列
 * @param {number} rowIndex - スプレッドシート上の行番号
 * @param {string[]} memberNames - メンバー名の配列
 * @returns {Object} Practice_Session オブジェクト
 */
function rowToSession(row, rowIndex, memberNames) {
  var attendance = [];
  for (var i = 0; i < memberNames.length; i++) {
    var cellValue = row[MEMBER_START_COL_INDEX + i];
    attendance.push({
      memberName: memberNames[i],
      status: parseStatus(cellValue),
      note: parseNote(cellValue)
    });
  }

  return {
    rowIndex: rowIndex,
    date: formatDate(row[0]),
    dayOfWeek: String(row[1] || ''),
    venue: String(row[2] || ''),
    startTime: formatTime(row[3]),
    endTime: formatTime(row[4]),
    reservationId: String(row[5] || ''),
    notes: String(row[6] || ''),
    participantCount: Number(row[7]) || 0,
    attendance: attendance
  };
}

/**
 * Date オブジェクトまたは文字列を "YYYY-MM-DD" 形式に変換する
 * "7月1日" のような日本語形式にも対応（年は現在年を使用）。
 * @param {Date|string|number} value - 日付値
 * @returns {string} "YYYY-MM-DD" 形式の文字列
 */
function formatDate(value) {
  if (!value && value !== 0) {
    return '';
  }
  var d;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === 'string') {
    // 既にYYYY-MM-DD形式の場合はそのまま返す
    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return value;
    }
    // "7月1日" 形式の処理
    var jpMatch = value.match(/^(\d{1,2})月(\d{1,2})日$/);
    if (jpMatch) {
      var currentYear = new Date().getFullYear();
      var month = ('0' + jpMatch[1]).slice(-2);
      var day = ('0' + jpMatch[2]).slice(-2);
      return currentYear + '-' + month + '-' + day;
    }
    // "2025年7月1日" 形式の処理
    var jpFullMatch = value.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
    if (jpFullMatch) {
      var y = jpFullMatch[1];
      var m = ('0' + jpFullMatch[2]).slice(-2);
      var dd = ('0' + jpFullMatch[3]).slice(-2);
      return y + '-' + m + '-' + dd;
    }
    d = new Date(value);
  } else {
    d = new Date(value);
  }
  if (isNaN(d.getTime())) {
    return String(value);
  }
  var year = d.getFullYear();
  var month2 = ('0' + (d.getMonth() + 1)).slice(-2);
  var day2 = ('0' + d.getDate()).slice(-2);
  return year + '-' + month2 + '-' + day2;
}

/**
 * 時刻値を "HH:MM" 形式に変換する
 * 全角コロン（：）や "19：00～21：00" のような結合文字列にも対応。
 * @param {Date|string|number} value - 時刻値
 * @returns {string} "HH:MM" 形式の文字列
 */
function formatTime(value) {
  if (!value && value !== 0) {
    return '';
  }
  // 文字列の場合
  if (typeof value === 'string') {
    // 全角コロンを半角に正規化
    var normalized = value.replace(/：/g, ':');
    // HH:MM形式に一致するか（先頭のみ抽出、"～"で区切られている場合は最初の時刻）
    var timeMatch = normalized.match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      return ('0' + timeMatch[1]).slice(-2) + ':' + timeMatch[2];
    }
  }
  // Date オブジェクトの場合
  if (value instanceof Date) {
    var hours = ('0' + value.getHours()).slice(-2);
    var minutes = ('0' + value.getMinutes()).slice(-2);
    return hours + ':' + minutes;
  }
  // 数値の場合（GASのシリアル時刻: 0.0〜1.0）
  if (typeof value === 'number' && value >= 0 && value < 1) {
    var totalMinutes = Math.round(value * 24 * 60);
    var h = Math.floor(totalMinutes / 60);
    var m = totalMinutes % 60;
    return ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2);
  }
  return String(value);
}

/**
 * セル値から出欠ステータスを抽出する
 * @param {string|any} cellValue - セルの値
 * @returns {string} "○", "×", "△", または ""
 */
function parseStatus(cellValue) {
  if (!cellValue && cellValue !== 0) {
    return '';
  }
  var str = String(cellValue).trim();
  if (str === '') {
    return '';
  }
  // ○ (丸) または 〇 (漢数字ゼロ) → ○
  if (str === '○' || str === '〇') {
    return '○';
  }
  // × (バツ) または ✕ (乗算記号)
  if (str === '×' || str === '✕') {
    return '×';
  }
  // △ で始まる場合（△単独、△(xxx)、△（xxx）いずれも対応）
  if (str.charAt(0) === '△') {
    return '△';
  }
  // 〇で始まる場合（丸のバリエーション）
  if (str.charAt(0) === '〇') {
    return '○';
  }
  return '';
}

/**
 * セル値から△の補足メモを抽出する
 * △（遅れて参加）→ "遅れて参加"
 * △(参加未定) → "参加未定"
 * @param {string|any} cellValue - セルの値
 * @returns {string} 補足メモ文字列（△でない場合やメモがない場合は空文字）
 */
function parseNote(cellValue) {
  if (!cellValue && cellValue !== 0) {
    return '';
  }
  var str = String(cellValue).trim();
  if (str.charAt(0) !== '△') {
    return '';
  }
  // 全角括弧 （）または 半角括弧 () の中身を抽出
  var match = str.match(/[（(](.+?)[）)]/);
  if (match) {
    return match[1];
  }
  return '';
}

// ===== 書き込みロジック =====

/**
 * 出欠セルに値を書き込む
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - シートオブジェクト
 * @param {number} rowIndex - スプレッドシート行番号
 * @param {string} memberName - メンバー名
 * @param {string[]} members - メンバー名リスト
 * @param {string} status - 出欠ステータス (○/×/△)
 * @param {string} note - △の場合の補足メモ
 */
function updateAttendanceCell(sheet, rowIndex, memberName, members, status, note) {
  var memberIndex = members.indexOf(memberName);
  if (memberIndex === -1) {
    throw new Error('メンバーが見つかりません: ' + memberName);
  }
  var col = MEMBER_START_COL_INDEX + 1 + memberIndex; // 1始まりカラム番号
  var cellValue = formatAttendanceValue(status, note);
  sheet.getRange(rowIndex, col).setValue(cellValue);
}

/**
 * 出欠値を書き込み用の文字列にフォーマットする
 * @param {string} status - ○/×/△
 * @param {string} note - 補足メモ
 * @returns {string} セルに書き込む文字列
 */
function formatAttendanceValue(status, note) {
  if (status === '△' && note) {
    return '△（' + note + '）';
  }
  return status;
}

/**
 * 新規セッション行を追加する
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - シートオブジェクト
 * @param {Object} data - セッションデータ
 * @param {string} data.date - 日付 (YYYY-MM-DD)
 * @param {string} data.dayOfWeek - 曜日
 * @param {string} data.venue - 会場
 * @param {string} data.startTime - 開始時刻 (HH:MM)
 * @param {string} data.endTime - 終了時刻 (HH:MM)
 * @param {string} [data.reservationId] - 予約ID
 * @param {string} [data.notes] - 備考
 */
function addSessionRow(sheet, data) {
  var lastRow = sheet.getLastRow();
  var newRow = lastRow + 1;
  var values = [
    data.date || '',
    data.dayOfWeek || '',
    data.venue || '',
    data.startTime || '',
    data.endTime || '',
    data.reservationId || '',
    data.notes || '',
    0 // 参加人数（初期値0）
  ];
  sheet.getRange(newRow, 1, 1, values.length).setValues([values]);
}

/**
 * 既存セッション行を更新する
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - シートオブジェクト
 * @param {number} rowIndex - スプレッドシート行番号
 * @param {Object} data - 更新データ
 * @param {string} data.date - 日付 (YYYY-MM-DD)
 * @param {string} data.dayOfWeek - 曜日
 * @param {string} data.venue - 会場
 * @param {string} data.startTime - 開始時刻 (HH:MM)
 * @param {string} data.endTime - 終了時刻 (HH:MM)
 * @param {string} [data.reservationId] - 予約ID
 * @param {string} [data.notes] - 備考
 */
function updateSessionRow(sheet, rowIndex, data) {
  var values = [
    data.date || '',
    data.dayOfWeek || '',
    data.venue || '',
    data.startTime || '',
    data.endTime || '',
    data.reservationId || '',
    data.notes || ''
  ];
  // A〜G列（1〜7列目）を更新。H列（参加人数）とI列以降（出欠）は保持
  sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
}

/**
 * セッション行を削除する
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - シートオブジェクト
 * @param {number} rowIndex - スプレッドシート行番号
 */
function deleteSessionRow(sheet, rowIndex) {
  sheet.deleteRow(rowIndex);
}

/**
 * LockServiceラッパー - 排他制御付き関数実行
 * スクリプトロックを取得してから関数を実行し、完了後にロックを解放する。
 * 10秒以内にロックが取得できない場合は WRITE_CONFLICT エラーを返す。
 * 
 * @param {Function} fn - ロック内で実行する関数
 * @returns {GoogleAppsScript.Content.TextOutput} fn の戻り値、またはエラーレスポンス
 */
function withLock(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return errorResponse('WRITE_CONFLICT', '同時書き込みのため処理できませんでした');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}
