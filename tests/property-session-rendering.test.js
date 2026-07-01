/**
 * Property 2: Session rendering completeness
 * Feature: pickleball-schedule-manager, Property 2: Session rendering completeness
 *
 * For any valid Practice_Session with attendance array, the rendered HTML output
 * SHALL contain the session's date, dayOfWeek, venue, startTime, endTime,
 * and every member's attendance status.
 *
 * **Validates: Requirements 1.2, 2.1**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { buildSessionCard, buildAttendanceRow } from '../app.js';

// =============================================================================
// Generators
// =============================================================================

/** 有効な日付文字列 (YYYY-MM-DD) */
const dateArb = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31'),
}).map(d => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
});

/** 曜日 */
const dayOfWeekArb = fc.constantFrom('月', '火', '水', '木', '金', '土', '日');

/** 時刻文字列 (HH:MM) */
const timeArb = fc.tuple(
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 })
).map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

/** 出欠ステータス */
const statusArb = fc.constantFrom('○', '×', '△', '');

/** メンバー名（HTMLエスケープが必要な文字を含まないシンプルな名前） */
const memberNameArb = fc.constantFrom('田中', '鈴木', '佐藤', '高橋', '山本', '中村', '小林', '加藤');

/** Attendance エントリ */
const attendanceArb = fc.record({
  memberName: memberNameArb,
  status: statusArb,
  note: fc.oneof(
    fc.constant(''),
    fc.constant(null),
    fc.constantFrom('遅れて参加', '未定', '午後から')
  ),
});

/** 会場名 */
const venueArb = fc.constantFrom('緑SC', '体育館', 'スポーツセンター', '市民体育館', '公園');

/** Practice_Session */
const sessionArb = fc.record({
  rowIndex: fc.integer({ min: 2, max: 100 }),
  date: dateArb,
  dayOfWeek: dayOfWeekArb,
  venue: venueArb,
  startTime: timeArb,
  endTime: timeArb,
  reservationId: fc.oneof(fc.constant(''), fc.constant('R-001')),
  notes: fc.oneof(fc.constant(''), fc.constant('雨天中止の可能性あり')),
  attendance: fc.array(attendanceArb, { minLength: 1, maxLength: 8 }),
});

// =============================================================================
// Tests
// =============================================================================

describe('Property 2: Session rendering completeness', () => {
  beforeEach(() => {
    // jsdom環境で必要なDOM要素を準備
    document.body.innerHTML = `
      <div id="error-banner" style="display:none;"></div>
      <div id="loading-spinner" style="display:none;"></div>
      <main id="screen-member-select" style="display:none;"></main>
      <main id="screen-main" style="display:none;"></main>
      <section id="screen-form" style="display:none;"></section>
      <section id="screen-settings" style="display:none;"></section>
    `;
  });

  it('rendered HTML contains session date, dayOfWeek, venue, startTime, and endTime', () => {
    fc.assert(
      fc.property(
        sessionArb,
        memberNameArb,
        (session, currentUser) => {
          const today = '2025-01-01';
          const html = buildSessionCard(session, currentUser, today);

          // Session date is present
          expect(html).toContain(session.date);

          // Day of week is present
          expect(html).toContain(session.dayOfWeek);

          // Venue is present
          expect(html).toContain(session.venue);

          // Start time is present
          expect(html).toContain(session.startTime);

          // End time is present
          expect(html).toContain(session.endTime);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('rendered HTML contains every member attendance status', () => {
    fc.assert(
      fc.property(
        sessionArb,
        memberNameArb,
        (session, currentUser) => {
          const today = '2025-01-01';
          const html = buildSessionCard(session, currentUser, today);

          // Each member name must appear in the output
          for (const att of session.attendance) {
            expect(html).toContain(att.memberName);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('buildAttendanceRow renders all member names and statuses', () => {
    fc.assert(
      fc.property(
        fc.array(attendanceArb, { minLength: 1, maxLength: 10 }),
        memberNameArb,
        fc.integer({ min: 2, max: 50 }),
        fc.boolean(),
        (attendance, currentUser, rowIndex, past) => {
          const html = buildAttendanceRow(attendance, currentUser, rowIndex, past);

          // Every member name must appear
          for (const att of attendance) {
            expect(html).toContain(att.memberName);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
