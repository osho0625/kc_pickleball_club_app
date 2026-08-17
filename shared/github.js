/**
 * shared/github.js - GitHubバックアップのピュアロジック
 * GAS版(github.gs)と同一ロジック。テスト対象としてNode.js側からimport可能。
 */

/**
 * 指定日時からバックアップファイル名を生成する（JST timezone）
 * @param {Date} date - 日時オブジェクト
 * @returns {string} "backups/pickleball_YYYYMMDD_HHmmss.json"
 */
export function generateBackupFilenameFromDate(date) {
  // JST (UTC+9) に変換
  const jstOffset = 9 * 60 * 60 * 1000;
  const jst = new Date(date.getTime() + jstOffset);

  const year = jst.getUTCFullYear();
  const month = ('0' + (jst.getUTCMonth() + 1)).slice(-2);
  const day = ('0' + jst.getUTCDate()).slice(-2);
  const hours = ('0' + jst.getUTCHours()).slice(-2);
  const minutes = ('0' + jst.getUTCMinutes()).slice(-2);
  const seconds = ('0' + jst.getUTCSeconds()).slice(-2);

  return 'backups/pickleball_' + year + month + day + '_' + hours + minutes + seconds + '.json';
}
