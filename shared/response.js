/**
 * shared/response.js - レスポンスビルダーのピュアロジック
 * GAS版(response.gs)と同一ロジック。テスト対象としてNode.js側からimport可能。
 */

/**
 * 成功レスポンスのボディオブジェクトを構築する
 * @param {Object} [data] - レスポンスデータ
 * @returns {Object} レスポンスボディ
 */
export function buildSuccessBody(data) {
  const body = { success: true };
  if (data !== undefined && data !== null) {
    body.data = data;
  }
  return body;
}

/**
 * エラーレスポンスのボディオブジェクトを構築する
 * @param {string} code - エラーコード
 * @param {string} message - エラーメッセージ
 * @returns {Object} レスポンスボディ
 */
export function buildErrorBody(code, message) {
  return {
    success: false,
    error: {
      code: String(code),
      message: String(message)
    }
  };
}
