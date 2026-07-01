/**
 * Property 9: API response format schema
 * Validates: Requirements 8.3
 *
 * For any success/error response built by the response builder,
 * the output JSON SHALL have a boolean `success` field, and when success is false
 * it SHALL have an `error` object with string fields `code` and `message`,
 * and when success is true it MAY have a `data` object.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildSuccessBody, buildErrorBody } from '../shared/response.js';

describe('Property 9: API response format schema', () => {
  /**
   * **Validates: Requirements 8.3**
   */
  it('成功レスポンスは success: true を持ち、dataがあればオブジェクト/配列/プリミティブ', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(undefined),
          fc.constant(null),
          fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.jsonValue()),
          fc.array(fc.jsonValue()),
          fc.string(),
          fc.integer()
        ),
        (data) => {
          const body = buildSuccessBody(data);

          // success フィールドは boolean で true
          expect(typeof body.success).toBe('boolean');
          expect(body.success).toBe(true);

          // error フィールドが存在しない
          expect(body.error).toBeUndefined();

          // data は undefined/null のときは含まれない、それ以外は含まれる
          if (data === undefined || data === null) {
            expect(body.data).toBeUndefined();
          } else {
            expect(body.data).toEqual(data);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('エラーレスポンスは success: false と error: { code, message } を持つ', () => {
    const errorCodes = fc.constantFrom(
      'ROW_MISMATCH', 'WRITE_CONFLICT', 'SPREADSHEET_ERROR',
      'INVALID_PARAMS', 'GITHUB_ERROR', 'UNKNOWN_ERROR'
    );

    fc.assert(
      fc.property(
        errorCodes,
        fc.string({ minLength: 1, maxLength: 200 }),
        (code, message) => {
          const body = buildErrorBody(code, message);

          // success フィールドは boolean で false
          expect(typeof body.success).toBe('boolean');
          expect(body.success).toBe(false);

          // error オブジェクトが存在する
          expect(body.error).toBeDefined();
          expect(typeof body.error).toBe('object');
          expect(body.error).not.toBeNull();

          // error.code と error.message は string
          expect(typeof body.error.code).toBe('string');
          expect(typeof body.error.message).toBe('string');

          // 値が一致する
          expect(body.error.code).toBe(code);
          expect(body.error.message).toBe(message);

          // data フィールドが存在しない
          expect(body.data).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('エラーレスポンスは任意のcode/messageでも必ずstring化される', () => {
    fc.assert(
      fc.property(
        fc.anything(),
        fc.anything(),
        (code, message) => {
          const body = buildErrorBody(code, message);

          expect(body.success).toBe(false);
          expect(typeof body.error.code).toBe('string');
          expect(typeof body.error.message).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });
});
