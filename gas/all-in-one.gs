// =============================================================================
// 関東地区ピックル会 練習日管理 - GAS API (all-in-one)
// バックアップ機能は後日追加
// =============================================================================

// ===== 設定 =====
const SPREADSHEET_ID = '1fL-p266yVU2M8CZv2spousWvpY4TmjIv';
const HEADER_ROW = 5;
const DATA_START_ROW = 6;
const MEMBER_START_COL_INDEX = 8;

// ===== レスポンスビルダー =====
function successResponse(data) {
  const body = { success: true };
  if (data !== undefined && data !== null) body.data = data;
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(code, message) {
  return ContentService.createTextOutput(JSON.stringify({
    success: false, error: { code: String(code), message: String(message) }
  })).setMimeType(ContentService.MimeType.JSON);
}

// ===== メインルーター =====
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || '';
    switch (action) {
      case 'getSessions': return handleGetSessions();
      default: return errorResponse('INVALID_PARAMS', '不明なアクションです: ' + action);
    }
  } catch (err) {
    return errorResponse('UNKNOWN_ERROR', err.message);
  }
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) body = JSON.parse(e.postData.contents);
    var action = body.action || '';
    switch (action) {
      case 'updateAttendance': return handleUpdateAttendance(body);
      case 'addSession': return handleAddSession(body);
      case 'updateSession': return handleUpdateSession(body);
      case 'deleteSession': return handleDeleteSession(body);
      default: return errorResponse('INVALID_PARAMS', '不明なアクションです: ' + action);
    }
  } catch (err) {
    return errorResponse('UNKNOWN_ERROR', err.message);
  }
}

// ===== ハンドラー =====
function handleGetSessions() {
  var data = getSessions();
  return successResponse({ sessions: data.sessions, members: data.members });
}

function handleUpdateAttendance(body) {
  var rowIndex = Number(body.rowIndex);
  var memberName = body.memberName || '';
  var status = body.status || '';
  var note = body.note || '';
  var validStatuses = ['○', '×', '△'];
  if (!rowIndex || rowIndex < 1) return errorResponse('INVALID_PARAMS', '行番号が不正です');
  if (!memberName) return errorResponse('INVALID_PARAMS', 'メンバー名は必須です');
  if (!status || validStatuses.indexOf(status) === -1) return errorResponse('INVALID_PARAMS', 'ステータスは ○, ×, △ のいずれか');
  if (note && note.length > 20) return errorResponse('INVALID_PARAMS', 'メモは20文字以内');

  return withLock(function() {
    var sheet = openSheet();
    var members = getMembers();
    updateAttendanceCell(sheet, rowIndex, memberName, members, status, note);
    return successResponse({ message: '出欠を更新しました' });
  });
}

function handleAddSession(body) {
  var date = body.date || '';
  var venue = body.venue || '';
  var startTime = body.startTime || '';
  var endTime = body.endTime || '';
  if (!date || !venue || !startTime) return errorResponse('INVALID_PARAMS', '日付・会場・開始時刻は必須です');
  if (endTime && endTime <= startTime) return errorResponse('INVALID_PARAMS', '終了時刻は開始時刻より後にしてください');

  return withLock(function() {
    var sheet = openSheet();
    addSessionRow(sheet, body);
    return successResponse({ message: '練習日を追加しました' });
  });
}

function handleUpdateSession(body) {
  var rowIndex = Number(body.rowIndex);
  var date = body.date || '';
  var venue = body.venue || '';
  var startTime = body.startTime || '';
  var endTime = body.endTime || '';
  if (!date || !venue || !startTime) return errorResponse('INVALID_PARAMS', '日付・会場・開始時刻は必須です');
  if (endTime && endTime <= startTime) return errorResponse('INVALID_PARAMS', '終了時刻は開始時刻より後にしてください');

  return withLock(function() {
    var sheet = openSheet();
    var mismatchError = verifyRowContent(sheet, rowIndex, body.expectedDate || '', body.expectedVenue || '', body.expectedStartTime || '');
    if (mismatchError) return mismatchError;
    updateSessionRow(sheet, rowIndex, body);
    return successResponse({ message: '練習日を更新しました' });
  });
}

function handleDeleteSession(body) {
  var rowIndex = Number(body.rowIndex);
  if (!rowIndex || rowIndex < 1) return errorResponse('INVALID_PARAMS', '行番号が不正です');

  return withLock(function() {
    var sheet = openSheet();
    var mismatchError = verifyRowContent(sheet, rowIndex, body.expectedDate || '', body.expectedVenue || '', body.expectedStartTime || '');
    if (mismatchError) return mismatchError;
    deleteSessionRow(sheet, rowIndex);
    return successResponse({ message: '練習日を削除しました' });
  });
}

// ===== スプレッドシート操作 =====
function openSheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];
}

function getMembers() {
  var sheet = openSheet();
  var lastCol = sheet.getLastColumn();
  if (lastCol < MEMBER_START_COL_INDEX + 1) return [];
  var vals = sheet.getRange(HEADER_ROW, MEMBER_START_COL_INDEX + 1, 1, lastCol - MEMBER_START_COL_INDEX).getValues()[0];
  var members = [];
  for (var i = 0; i < vals.length; i++) {
    var name = String(vals[i]).trim();
    if (name !== '') members.push(name);
  }
  return members;
}

function getSessions() {
  var sheet = openSheet();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < DATA_START_ROW) return { sessions: [], members: [] };

  var headerVals = sheet.getRange(HEADER_ROW, MEMBER_START_COL_INDEX + 1, 1, lastCol - MEMBER_START_COL_INDEX).getValues()[0];
  var members = [];
  for (var i = 0; i < headerVals.length; i++) {
    var name = String(headerVals[i]).trim();
    if (name !== '') members.push(name);
  }

  var numRows = lastRow - DATA_START_ROW + 1;
  var data = sheet.getRange(DATA_START_ROW, 1, numRows, lastCol).getValues();
  var sessions = [];
  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    if (!row[0] && row[0] !== 0) continue;
    sessions.push(rowToSession(row, DATA_START_ROW + r, members));
  }
  return { sessions: sessions, members: members };
}

function rowToSession(row, rowIndex, memberNames) {
  var attendance = [];
  for (var i = 0; i < memberNames.length; i++) {
    attendance.push({ memberName: memberNames[i], status: parseStatus(row[MEMBER_START_COL_INDEX + i]), note: parseNote(row[MEMBER_START_COL_INDEX + i]) });
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

function updateAttendanceCell(sheet, rowIndex, memberName, members, status, note) {
  var idx = members.indexOf(memberName);
  if (idx === -1) throw new Error('メンバーが見つかりません: ' + memberName);
  var cellValue = (status === '△' && note) ? '△（' + note + '）' : status;
  sheet.getRange(rowIndex, MEMBER_START_COL_INDEX + 1 + idx).setValue(cellValue);
}

function addSessionRow(sheet, data) {
  var newRow = sheet.getLastRow() + 1;
  var values = [data.date||'', data.dayOfWeek||'', data.venue||'', data.startTime||'', data.endTime||'', data.reservationId||'', data.notes||'', 0];
  sheet.getRange(newRow, 1, 1, values.length).setValues([values]);
}

function updateSessionRow(sheet, rowIndex, data) {
  var values = [data.date||'', data.dayOfWeek||'', data.venue||'', data.startTime||'', data.endTime||'', data.reservationId||'', data.notes||''];
  sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
}

function deleteSessionRow(sheet, rowIndex) {
  sheet.deleteRow(rowIndex);
}

function withLock(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return errorResponse('WRITE_CONFLICT', '同時書き込みのため処理できませんでした');
  try { return fn(); } finally { lock.releaseLock(); }
}

// ===== 行内容検証 =====
function verifyRowContent(sheet, rowIndex, expectedDate, expectedVenue, expectedStartTime) {
  var row = sheet.getRange(rowIndex, 1, 1, 4).getValues()[0];
  var actualDate = formatDate(row[0]);
  var actualVenue = String(row[2]);
  var actualStartTime = formatTime(row[3]);
  if (actualDate !== expectedDate || actualVenue !== expectedVenue || actualStartTime !== expectedStartTime) {
    return errorResponse('ROW_MISMATCH', '行の内容が変更されています。再読み込みしてください');
  }
  return null;
}

// ===== ヘルパー =====
function formatDate(value) {
  if (!value && value !== 0) return '';
  if (value instanceof Date) {
    return value.getFullYear() + '-' + ('0'+(value.getMonth()+1)).slice(-2) + '-' + ('0'+value.getDate()).slice(-2);
  }
  if (typeof value === 'string') {
    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) return value;
    var jp = value.match(/^(\d{1,2})月(\d{1,2})日$/);
    if (jp) return new Date().getFullYear() + '-' + ('0'+jp[1]).slice(-2) + '-' + ('0'+jp[2]).slice(-2);
  }
  var d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2);
}

function formatTime(value) {
  if (!value && value !== 0) return '';
  if (typeof value === 'string') {
    var n = value.replace(/：/g, ':');
    var m = n.match(/^(\d{1,2}):(\d{2})/);
    if (m) return ('0'+m[1]).slice(-2) + ':' + m[2];
  }
  if (value instanceof Date) return ('0'+value.getHours()).slice(-2) + ':' + ('0'+value.getMinutes()).slice(-2);
  if (typeof value === 'number' && value >= 0 && value < 1) {
    var total = Math.round(value * 24 * 60);
    return ('0'+Math.floor(total/60)).slice(-2) + ':' + ('0'+(total%60)).slice(-2);
  }
  return String(value);
}

function parseStatus(v) {
  if (!v && v !== 0) return '';
  var s = String(v).trim();
  if (s === '○' || s === '〇') return '○';
  if (s === '×' || s === '✕') return '×';
  if (s.charAt(0) === '△') return '△';
  if (s.charAt(0) === '〇') return '○';
  return '';
}

function parseNote(v) {
  if (!v && v !== 0) return '';
  var s = String(v).trim();
  if (s.charAt(0) !== '△') return '';
  var m = s.match(/[（(](.+?)[）)]/);
  return m ? m[1] : '';
}
