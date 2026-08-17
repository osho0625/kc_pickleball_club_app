/**
 * VAPID鍵ペア生成スクリプト
 * 実行: node scripts/generate-vapid-keys.js
 * 生成された鍵をGitHub SecretsとCOMMON.jsに設定する
 */
import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('=== VAPID Keys Generated ===');
console.log('');
console.log('Public Key (フロントエンドの VAPID_PUBLIC_KEY に設定):');
console.log(vapidKeys.publicKey);
console.log('');
console.log('Private Key (GitHub Secrets の VAPID_PRIVATE_KEY に設定):');
console.log(vapidKeys.privateKey);
console.log('');
console.log('=== 設定箇所 ===');
console.log('1. common.js の VAPID_PUBLIC_KEY に Public Key を設定');
console.log('2. GitHub Secrets に以下を設定:');
console.log('   - VAPID_PUBLIC_KEY');
console.log('   - VAPID_PRIVATE_KEY');
console.log('   - VAPID_EMAIL (例: mailto:your-email@example.com)');
console.log('   - SUPABASE_URL');
console.log('   - SUPABASE_KEY');
