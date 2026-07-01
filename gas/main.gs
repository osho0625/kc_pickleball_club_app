/**
 * main.gs - doGet/doPost ルーター
 * GAS Webアプリのエントリーポイント。actionパラメータでハンドラーをディスパッチする。
 * 
 * GET actions: getSessions, listBackups
 * POST actions: updateAttendance, addSession, updateSession, deleteSession, backup, restore
 * 
 * Requirements: 8.1, 8.4
 */

/**
 * HTTP GET リクエストハンドラー
 * @param {Object} e - GASイベントオブジェクト
 * @param {Object} e.parameter - URLクエリパラメータ
 * @returns {GoogleAppsScript.Content.TextOutput} JSON レスポンス
 */
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || '';

    switch (action) {
      case 'getSessions':
        return handleGetSessions();
      case 'listBackups':
        return listBackups();
      default:
        return errorResponse('INVALID_PARAMS', '不明なアクションです: ' + action);
    }
  } catch (err) {
    return errorResponse('UNKNOWN_ERROR', '予期しないエラーが発生しました: ' + err.message);
  }
}

/**
 * HTTP POST リクエストハンドラー
 * @param {Object} e - GASイベントオブジェクト
 * @param {Object} e.postData - POSTデータ
 * @returns {GoogleAppsScript.Content.TextOutput} JSON レスポンス
 */
function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var action = body.action || '';

    switch (action) {
      case 'updateAttendance':
        return handleUpdateAttendance(body);
      case 'addSession':
        return handleAddSession(body);
      case 'updateSession':
        return handleUpdateSession(body);
      case 'deleteSession':
        return handleDeleteSession(body);
      case 'backup':
        return backup();
      case 'restore':
        return handleRestore(body);
      default:
        return errorResponse('INVALID_PARAMS', '不明なアクションです: ' + action);
    }
  } catch (err) {
    return errorResponse('UNKNOWN_ERROR', '予期しないエラーが発生しました: ' + err.message);
  }
}

// ===== アクションハンドラー =====

/**
 * getSessions ハンドラー: 全セッションとメンバーリストを返す
 */
function handleGetSessions() {
  var data = getSessions();
  return successResponse({ sessions: data.sessions, members: data.members });
}

/**
 * updateAttendance ハンドラー: 出欠を書き込む
 * @param {Object} body - リクエストボディ
 */
function handleUpdateAttendance(body) {
  var rowIndex = Number(body.rowIndex);
  var memberName = body.memberName || '';
  var status = body.status || '';
  var note = body.note || '';

  // バリデーション
  var validationError = validateAttendanceParams(rowIndex, memberName, status, note);
  if (validationError) {
    return validationError;
  }

  return withLock(function() {
    var sheet = openSheet();
    var members = getMembers();
    updateAttendanceCell(sheet, rowIndex, memberName, members, status, note);
    return successResponse({ message: '出欠を更新しました' });
  });
}

/**
 * addSession ハンドラー: 新規セッション行を追加する
 * @param {Object} body - リクエストボディ
 */
function handleAddSession(body) {
  var date = body.date || '';
  var venue = body.venue || '';
  var startTime = body.startTime || '';
  var endTime = body.endTime || '';
  var reservationId = body.reservationId || '';
  var notes = body.notes || '';
  var dayOfWeek = body.dayOfWeek || '';

  // バリデーション
  var validationError = validateSessionParams(date, venue, startTime, endTime);
  if (validationError) {
    return validationError;
  }

  return withLock(function() {
    var sheet = openSheet();
    addSessionRow(sheet, {
      date: date,
      dayOfWeek: dayOfWeek,
      venue: venue,
      startTime: startTime,
      endTime: endTime,
      reservationId: reservationId,
      notes: notes
    });
    return successResponse({ message: '練習日を追加しました' });
  });
}

/**
 * updateSession ハンドラー: 既存セッション行を更新する
 * @param {Object} body - リクエストボディ
 */
function handleUpdateSession(body) {
  var rowIndex = Number(body.rowIndex);
  var date = body.date || '';
  var venue = body.venue || '';
  var startTime = body.startTime || '';
  var endTime = body.endTime || '';
  var reservationId = body.reservationId || '';
  var notes = body.notes || '';
  var dayOfWeek = body.dayOfWeek || '';
  var expectedDate = body.expectedDate || '';
  var expectedVenue = body.expectedVenue || '';
  var expectedStartTime = body.expectedStartTime || '';

  // バリデーション
  var validationError = validateSessionParams(date, venue, startTime, endTime);
  if (validationError) {
    return validationError;
  }

  return withLock(function() {
    var sheet = openSheet();

    // 行内容検証（楽観的排他制御）
    var mismatchError = verifyRowContent(sheet, rowIndex, expectedDate, expectedVenue, expectedStartTime);
    if (mismatchError) {
      return mismatchError;
    }

    updateSessionRow(sheet, rowIndex, {
      date: date,
      dayOfWeek: dayOfWeek,
      venue: venue,
      startTime: startTime,
      endTime: endTime,
      reservationId: reservationId,
      notes: notes
    });
    return successResponse({ message: '練習日を更新しました' });
  });
}

/**
 * deleteSession ハンドラー: セッション行を削除する
 * @param {Object} body - リクエストボディ
 */
function handleDeleteSession(body) {
  var rowIndex = Number(body.rowIndex);
  var expectedDate = body.expectedDate || '';
  var expectedVenue = body.expectedVenue || '';
  var expectedStartTime = body.expectedStartTime || '';

  if (!rowIndex || rowIndex < 1) {
    return errorResponse('INVALID_PARAMS', '行番号が不正です');
  }

  return withLock(function() {
    var sheet = openSheet();

    // 行内容検証（楽観的排他制御）
    var mismatchError = verifyRowContent(sheet, rowIndex, expectedDate, expectedVenue, expectedStartTime);
    if (mismatchError) {
      return mismatchError;
    }

    deleteSessionRow(sheet, rowIndex);
    return successResponse({ message: '練習日を削除しました' });
  });
}

/**
 * restore ハンドラー: バックアップからスプレッドシートを復元する
 * @param {Object} body - リクエストボディ
 */
function handleRestore(body) {
  var fileName = body.fileName || '';

  if (!fileName) {
    return errorResponse('INVALID_PARAMS', '復元元ファイル名が指定されていません');
  }

  return withLock(function() {
    return restoreFromBackup(fileName);
  });
}
