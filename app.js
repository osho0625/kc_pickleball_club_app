/**
 * app.js - 練習日管理アプリ メインアプリケーションロジック
 * 状態管理、画面遷移、イベントハンドリング、DOM生成・更新
 */

import {
  fetchAPI,
  sortSessions,
  isPastSession,
  formatAttendance,
  countParticipants,
  validateSessionForm,
  validateNote,
  cacheData,
  getCachedData,
  getCurrentUser,
  setCurrentUser,
} from './common.js';

// =============================================================================
// AppState - Single Source of Truth
// =============================================================================

const AppState = {
  currentUser: null,
  sessions: [],
  members: [],
  offline: false,
  loading: false,
  screen: 'main', // 'member-select' | 'main' | 'form' | 'settings'
};

// =============================================================================
// ヘルパー
// =============================================================================

/**
 * 今日の日付文字列をJSTで取得
 * @returns {string} YYYY-MM-DD
 */
function getTodayStr() {
  const now = new Date();
  const jstOffset = 9 * 60;
  const jst = new Date(now.getTime() + jstOffset * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/**
 * ローディング状態の更新
 * @param {boolean} isLoading
 */
function setLoading(isLoading) {
  AppState.loading = isLoading;
  const spinner = document.getElementById('loading-spinner');
  if (spinner) {
    spinner.style.display = isLoading ? 'flex' : 'none';
  }
  // ボタン無効化（二重送信防止）
  const buttons = document.querySelectorAll('button[data-action]');
  buttons.forEach((btn) => {
    btn.disabled = isLoading;
  });
}

/**
 * エラーバナー表示
 * @param {string} message - エラーメッセージ
 * @param {boolean} [autoRefresh=false] - 自動リフレッシュ提案
 */
function showError(message, autoRefresh = false) {
  const banner = document.getElementById('error-banner');
  if (!banner) return;
  banner.style.display = 'block';
  banner.innerHTML = `
    <div class="error-content">
      <span class="error-message">${escapeHtml(message)}</span>
      <button class="error-retry-btn" onclick="window.__app.retryAction()">再試行</button>
    </div>
  `;
  if (autoRefresh) {
    setTimeout(() => {
      hideError();
      fetchAndRender();
    }, 3000);
  }
}

/**
 * エラーバナー非表示
 */
function hideError() {
  const banner = document.getElementById('error-banner');
  if (banner) {
    banner.style.display = 'none';
    banner.innerHTML = '';
  }
}

/**
 * オフラインバナー表示
 * @param {string} lastFetched - 最終取得日時
 */
function showOfflineBanner(lastFetched) {
  const banner = document.getElementById('error-banner');
  if (!banner) return;
  banner.style.display = 'block';
  banner.innerHTML = `
    <div class="offline-content">
      <span class="offline-badge">読み取り専用</span>
      <span>オフラインデータ（${escapeHtml(lastFetched)}時点）</span>
      <button class="error-retry-btn" onclick="window.__app.retryAction()">再接続</button>
    </div>
  `;
}

/**
 * HTMLエスケープ
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// =============================================================================
// 6.1 画面遷移制御
// =============================================================================

/**
 * アプリ初期化
 * Current_User確認 → データ取得 → 画面表示
 */
export async function init() {
  // グローバルイベントハンドラ登録
  setupGlobalHandlers();

  const user = getCurrentUser();
  if (user) {
    AppState.currentUser = user;
    await fetchAndRender();
    showScreen('main');
    renderSessionList();
  } else {
    // メンバーリストを取得してから選択画面を表示
    try {
      setLoading(true);
      const res = await fetchAPI({ action: 'getSessions' });
      if (res.success && res.data) {
        AppState.members = res.data.members || [];
        AppState.sessions = sortSessions(res.data.sessions || []);
        cacheData(AppState.sessions, AppState.members);
      }
    } catch (e) {
      handleOffline();
    } finally {
      setLoading(false);
    }
    showScreen('member-select');
    renderMemberSelection();
  }
}

/**
 * 画面切替: 全画面を非表示にし、指定画面を表示
 * @param {string} name - 'member-select' | 'main' | 'form' | 'settings'
 */
export function showScreen(name) {
  const screens = [
    'screen-member-select',
    'screen-main',
    'screen-form',
    'screen-settings',
  ];
  screens.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const target = document.getElementById(`screen-${name}`);
  if (target) target.style.display = 'block';

  AppState.screen = name;
  hideError();
}

/**
 * API取得 → AppState更新 → キャッシュ保存 → 描画
 */
export async function fetchAndRender() {
  try {
    setLoading(true);
    const res = await fetchAPI({ action: 'getSessions' });
    if (res.success && res.data) {
      AppState.sessions = sortSessions(res.data.sessions || []);
      AppState.members = res.data.members || [];
      AppState.offline = false;
      cacheData(AppState.sessions, AppState.members);
    } else if (res.error) {
      showError(res.error.message || 'データの取得に失敗しました');
    }
  } catch (e) {
    handleOffline();
  } finally {
    setLoading(false);
  }
}

/**
 * オフラインモード切替
 * キャッシュ → AppState → 読み取り専用描画
 */
export function handleOffline() {
  AppState.offline = true;
  const cached = getCachedData();
  if (cached) {
    AppState.sessions = sortSessions(cached.sessions);
    AppState.members = cached.members;
    showOfflineBanner(cached.lastFetched);
  } else {
    showError('データがありません。ネットワーク接続を確認してください。');
  }
}

/**
 * 現在の画面に応じた再描画
 */
function renderCurrentScreen() {
  switch (AppState.screen) {
    case 'member-select':
      renderMemberSelection();
      break;
    case 'main':
      renderSessionList();
      break;
    case 'settings':
      renderSettings();
      break;
    default:
      renderSessionList();
  }
}


// =============================================================================
// 6.2 メンバー選択画面
// =============================================================================

/**
 * メンバーリストをボタン表示
 */
export function renderMemberSelection() {
  const container = document.getElementById('screen-member-select');
  if (!container) return;

  const members = AppState.members;
  let html = '<h2 class="screen-title">あなたの名前を選択してください</h2>';
  html += '<div class="member-list" role="list" aria-label="メンバー選択">';

  if (members.length === 0) {
    html += '<p class="empty-message">メンバーが見つかりません。</p>';
  } else {
    members.forEach((name) => {
      html += `<button class="member-btn" role="listitem" aria-label="${escapeHtml(name)}を選択" data-member="${escapeHtml(name)}">${escapeHtml(name)}</button>`;
    });
  }

  html += '</div>';
  container.innerHTML = html;
}

/**
 * メンバー選択ハンドラ
 * @param {string} name - 選択されたメンバー名
 */
export async function handleMemberSelect(name) {
  setCurrentUser(name);
  AppState.currentUser = name;
  showScreen('main');
  await fetchAndRender();
  renderSessionList();
}

// =============================================================================
// 6.3 Session_List（メイン画面）
// =============================================================================

/**
 * セッション一覧を描画
 */
export function renderSessionList() {
  const container = document.getElementById('screen-main');
  if (!container) return;

  const today = getTodayStr();
  const sessions = AppState.sessions;
  const currentUser = AppState.currentUser;

  let html = '<div class="session-list-header">';
  html += `<h2 class="screen-title">練習日一覧</h2>`;
  html += '<div class="header-actions">';
  if (!AppState.offline) {
    html += '<button class="btn-add" data-action="add-session" aria-label="練習日追加">＋ 練習日追加</button>';
  }
  html += '<button class="btn-settings" data-action="open-settings" aria-label="設定">⚙️</button>';
  html += '</div></div>';

  if (sessions.length === 0) {
    html += '<p class="empty-message">練習日が登録されていません。</p>';
  } else {
    html += '<div class="session-cards">';
    sessions.forEach((session, index) => {
      html += buildSessionCard(session, currentUser, today);
    });
    html += '</div>';
  }

  container.innerHTML = html;
}

/**
 * 1つのセッションカードHTML生成
 * @param {Object} session - Practice_Session
 * @param {string} currentUser - 現在のユーザー名
 * @param {string} today - 今日の日付 (YYYY-MM-DD)
 * @returns {string} HTML文字列
 */
export function buildSessionCard(session, currentUser, today) {
  const past = isPastSession(session.date, today);
  const pastClass = past ? ' past' : '';
  const participantCount = countParticipants(session.attendance);

  let html = `<div class="session-card${pastClass}" data-row-index="${session.rowIndex}">`;

  // ヘッダー部分
  html += '<div class="session-card-header">';
  html += `<div class="session-date">${escapeHtml(session.date)} (${escapeHtml(session.dayOfWeek)})</div>`;
  html += '<div class="session-actions">';
  if (!AppState.offline) {
    html += `<button class="btn-icon btn-edit" data-action="edit-session" data-row-index="${session.rowIndex}" aria-label="編集">✏️</button>`;
    html += `<button class="btn-icon btn-delete" data-action="delete-session" data-row-index="${session.rowIndex}" aria-label="削除">🗑️</button>`;
  }
  html += '</div></div>';

  // 情報部分
  html += '<div class="session-info">';
  html += `<div class="session-venue">📍 ${escapeHtml(session.venue)}</div>`;
  html += `<div class="session-time">🕐 ${escapeHtml(session.startTime)}〜${escapeHtml(session.endTime)}</div>`;
  html += `<div class="session-participants">👥 ${participantCount}人参加予定</div>`;
  if (session.reservationId) {
    html += `<div class="session-reservation">🎫 ${escapeHtml(session.reservationId)}</div>`;
  }
  if (session.notes) {
    html += `<div class="session-notes">📝 ${escapeHtml(session.notes)}</div>`;
  }
  html += '</div>';

  // 出欠部分
  html += '<div class="session-attendance">';
  html += buildAttendanceRow(session.attendance, currentUser, session.rowIndex, past);
  html += '</div>';

  html += '</div>';
  return html;
}

/**
 * 出欠行HTML生成
 * @param {Array} attendance - Attendance配列
 * @param {string} currentUser - 現在のユーザー名
 * @param {number} rowIndex - 行インデックス
 * @param {boolean} past - 過去セッションか
 * @returns {string} HTML文字列
 */
export function buildAttendanceRow(attendance, currentUser, rowIndex, past) {
  if (!Array.isArray(attendance) || attendance.length === 0) {
    return '<div class="no-attendance">出欠データなし</div>';
  }

  let html = '<div class="attendance-grid">';
  attendance.forEach((att) => {
    const isCurrentUser = att.memberName === currentUser;
    const highlightClass = isCurrentUser ? ' current-user' : '';
    const clickable = isCurrentUser && !AppState.offline && !past;
    const formatted = formatAttendance(att.status, att.note);
    const statusClass = att.status === '○' ? 'status-yes' : att.status === '×' ? 'status-no' : att.status === '△' ? 'status-maybe' : 'status-empty';

    html += `<div class="attendance-cell${highlightClass} ${statusClass}"`;
    if (clickable) {
      html += ` data-action="change-attendance" data-row-index="${rowIndex}" data-member="${escapeHtml(att.memberName)}" role="button" tabindex="0" aria-label="${escapeHtml(att.memberName)}の出欠を変更"`;
    }
    html += '>';
    html += `<div class="attendance-name">${escapeHtml(att.memberName)}</div>`;
    html += `<div class="attendance-status">${escapeHtml(formatted)}</div>`;
    html += '</div>';
  });
  html += '</div>';
  return html;
}


// =============================================================================
// 6.5 出欠登録機能
// =============================================================================

/**
 * 出欠選択UIを表示（モーダル）
 * @param {number} rowIndex - 行インデックス
 * @param {string} memberName - メンバー名
 */
export function showAttendanceSelector(rowIndex, memberName) {
  const session = AppState.sessions.find((s) => s.rowIndex === rowIndex);
  if (!session) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'attendance-modal';

  let html = '<div class="modal-content">';
  html += `<h3>出欠登録: ${escapeHtml(memberName)}</h3>`;
  html += `<p>${escapeHtml(session.date)} ${escapeHtml(session.venue)}</p>`;
  html += '<div class="attendance-options">';
  html += `<button class="att-option att-yes" data-status="○">○ 参加</button>`;
  html += `<button class="att-option att-no" data-status="×">× 不参加</button>`;
  html += `<button class="att-option att-maybe" data-status="△">△ 条件付き</button>`;
  html += '</div>';
  html += '<div class="note-input-area" id="note-input-area" style="display:none;">';
  html += '<label for="attendance-note">補足メモ（最大20文字）:</label>';
  html += '<input type="text" id="attendance-note" maxlength="20" placeholder="例: 遅れて参加" />';
  html += '<p class="note-counter"><span id="note-char-count">0</span>/20</p>';
  html += '</div>';
  html += '<div class="modal-actions">';
  html += '<button class="btn-cancel" id="att-cancel">キャンセル</button>';
  html += '<button class="btn-confirm" id="att-confirm" disabled>確定</button>';
  html += '</div>';
  html += '</div>';

  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  // 状態管理
  let selectedStatus = null;

  // オプションボタンのイベント
  overlay.querySelectorAll('.att-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.att-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedStatus = btn.dataset.status;

      const noteArea = overlay.querySelector('#note-input-area');
      if (selectedStatus === '△') {
        noteArea.style.display = 'block';
      } else {
        noteArea.style.display = 'none';
      }

      overlay.querySelector('#att-confirm').disabled = false;
    });
  });

  // ノート文字数カウンター
  const noteInput = overlay.querySelector('#attendance-note');
  if (noteInput) {
    noteInput.addEventListener('input', () => {
      const count = overlay.querySelector('#note-char-count');
      if (count) count.textContent = noteInput.value.length;
    });
  }

  // キャンセル
  overlay.querySelector('#att-cancel').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  // 確定
  overlay.querySelector('#att-confirm').addEventListener('click', async () => {
    if (!selectedStatus) return;

    let note = '';
    if (selectedStatus === '△') {
      note = (overlay.querySelector('#attendance-note')?.value || '').trim();
      if (!validateNote(note)) {
        const noteArea = overlay.querySelector('#note-input-area');
        if (noteArea) {
          noteArea.insertAdjacentHTML('beforeend', '<p class="error-text">メモは20文字以内で入力してください</p>');
        }
        return;
      }
    }

    document.body.removeChild(overlay);
    await handleAttendanceChange(rowIndex, memberName, selectedStatus, note);
  });

  // オーバーレイクリックで閉じる
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
}

/**
 * 出欠変更ハンドラ
 * @param {number} rowIndex - 行インデックス
 * @param {string} memberName - メンバー名
 * @param {string} status - ○/×/△
 * @param {string} note - 補足メモ
 */
export async function handleAttendanceChange(rowIndex, memberName, status, note) {
  try {
    setLoading(true);
    const res = await fetchAPI({
      action: 'updateAttendance',
      method: 'POST',
      body: { rowIndex, memberName, status, note },
    });

    if (res.success) {
      // AppState内の該当セッションの出欠を更新
      const session = AppState.sessions.find((s) => s.rowIndex === rowIndex);
      if (session && session.attendance) {
        const att = session.attendance.find((a) => a.memberName === memberName);
        if (att) {
          att.status = status;
          att.note = note;
        }
      }
      renderSessionList();
    } else {
      const errorMsg = res.error?.message || '出欠の更新に失敗しました';
      if (res.error?.code === 'ROW_MISMATCH') {
        showError('データが更新されています。再読み込みします。', true);
      } else {
        showError(errorMsg);
      }
    }
  } catch (e) {
    showError('通信エラーが発生しました。');
  } finally {
    setLoading(false);
  }
}


// =============================================================================
// 6.6 Session_Form（追加/編集）
// =============================================================================

/**
 * セッションフォームを表示
 * @param {'add'|'edit'} mode - 追加 or 編集
 * @param {Object|null} session - 編集時は既存セッションデータ
 */
export function renderSessionForm(mode, session = null) {
  const container = document.getElementById('screen-form');
  if (!container) return;

  const title = mode === 'add' ? '練習日追加' : '練習日編集';
  const date = session?.date || '';
  const venue = session?.venue || '';
  const startTime = session?.startTime || '';
  const endTime = session?.endTime || '';
  const reservationId = session?.reservationId || '';
  const notes = session?.notes || '';
  const rowIndex = session?.rowIndex || '';

  let html = `<h2 class="screen-title">${title}</h2>`;
  html += '<form id="session-form" class="session-form" novalidate>';
  html += '<div class="form-group">';
  html += '<label for="form-date">日付 <span class="required">*</span></label>';
  html += `<input type="date" id="form-date" name="date" value="${escapeHtml(date)}" required />`;
  html += '</div>';

  html += '<div class="form-group">';
  html += '<label for="form-venue">会場 <span class="required">*</span></label>';
  html += `<input type="text" id="form-venue" name="venue" value="${escapeHtml(venue)}" maxlength="100" required placeholder="例: 緑スポーツセンター" />`;
  html += '</div>';

  html += '<div class="form-group form-row">';
  html += '<div class="form-col">';
  html += '<label for="form-start-time">開始時刻 <span class="required">*</span></label>';
  html += `<input type="time" id="form-start-time" name="startTime" value="${escapeHtml(startTime)}" required />`;
  html += '</div>';
  html += '<div class="form-col">';
  html += '<label for="form-end-time">終了時刻 <span class="required">*</span></label>';
  html += `<input type="time" id="form-end-time" name="endTime" value="${escapeHtml(endTime)}" required />`;
  html += '</div>';
  html += '</div>';

  html += '<div class="form-group">';
  html += '<label for="form-reservation-id">予約ID</label>';
  html += `<input type="text" id="form-reservation-id" name="reservationId" value="${escapeHtml(reservationId)}" maxlength="50" placeholder="例: R-001" />`;
  html += '</div>';

  html += '<div class="form-group">';
  html += '<label for="form-notes">備考</label>';
  html += `<textarea id="form-notes" name="notes" maxlength="200" rows="3" placeholder="備考があれば入力">${escapeHtml(notes)}</textarea>`;
  html += '</div>';

  html += '<div class="form-error" id="form-error" style="display:none;"></div>';

  html += '<div class="form-actions">';
  html += `<button type="button" class="btn-cancel" data-action="cancel-form">キャンセル</button>`;
  html += `<button type="submit" class="btn-confirm" data-action="submit-form">${mode === 'add' ? '追加' : '更新'}</button>`;
  html += '</div>';

  // hidden fields
  html += `<input type="hidden" name="mode" value="${mode}" />`;
  html += `<input type="hidden" name="rowIndex" value="${rowIndex}" />`;
  if (mode === 'edit' && session) {
    html += `<input type="hidden" name="expectedDate" value="${escapeHtml(session.date)}" />`;
    html += `<input type="hidden" name="expectedVenue" value="${escapeHtml(session.venue)}" />`;
    html += `<input type="hidden" name="expectedStartTime" value="${escapeHtml(session.startTime)}" />`;
  }

  html += '</form>';
  container.innerHTML = html;

  showScreen('form');

  // フォーム送信イベント
  const form = document.getElementById('session-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = {
        date: form.elements.date.value,
        venue: form.elements.venue.value,
        startTime: form.elements.startTime.value,
        endTime: form.elements.endTime.value,
        reservationId: form.elements.reservationId.value,
        notes: form.elements.notes.value,
      };
      const formMode = form.elements.mode.value;
      const formRowIndex = form.elements.rowIndex.value ? Number(form.elements.rowIndex.value) : null;

      const extras = {};
      if (formMode === 'edit') {
        extras.expectedDate = form.elements.expectedDate?.value || '';
        extras.expectedVenue = form.elements.expectedVenue?.value || '';
        extras.expectedStartTime = form.elements.expectedStartTime?.value || '';
      }

      handleSessionSubmit(formData, formMode, formRowIndex, extras);
    });
  }
}

/**
 * セッションフォーム送信ハンドラ
 * @param {Object} formData - フォームデータ
 * @param {'add'|'edit'} mode - モード
 * @param {number|null} rowIndex - 編集時の行インデックス
 * @param {Object} extras - 編集時のexpected値
 */
export async function handleSessionSubmit(formData, mode, rowIndex, extras = {}) {
  // バリデーション
  const validationError = validateSessionForm(formData);
  if (validationError) {
    showFormError(validationError.message);
    return;
  }

  try {
    setLoading(true);
    let res;

    if (mode === 'add') {
      res = await fetchAPI({
        action: 'addSession',
        method: 'POST',
        body: formData,
      });
    } else {
      res = await fetchAPI({
        action: 'updateSession',
        method: 'POST',
        body: {
          rowIndex,
          ...formData,
          expectedDate: extras.expectedDate,
          expectedVenue: extras.expectedVenue,
          expectedStartTime: extras.expectedStartTime,
        },
      });
    }

    if (res.success) {
      await fetchAndRender();
      showScreen('main');
      renderSessionList();
    } else {
      const errorMsg = res.error?.message || '保存に失敗しました';
      if (res.error?.code === 'ROW_MISMATCH') {
        showFormError('データが更新されています。一覧に戻り再度お試しください。');
      } else {
        showFormError(errorMsg);
      }
    }
  } catch (e) {
    showFormError('通信エラーが発生しました。');
  } finally {
    setLoading(false);
  }
}

/**
 * フォームエラー表示
 * @param {string} message
 */
function showFormError(message) {
  const errorEl = document.getElementById('form-error');
  if (errorEl) {
    errorEl.style.display = 'block';
    errorEl.textContent = message;
  }
}


// =============================================================================
// 6.7 削除機能
// =============================================================================

/**
 * 削除確認ダイアログ表示
 * @param {Object} session - 削除対象セッション
 */
export function showDeleteConfirm(session) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'delete-modal';

  let html = '<div class="modal-content">';
  html += '<h3>練習日を削除しますか？</h3>';
  html += '<div class="delete-details">';
  html += `<p><strong>日付:</strong> ${escapeHtml(session.date)} (${escapeHtml(session.dayOfWeek)})</p>`;
  html += `<p><strong>会場:</strong> ${escapeHtml(session.venue)}</p>`;
  html += `<p><strong>時間:</strong> ${escapeHtml(session.startTime)}〜${escapeHtml(session.endTime)}</p>`;
  html += '</div>';
  html += '<p class="delete-warning">この操作は取り消せません。</p>';
  html += '<div class="modal-actions">';
  html += '<button class="btn-cancel" id="delete-cancel">キャンセル</button>';
  html += '<button class="btn-danger" id="delete-confirm">削除する</button>';
  html += '</div>';
  html += '</div>';

  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  // キャンセル
  overlay.querySelector('#delete-cancel').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  // 確定
  overlay.querySelector('#delete-confirm').addEventListener('click', async () => {
    document.body.removeChild(overlay);
    await handleDelete(session.rowIndex, session.date, session.venue, session.startTime);
  });

  // オーバーレイクリックで閉じる
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
}

/**
 * 削除ハンドラ
 * @param {number} rowIndex
 * @param {string} expectedDate
 * @param {string} expectedVenue
 * @param {string} expectedStartTime
 */
export async function handleDelete(rowIndex, expectedDate, expectedVenue, expectedStartTime) {
  try {
    setLoading(true);
    const res = await fetchAPI({
      action: 'deleteSession',
      method: 'POST',
      body: { rowIndex, expectedDate, expectedVenue, expectedStartTime },
    });

    if (res.success) {
      await fetchAndRender();
      renderSessionList();
    } else {
      if (res.error?.code === 'ROW_MISMATCH') {
        showError('データが更新されています。再読み込みします。', true);
      } else {
        showError(res.error?.message || '削除に失敗しました');
      }
    }
  } catch (e) {
    showError('通信エラーが発生しました。');
  } finally {
    setLoading(false);
  }
}


// =============================================================================
// 6.8 設定画面（ユーザー変更・バックアップ/復元）
// =============================================================================

/**
 * 設定画面を描画
 */
export function renderSettings() {
  const container = document.getElementById('screen-settings');
  if (!container) return;

  let html = '<h2 class="screen-title">設定</h2>';
  html += '<div class="settings-content">';

  // 現在のユーザー
  html += '<div class="settings-section">';
  html += '<h3>現在のユーザー</h3>';
  html += `<p class="current-user-display">${escapeHtml(AppState.currentUser || '未設定')}</p>`;
  html += '<button class="btn-secondary" data-action="change-user">ユーザー変更</button>';
  html += '</div>';

  // バックアップ
  html += '<div class="settings-section">';
  html += '<h3>データ管理</h3>';
  if (!AppState.offline) {
    html += '<button class="btn-secondary" data-action="backup">バックアップ実行</button>';
    html += '<button class="btn-secondary" data-action="restore">バックアップから復元</button>';
  } else {
    html += '<p class="muted-text">オフライン時はバックアップ/復元を利用できません。</p>';
  }
  html += '</div>';

  // 戻るボタン
  html += '<div class="settings-section">';
  html += '<button class="btn-primary" data-action="back-to-main">← 戻る</button>';
  html += '</div>';

  // 復元リスト表示エリア
  html += '<div id="restore-list-area" style="display:none;"></div>';

  html += '</div>';
  container.innerHTML = html;
}

/**
 * ユーザー変更ハンドラ
 */
export function handleUserChange() {
  showScreen('member-select');
  renderMemberSelection();
}

/**
 * バックアップ実行ハンドラ
 */
export async function handleBackup() {
  try {
    setLoading(true);
    const res = await fetchAPI({
      action: 'backup',
      method: 'POST',
      body: {},
    });

    if (res.success) {
      showBackupMessage('バックアップが完了しました。', 'success');
    } else {
      showBackupMessage(res.error?.message || 'バックアップに失敗しました。', 'error');
    }
  } catch (e) {
    showBackupMessage('通信エラーが発生しました。', 'error');
  } finally {
    setLoading(false);
  }
}

/**
 * バックアップ/復元メッセージ表示
 * @param {string} message
 * @param {'success'|'error'} type
 */
function showBackupMessage(message, type) {
  const area = document.getElementById('restore-list-area');
  if (!area) return;
  area.style.display = 'block';
  area.innerHTML = `<div class="backup-message ${type}">${escapeHtml(message)}</div>`;
}

/**
 * 復元ハンドラ（バックアップ一覧取得 → 選択 → 確認 → 復元）
 */
export async function handleRestore() {
  try {
    setLoading(true);
    const res = await fetchAPI({ action: 'listBackups' });

    if (res.success && res.data?.backups) {
      renderBackupList(res.data.backups);
    } else {
      showBackupMessage(res.error?.message || 'バックアップ一覧の取得に失敗しました。', 'error');
    }
  } catch (e) {
    showBackupMessage('通信エラーが発生しました。', 'error');
  } finally {
    setLoading(false);
  }
}

/**
 * バックアップ一覧を描画
 * @param {Array} backups - バックアップファイル一覧
 */
function renderBackupList(backups) {
  const area = document.getElementById('restore-list-area');
  if (!area) return;
  area.style.display = 'block';

  if (!backups || backups.length === 0) {
    area.innerHTML = '<p class="muted-text">バックアップが見つかりません。</p>';
    return;
  }

  let html = '<h3>バックアップ一覧</h3>';
  html += '<div class="backup-list">';
  backups.forEach((backup) => {
    const fileName = backup.name || backup.fileName || '';
    // ファイル名から日時を抽出して表示
    const dateMatch = fileName.match(/pickleball_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    let displayDate = fileName;
    if (dateMatch) {
      displayDate = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]} ${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]}`;
    }
    html += `<button class="backup-item" data-action="select-backup" data-filename="${escapeHtml(fileName)}">${escapeHtml(displayDate)}</button>`;
  });
  html += '</div>';
  html += '<button class="btn-cancel" data-action="cancel-restore">キャンセル</button>';

  area.innerHTML = html;
}

/**
 * 復元確認ダイアログ表示
 * @param {string} fileName - 復元対象のファイル名
 */
function showRestoreConfirm(fileName) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'restore-modal';

  let html = '<div class="modal-content">';
  html += '<h3>バックアップから復元しますか？</h3>';
  html += `<p>ファイル: ${escapeHtml(fileName)}</p>`;
  html += '<p class="delete-warning">現在のデータは自動的にバックアップされます。</p>';
  html += '<div class="modal-actions">';
  html += '<button class="btn-cancel" id="restore-cancel">キャンセル</button>';
  html += '<button class="btn-confirm" id="restore-confirm">復元する</button>';
  html += '</div>';
  html += '</div>';

  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  overlay.querySelector('#restore-cancel').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  overlay.querySelector('#restore-confirm').addEventListener('click', async () => {
    document.body.removeChild(overlay);
    await executeRestore(fileName);
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
}

/**
 * 復元実行
 * @param {string} fileName - 復元対象ファイル名
 */
async function executeRestore(fileName) {
  try {
    setLoading(true);
    const res = await fetchAPI({
      action: 'restore',
      method: 'POST',
      body: { fileName },
    });

    if (res.success) {
      showBackupMessage('復元が完了しました。データを再読み込みします。', 'success');
      await fetchAndRender();
      setTimeout(() => {
        showScreen('main');
        renderSessionList();
      }, 1500);
    } else {
      showBackupMessage(res.error?.message || '復元に失敗しました。', 'error');
    }
  } catch (e) {
    showBackupMessage('通信エラーが発生しました。', 'error');
  } finally {
    setLoading(false);
  }
}


// =============================================================================
// グローバルイベントハンドラ（イベント委譲）
// =============================================================================

/**
 * グローバルイベントハンドラ登録
 * イベント委譲パターンで各コンテナのクリックを一元管理
 */
function setupGlobalHandlers() {
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const rowIndex = target.dataset.rowIndex ? Number(target.dataset.rowIndex) : null;
    const member = target.dataset.member || null;
    const filename = target.dataset.filename || null;

    switch (action) {
      case 'add-session':
        renderSessionForm('add');
        break;

      case 'edit-session': {
        const session = AppState.sessions.find((s) => s.rowIndex === rowIndex);
        if (session) renderSessionForm('edit', session);
        break;
      }

      case 'delete-session': {
        const session = AppState.sessions.find((s) => s.rowIndex === rowIndex);
        if (session) showDeleteConfirm(session);
        break;
      }

      case 'change-attendance':
        if (rowIndex !== null && member) {
          showAttendanceSelector(rowIndex, member);
        }
        break;

      case 'open-settings':
        showScreen('settings');
        renderSettings();
        break;

      case 'change-user':
        handleUserChange();
        break;

      case 'backup':
        handleBackup();
        break;

      case 'restore':
        handleRestore();
        break;

      case 'select-backup':
        if (filename) showRestoreConfirm(filename);
        break;

      case 'cancel-restore': {
        const area = document.getElementById('restore-list-area');
        if (area) {
          area.style.display = 'none';
          area.innerHTML = '';
        }
        break;
      }

      case 'cancel-form':
        showScreen('main');
        renderSessionList();
        break;

      case 'back-to-main':
        showScreen('main');
        renderSessionList();
        break;

      default:
        break;
    }
  });

  // メンバー選択画面のイベント委譲
  const memberSelectContainer = document.getElementById('screen-member-select');
  if (memberSelectContainer) {
    memberSelectContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-member]');
      if (btn) {
        handleMemberSelect(btn.dataset.member);
      }
    });
  }

  // キーボードアクセシビリティ: Enter/Spaceでクリックをトリガー
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target.closest('[data-action="change-attendance"]');
      if (target) {
        e.preventDefault();
        target.click();
      }
    }
  });
}

// =============================================================================
// 再試行アクション（エラーバナーから呼ばれる）
// =============================================================================

/**
 * 再試行（エラーバナーのリトライボタン用）
 */
async function retryAction() {
  hideError();
  await fetchAndRender();
  renderCurrentScreen();
}

// =============================================================================
// グローバル公開（HTMLからアクセス可能にする）
// =============================================================================

window.__app = {
  retryAction,
};

// =============================================================================
// DOMContentLoaded で init() 起動
// =============================================================================

document.addEventListener('DOMContentLoaded', init);
