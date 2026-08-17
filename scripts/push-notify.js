/**
 * push-notify.js - Push通知配信スクリプト
 * GitHub Actions cronで実行される。
 * 
 * 処理フロー:
 * 1. Supabase push_messages から sent=false のメッセージを取得
 * 2. 各メッセージに対して対象の push_subscriptions を取得
 * 3. web-push ライブラリで各端末に配信
 * 4. 配信済みメッセージの sent を true に更新
 * 5. 期限切れサブスクリプション（410/404）を削除
 * 
 * 環境変数:
 * - SUPABASE_URL
 * - SUPABASE_KEY
 * - VAPID_PUBLIC_KEY
 * - VAPID_PRIVATE_KEY
 * - VAPID_EMAIL
 */

import webpush from 'web-push';

const {
  SUPABASE_URL,
  SUPABASE_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_EMAIL,
} = process.env;

// バリデーション
if (!SUPABASE_URL || !SUPABASE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_EMAIL) {
  console.error('必要な環境変数が設定されていません');
  process.exit(1);
}

// VAPID設定
webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

/**
 * Supabase REST APIへのfetchラッパー
 */
async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const response = await fetch(url, { ...options, headers });
  return response;
}

/**
 * 未送信のPushメッセージを取得する
 */
async function getUnsentMessages() {
  const response = await supabaseFetch('push_messages?sent=eq.false&order=created_at.asc');
  if (!response.ok) {
    console.error('メッセージ取得失敗:', response.status);
    return [];
  }
  return await response.json();
}

/**
 * 対象の購読情報を取得する
 * @param {string|null} targetMemberName - 特定メンバー名（null=全員）
 */
async function getSubscriptions(targetMemberName) {
  let query = 'push_subscriptions?select=*';
  if (targetMemberName) {
    query += `&member_name=eq.${encodeURIComponent(targetMemberName)}`;
  }
  const response = await supabaseFetch(query);
  if (!response.ok) {
    console.error('購読情報取得失敗:', response.status);
    return [];
  }
  return await response.json();
}

/**
 * メッセージを送信済みにする
 * @param {string} messageId - メッセージID
 */
async function markAsSent(messageId) {
  await supabaseFetch(`push_messages?id=eq.${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ sent: true }),
  });
}

/**
 * 期限切れの購読を削除する
 * @param {string} subscriptionId - 購読ID
 */
async function deleteSubscription(subscriptionId) {
  await supabaseFetch(`push_subscriptions?id=eq.${subscriptionId}`, {
    method: 'DELETE',
  });
  console.log(`期限切れサブスクリプション削除: ${subscriptionId}`);
}

/**
 * 1件のPushメッセージを全対象端末に配信する
 */
async function deliverMessage(message) {
  const subscriptions = await getSubscriptions(message.target_member_name);

  if (subscriptions.length === 0) {
    console.log(`対象端末なし (message: ${message.id})`);
    await markAsSent(message.id);
    return;
  }

  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
  });

  let successCount = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub.subscription, payload);
      successCount++;
    } catch (error) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        // 購読が無効 → 削除
        await deleteSubscription(sub.id);
      } else {
        console.error(`配信失敗 (device: ${sub.device_id}):`, error.message);
      }
    }
  }

  console.log(`配信完了: "${message.title}" → ${successCount}/${subscriptions.length}台`);
  await markAsSent(message.id);
}

/**
 * メイン処理
 */
async function main() {
  console.log('Push通知配信処理を開始...');

  const messages = await getUnsentMessages();
  console.log(`未送信メッセージ: ${messages.length}件`);

  if (messages.length === 0) {
    console.log('配信対象なし。終了。');
    return;
  }

  for (const message of messages) {
    await deliverMessage(message);
  }

  console.log('Push通知配信処理が完了しました。');
}

main().catch((error) => {
  console.error('致命的エラー:', error);
  process.exit(1);
});
