/**
 * push-trigger.gs - 練習日当日のPush通知をSupabaseキューに登録する
 * 
 * GASの時限トリガーで毎日8:00と17:30に実行される。
 * 当日の練習日がある場合、push_messagesテーブルに通知メッセージをINSERTする。
 * 
 * Script Properties:
 * - SUPABASE_URL: SupabaseプロジェクトのURL
 * - SUPABASE_KEY: Supabase anon key
 */

/** Supabase設定をScript Propertiesから取得 */
function getSupabaseConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    url: props.getProperty('SUPABASE_URL'),
    key: props.getProperty('SUPABASE_KEY')
  };
}

/**
 * 当日の練習日を検出してPush通知をキューに登録する
 * GAS時限トリガーで呼び出される
 */
function queueTodayPushNotifications() {
  var today = getTodayDateString();
  var data = getSessions();
  var sessions = data.sessions || [];

  // 当日の練習日を抽出
  var todaySessions = [];
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].date === today) {
      todaySessions.push(sessions[i]);
    }
  }

  if (todaySessions.length === 0) {
    Logger.log('本日の練習日はありません: ' + today);
    return;
  }

  // 現在時刻に応じたメッセージを組み立て
  var now = new Date();
  var jstHour = (now.getUTCHours() + 9) % 24;
  var timeLabel = jstHour < 12 ? '本日' : '今日この後';

  for (var j = 0; j < todaySessions.length; j++) {
    var session = todaySessions[j];
    var title = '🏓 ' + timeLabel + '練習日です！';
    var body = session.venue + ' ' + session.startTime + '〜' + session.endTime;
    if (session.participantCount > 0) {
      body += '（現在' + session.participantCount + '人参加）';
    }

    insertPushMessage(title, body, null);
  }

  Logger.log(todaySessions.length + '件の通知をキューに登録しました');
}

/**
 * Supabase push_messagesテーブルにメッセージを登録する
 * @param {string} title - 通知タイトル
 * @param {string} body - 通知本文
 * @param {string|null} targetMemberName - 特定メンバーに限定する場合（null=全員）
 */
function insertPushMessage(title, body, targetMemberName) {
  var config = getSupabaseConfig();
  if (!config.url || !config.key) {
    Logger.log('Supabase設定が未完了です');
    return;
  }

  var payload = {
    title: title,
    body: body,
    target_member_name: targetMemberName,
    sent: false
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': config.key,
      'Authorization': 'Bearer ' + config.key,
      'Prefer': 'return=minimal'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(config.url + '/rest/v1/push_messages', options);
  var code = response.getResponseCode();
  if (code !== 201 && code !== 200) {
    Logger.log('push_messages INSERT失敗: ' + code + ' ' + response.getContentText());
  }
}

/**
 * 今日の日付をJSTで YYYY-MM-DD 形式で返す
 * @returns {string}
 */
function getTodayDateString() {
  var now = new Date();
  // JSTオフセット (UTC+9)
  var jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  var year = jst.getUTCFullYear();
  var month = ('0' + (jst.getUTCMonth() + 1)).slice(-2);
  var day = ('0' + jst.getUTCDate()).slice(-2);
  return year + '-' + month + '-' + day;
}

/**
 * 時限トリガーを設定する（初回のみ手動実行）
 * 毎日8:00と17:30にqueueTodayPushNotificationsを実行するトリガーを作成
 */
function setupPushTriggers() {
  // 既存トリガーを削除（重複防止）
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'queueTodayPushNotifications') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // 毎日8:00のトリガー
  ScriptApp.newTrigger('queueTodayPushNotifications')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();

  // 毎日17:30用：17時台トリガー（GASは分単位指定が限定的なので17時台に設定）
  ScriptApp.newTrigger('queueTodayPushNotifications')
    .timeBased()
    .atHour(17)
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();

  Logger.log('Push通知トリガーを設定しました（毎日8時台・17時台）');
}
