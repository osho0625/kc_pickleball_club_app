/**
 * response.gs - 統一レスポンスビルダー
 * GAS APIのJSON応答を統一形式で生成する。
 * 
 * 形式: { success: boolean, data?: any, error?: { code: string, message: string } }
 */

/**
 * 成功レスポンスを生成する
 * @param {Object} [data] - レスポンスデータ（オプション）
 * @returns {GoogleAppsScript.Content.TextOutput} JSON形式のHTTPレスポンス
 */
function successResponse(data) {
  const body = buildSuccessBody(data);
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * エラーレスポンスを生成する
 * @param {string} code - エラーコード (ROW_MISMATCH | WRITE_CONFLICT | SPREADSHEET_ERROR | INVALID_PARAMS | GITHUB_ERROR | UNKNOWN_ERROR)
 * @param {string} message - 人間が読めるエラーメッセージ
 * @returns {GoogleAppsScript.Content.TextOutput} JSON形式のHTTPレスポンス
 */
function errorResponse(code, message) {
  const body = buildErrorBody(code, message);
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 成功レスポンスのボディオブジェクトを構築する（テスト用にエクスポート可能）
 * @param {Object} [data] - レスポンスデータ
 * @returns {Object} レスポンスボディ
 */
function buildSuccessBody(data) {
  const body = { success: true };
  if (data !== undefined && data !== null) {
    body.data = data;
  }
  return body;
}

/**
 * エラーレスポンスのボディオブジェクトを構築する（テスト用にエクスポート可能）
 * @param {string} code - エラーコード
 * @param {string} message - エラーメッセージ
 * @returns {Object} レスポンスボディ
 */
function buildErrorBody(code, message) {
  return {
    success: false,
    error: {
      code: String(code),
      message: String(message)
    }
  };
}
