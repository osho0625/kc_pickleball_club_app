/**
 * github.gs - GitHub API連携（バックアップ/復元）
 * GitHub Contents APIを使用してスプレッドシートデータのバックアップ・復元を行う。
 * 
 * Script Properties:
 * - GITHUB_TOKEN: GitHub Personal Access Token
 * - GITHUB_OWNER: リポジトリオーナー
 * - GITHUB_REPO: リポジトリ名
 * 
 * Requirements: 9.1-9.5, 10.1-10.6, 8.1
 */

/**
 * GitHub設定をScript Propertiesから取得する
 * @returns {{ token: string, owner: string, repo: string }}
 */
function getGitHubConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    token: props.getProperty('GITHUB_TOKEN') || '',
    owner: props.getProperty('GITHUB_OWNER') || '',
    repo: props.getProperty('GITHUB_REPO') || ''
  };
}

/**
 * JSTの現在日時からバックアップファイル名を生成する
 * @returns {string} "backups/pickleball_YYYYMMDD_HHmmss.json"
 */
function generateBackupFilename() {
  var now = new Date();
  return generateBackupFilenameFromDate(now);
}

/**
 * 指定日時からバックアップファイル名を生成する（テスト可能なピュア関数）
 * @param {Date} date - 日時オブジェクト
 * @returns {string} "backups/pickleball_YYYYMMDD_HHmmss.json"
 */
function generateBackupFilenameFromDate(date) {
  // JST (UTC+9) に変換
  var jstOffset = 9 * 60 * 60 * 1000;
  var jst = new Date(date.getTime() + jstOffset);
  
  var year = jst.getUTCFullYear();
  var month = ('0' + (jst.getUTCMonth() + 1)).slice(-2);
  var day = ('0' + jst.getUTCDate()).slice(-2);
  var hours = ('0' + jst.getUTCHours()).slice(-2);
  var minutes = ('0' + jst.getUTCMinutes()).slice(-2);
  var seconds = ('0' + jst.getUTCSeconds()).slice(-2);
  
  return 'backups/pickleball_' + year + month + day + '_' + hours + minutes + seconds + '.json';
}

/**
 * 全データをJSON化してGitHubにバックアップする
 * @returns {GoogleAppsScript.Content.TextOutput} 成功/エラーレスポンス
 */
function backup() {
  var config = getGitHubConfig();
  if (!config.token || !config.owner || !config.repo) {
    return errorResponse('GITHUB_ERROR', 'GitHub設定が不完全です。Script Propertiesを確認してください');
  }

  try {
    // スプレッドシートから全データ取得
    var data = getSessions();
    var members = data.members;
    var sessions = data.sessions;

    // バックアップJSON構築
    var backupData = {
      exportedAt: getJSTISOString(new Date()),
      spreadsheetId: SPREADSHEET_ID,
      members: members,
      sessions: sessions.map(function(session) {
        var attendance = {};
        session.attendance.forEach(function(att) {
          attendance[att.memberName] = { status: att.status, note: att.note };
        });
        return {
          date: session.date,
          dayOfWeek: session.dayOfWeek,
          venue: session.venue,
          startTime: session.startTime,
          endTime: session.endTime,
          reservationId: session.reservationId,
          notes: session.notes,
          attendance: attendance
        };
      })
    };

    var fileName = generateBackupFilename();
    var content = JSON.stringify(backupData, null, 2);

    // GitHub APIでコミット
    var result = commitToGitHub(config, fileName, content, 'Backup: ' + fileName);
    if (result.error) {
      return errorResponse('GITHUB_ERROR', result.error);
    }

    return successResponse({ message: 'バックアップが完了しました: ' + fileName });
  } catch (e) {
    return errorResponse('GITHUB_ERROR', 'バックアップに失敗しました: ' + e.message);
  }
}

/**
 * GitHubのbackupsディレクトリ一覧を取得する
 * @returns {GoogleAppsScript.Content.TextOutput} バックアップファイル一覧
 */
function listBackups() {
  var config = getGitHubConfig();
  if (!config.token || !config.owner || !config.repo) {
    return errorResponse('GITHUB_ERROR', 'GitHub設定が不完全です。Script Propertiesを確認してください');
  }

  try {
    var url = 'https://api.github.com/repos/' + config.owner + '/' + config.repo + '/contents/backups';
    var options = {
      method: 'get',
      headers: {
        'Authorization': 'token ' + config.token,
        'Accept': 'application/vnd.github.v3+json'
      },
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();

    if (statusCode === 404) {
      return successResponse({ backups: [] });
    }
    if (statusCode !== 200) {
      return errorResponse('GITHUB_ERROR', 'GitHub APIエラー: HTTP ' + statusCode);
    }

    var files = JSON.parse(response.getContentText());
    var backups = files
      .filter(function(f) { return f.type === 'file' && f.name.endsWith('.json'); })
      .map(function(f) {
        return { name: f.name, path: f.path, size: f.size, sha: f.sha };
      })
      .sort(function(a, b) { return b.name.localeCompare(a.name); }); // 新しい順

    return successResponse({ backups: backups });
  } catch (e) {
    return errorResponse('GITHUB_ERROR', 'バックアップ一覧の取得に失敗しました: ' + e.message);
  }
}

/**
 * 特定バックアップファイルの内容を取得する
 * @param {string} fileName - ファイル名（例: "pickleball_20250701_100000.json"）
 * @returns {GoogleAppsScript.Content.TextOutput} バックアップ内容
 */
function getBackupContent(fileName) {
  var config = getGitHubConfig();
  if (!config.token || !config.owner || !config.repo) {
    return errorResponse('GITHUB_ERROR', 'GitHub設定が不完全です。Script Propertiesを確認してください');
  }

  try {
    var path = fileName.indexOf('backups/') === 0 ? fileName : 'backups/' + fileName;
    var url = 'https://api.github.com/repos/' + config.owner + '/' + config.repo + '/contents/' + path;
    var options = {
      method: 'get',
      headers: {
        'Authorization': 'token ' + config.token,
        'Accept': 'application/vnd.github.v3+json'
      },
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      return errorResponse('GITHUB_ERROR', 'バックアップファイルの取得に失敗しました: HTTP ' + statusCode);
    }

    var fileData = JSON.parse(response.getContentText());
    var content = Utilities.newBlob(Utilities.base64Decode(fileData.content)).getDataAsString();
    var backupData = JSON.parse(content);

    return successResponse({ backup: backupData });
  } catch (e) {
    return errorResponse('GITHUB_ERROR', 'バックアップ内容の取得に失敗しました: ' + e.message);
  }
}

/**
 * バックアップからスプレッドシートを復元する
 * 復元前に自動バックアップを作成する
 * @param {string} fileName - 復元元ファイル名
 * @returns {GoogleAppsScript.Content.TextOutput} 成功/エラーレスポンス
 */
function restoreFromBackup(fileName) {
  var config = getGitHubConfig();
  if (!config.token || !config.owner || !config.repo) {
    return errorResponse('GITHUB_ERROR', 'GitHub設定が不完全です。Script Propertiesを確認してください');
  }

  if (!fileName) {
    return errorResponse('INVALID_PARAMS', '復元元ファイル名が指定されていません');
  }

  try {
    // 1. 復元前自動バックアップを作成（prerestore）
    var preRestoreResult = createPreRestoreBackup(config);
    if (preRestoreResult.error) {
      return errorResponse('GITHUB_ERROR', '復元前バックアップの作成に失敗しました: ' + preRestoreResult.error);
    }

    // 2. バックアップ内容を取得
    var path = fileName.indexOf('backups/') === 0 ? fileName : 'backups/' + fileName;
    var url = 'https://api.github.com/repos/' + config.owner + '/' + config.repo + '/contents/' + path;
    var options = {
      method: 'get',
      headers: {
        'Authorization': 'token ' + config.token,
        'Accept': 'application/vnd.github.v3+json'
      },
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      return errorResponse('GITHUB_ERROR', '復元元ファイルの取得に失敗しました: HTTP ' + response.getResponseCode());
    }

    var fileData = JSON.parse(response.getContentText());
    var content = Utilities.newBlob(Utilities.base64Decode(fileData.content)).getDataAsString();
    var backupData = JSON.parse(content);

    // 3. スプレッドシートを上書き復元
    restoreSpreadsheet(backupData);

    return successResponse({ message: '復元が完了しました。復元前バックアップ: ' + preRestoreResult.fileName });
  } catch (e) {
    return errorResponse('GITHUB_ERROR', '復元に失敗しました: ' + e.message);
  }
}

// ===== ヘルパー関数 =====

/**
 * 復元前の自動バックアップを作成する
 * @param {Object} config - GitHub設定
 * @returns {{ fileName: string }|{ error: string }}
 */
function createPreRestoreBackup(config) {
  try {
    var data = getSessions();
    var members = data.members;
    var sessions = data.sessions;

    var backupData = {
      exportedAt: getJSTISOString(new Date()),
      spreadsheetId: SPREADSHEET_ID,
      members: members,
      sessions: sessions.map(function(session) {
        var attendance = {};
        session.attendance.forEach(function(att) {
          attendance[att.memberName] = { status: att.status, note: att.note };
        });
        return {
          date: session.date,
          dayOfWeek: session.dayOfWeek,
          venue: session.venue,
          startTime: session.startTime,
          endTime: session.endTime,
          reservationId: session.reservationId,
          notes: session.notes,
          attendance: attendance
        };
      })
    };

    // prerestore ファイル名生成
    var baseName = generateBackupFilename();
    var fileName = baseName.replace('.json', '_prerestore.json');
    var content = JSON.stringify(backupData, null, 2);

    var result = commitToGitHub(config, fileName, content, 'Pre-restore backup: ' + fileName);
    if (result.error) {
      return { error: result.error };
    }

    return { fileName: fileName };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * GitHub Contents APIでファイルをコミットする
 * @param {Object} config - GitHub設定
 * @param {string} path - ファイルパス
 * @param {string} content - ファイル内容
 * @param {string} commitMessage - コミットメッセージ
 * @returns {{ success: boolean }|{ error: string }}
 */
function commitToGitHub(config, path, content, commitMessage) {
  var url = 'https://api.github.com/repos/' + config.owner + '/' + config.repo + '/contents/' + path;

  // 既存ファイルのSHA取得（更新時に必要）
  var sha = getFileSha(config, path);

  var payload = {
    message: commitMessage,
    content: Utilities.base64Encode(content, Utilities.Charset.UTF_8)
  };
  if (sha) {
    payload.sha = sha;
  }

  var options = {
    method: 'put',
    headers: {
      'Authorization': 'token ' + config.token,
      'Accept': 'application/vnd.github.v3+json'
    },
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var statusCode = response.getResponseCode();

  if (statusCode === 200 || statusCode === 201) {
    return { success: true };
  }

  return { error: 'GitHub PUT API エラー: HTTP ' + statusCode + ' - ' + response.getContentText() };
}

/**
 * GitHubファイルのSHAを取得する（存在しない場合はnull）
 * @param {Object} config - GitHub設定
 * @param {string} path - ファイルパス
 * @returns {string|null} SHA文字列またはnull
 */
function getFileSha(config, path) {
  var url = 'https://api.github.com/repos/' + config.owner + '/' + config.repo + '/contents/' + path;
  var options = {
    method: 'get',
    headers: {
      'Authorization': 'token ' + config.token,
      'Accept': 'application/vnd.github.v3+json'
    },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() === 200) {
    var data = JSON.parse(response.getContentText());
    return data.sha;
  }
  return null;
}

/**
 * バックアップデータからスプレッドシートを復元する
 * @param {Object} backupData - バックアップJSONデータ
 */
function restoreSpreadsheet(backupData) {
  var sheet = openSheet();
  var members = backupData.members;
  var sessions = backupData.sessions;

  // データ行をクリア（ヘッダー行は保持）
  var lastRow = sheet.getLastRow();
  if (lastRow >= DATA_START_ROW) {
    sheet.deleteRows(DATA_START_ROW, lastRow - DATA_START_ROW + 1);
  }

  // セッションデータを書き込み
  for (var i = 0; i < sessions.length; i++) {
    var session = sessions[i];
    var rowIndex = DATA_START_ROW + i;
    
    // 行追加が必要な場合
    if (rowIndex > sheet.getLastRow()) {
      sheet.insertRowAfter(sheet.getLastRow());
    }

    // 基本データ（A〜H列）
    var baseValues = [
      session.date || '',
      session.dayOfWeek || '',
      session.venue || '',
      session.startTime || '',
      session.endTime || '',
      session.reservationId || '',
      session.notes || '',
      0 // 参加人数（後で計算）
    ];
    sheet.getRange(rowIndex, 1, 1, baseValues.length).setValues([baseValues]);

    // 出欠データ（I列以降）
    var attendanceValues = [];
    var participantCount = 0;
    for (var m = 0; m < members.length; m++) {
      var memberName = members[m];
      var att = session.attendance[memberName];
      if (att) {
        if (att.status === '△' && att.note) {
          attendanceValues.push('△（' + att.note + '）');
        } else {
          attendanceValues.push(att.status || '');
        }
        if (att.status === '○' || att.status === '△') {
          participantCount++;
        }
      } else {
        attendanceValues.push('');
      }
    }

    if (attendanceValues.length > 0) {
      sheet.getRange(rowIndex, MEMBER_START_COL_INDEX + 1, 1, attendanceValues.length).setValues([attendanceValues]);
    }

    // 参加人数を更新
    sheet.getRange(rowIndex, 8).setValue(participantCount);
  }
}

/**
 * 現在日時のJST ISO 8601文字列を返す
 * @param {Date} date - 日時オブジェクト
 * @returns {string} ISO 8601形式文字列（+09:00）
 */
function getJSTISOString(date) {
  var jstOffset = 9 * 60 * 60 * 1000;
  var jst = new Date(date.getTime() + jstOffset);
  
  var year = jst.getUTCFullYear();
  var month = ('0' + (jst.getUTCMonth() + 1)).slice(-2);
  var day = ('0' + jst.getUTCDate()).slice(-2);
  var hours = ('0' + jst.getUTCHours()).slice(-2);
  var minutes = ('0' + jst.getUTCMinutes()).slice(-2);
  var seconds = ('0' + jst.getUTCSeconds()).slice(-2);
  
  return year + '-' + month + '-' + day + 'T' + hours + ':' + minutes + ':' + seconds + '+09:00';
}
