# 関東地区ピックル会 練習日管理アプリ - 設計ドキュメント

## 1. アプリ概要

関東地区ピックルボールクラブの練習日程と出欠を管理するモバイルファーストWebアプリ。
メンバーが自分のスマホからアクセスし、今後の練習予定確認・出欠登録を行う。

- 対象ユーザー: クラブメンバー（10〜20名程度）
- 利用デバイス: 主にスマートフォン（ダークテーマUI）
- データ管理者: クラブの管理者がスプレッドシート上でも直接編集可能

## 2. アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  フロントエンド（静的ホスティング: GitHub Pages等）          │
│  index.html + style.css + common.js + app.js            │
│  ES Modules / Vanilla JS / ダークテーマ                   │
└─────────────┬───────────────────────────────────────────┘
              │ HTTP (fetch)
              │ GET ?action=xxx / POST {action, ...}
              ▼
┌─────────────────────────────────────────────────────────┐
│  バックエンド: Google Apps Script (Webアプリ)              │
│  main.gs (ルーター) → spreadsheet.gs / github.gs         │
│  validation.gs / response.gs                            │
└─────────────┬──────────────────────┬────────────────────┘
              │                      │
              ▼                      ▼
┌──────────────────────┐   ┌──────────────────────┐
│ Google スプレッドシート │   │ GitHub (バックアップ)   │
│ (データストア)         │   │ Contents API          │
└──────────────────────┘   └──────────────────────┘
```

### 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | Vanilla JS (ES Modules), HTML5, CSS3 |
| バックエンド | Google Apps Script (スタンドアロン) |
| データストア | Google スプレッドシート |
| バックアップ | GitHub Contents API |
| デプロイ (GAS) | clasp CLI |
| テスト | Vitest + fast-check (プロパティベーステスト) + jsdom |

## 3. データモデル

### スプレッドシート構造

```
Row 1-4: ヘッダーエリア（タイトル等、アプリからは読まない）
Row 5:   カラムヘッダー
Row 6+:  データ行
```

**カラムマッピング (Row 5):**

| 列 | 内容 | 型 | 例 |
|---|---|---|---|
| A | 日付 | Date/String | 2025-07-01 |
| B | 曜日 | String | 火 |
| C | 会場 | String | 緑スポーツセンター |
| D | 開始時刻 | Time/String | 19:00 |
| E | 終了時刻 | Time/String | 21:00 |
| F | 予約ID | String | R-001 |
| G | 備考 | String | 雨天中止の場合あり |
| H | 参加人数 | Number | 8 |
| I〜 | メンバー出欠 | String | ○ / × / △（遅れて参加） |

Row 5のI列以降にメンバー名が横並び。各データ行の同列に出欠が入る。

### Practice_Session オブジェクト (API応答)

```javascript
{
  rowIndex: 6,              // スプレッドシート行番号（書き込み・排他制御用）
  date: "2025-07-01",
  dayOfWeek: "火",
  venue: "緑スポーツセンター",
  startTime: "19:00",
  endTime: "21:00",
  reservationId: "R-001",
  notes: "",
  participantCount: 8,
  attendance: [
    { memberName: "田中", status: "○", note: "" },
    { memberName: "鈴木", status: "△", note: "遅れて参加" },
    { memberName: "佐藤", status: "×", note: "" },
    // ...
  ]
}
```

### 出欠ステータス

| 値 | 意味 | セル書式 |
|---|---|---|
| ○ | 参加 | ○ |
| × | 不参加 | × |
| △ | 条件付き参加 | △（メモ） |
| (空) | 未回答 | - |

△の補足メモは最大20文字。

## 4. API設計

### エンドポイント

GAS Webアプリ URL 1本に対して action パラメータでディスパッチ。

#### GET

| action | 説明 | 応答 |
|---|---|---|
| `getSessions` | 全セッション + メンバー一覧 | `{ sessions: [...], members: [...] }` |
| `listBackups` | GitHubバックアップ一覧 | `{ backups: [{ name, path, size, sha }] }` |

#### POST

| action | 説明 | ボディ |
|---|---|---|
| `updateAttendance` | 出欠更新 | `{ rowIndex, memberName, status, note }` |
| `addSession` | 練習日追加 | `{ date, venue, startTime, endTime, dayOfWeek, reservationId, notes }` |
| `updateSession` | 練習日編集 | `{ rowIndex, date, venue, ..., expectedDate, expectedVenue, expectedStartTime }` |
| `deleteSession` | 練習日削除 | `{ rowIndex, expectedDate, expectedVenue, expectedStartTime }` |
| `backup` | GitHubバックアップ実行 | `{}` |
| `restore` | バックアップ復元 | `{ fileName }` |

### 統一レスポンス形式

```javascript
// 成功
{ success: true, data: { ... } }

// エラー
{ success: false, error: { code: "ERROR_CODE", message: "人間が読めるメッセージ" } }
```

**エラーコード一覧:**

| コード | 意味 |
|---|---|
| `INVALID_PARAMS` | パラメータ不正（バリデーション失敗） |
| `ROW_MISMATCH` | 楽観的排他制御失敗（他ユーザーが先に変更） |
| `WRITE_CONFLICT` | LockService取得失敗（同時書き込み） |
| `SPREADSHEET_ERROR` | スプレッドシート操作エラー |
| `GITHUB_ERROR` | GitHub API連携エラー |
| `UNKNOWN_ERROR` | 予期しないエラー |

## 5. 画面構成と遷移

```
[起動]
  │
  ├─ currentUser あり → main (セッション一覧)
  │
  └─ currentUser なし → member-select (メンバー選択)
                              │
                              └─ 選択 → main
```

### 5.1 メンバー選択画面 (`member-select`)
- メンバー名をボタンで一覧表示
- タップで currentUser を LocalStorage に保存し main へ遷移

### 5.2 メイン画面 (`main`) - セッション一覧
- 今日以降のセッションをカード形式で日付昇順表示
- 各カードに: 日付・曜日、会場、時間帯、参加人数（○+△）、参加者名一覧
- 自分の出欠状態と変更ボタン
- ヘッダーに「＋練習日追加」と「⚙️設定」ボタン

### 5.3 セッションフォーム (`form`)
- 追加/編集共通フォーム
- 入力項目: 日付*, 会場*, 開始時刻*, 終了時刻*, 予約ID, 備考
- クライアント側バリデーション + サーバー側バリデーション

### 5.4 設定画面 (`settings`)
- 現在のユーザー表示 + ユーザー変更ボタン
- バックアップ実行ボタン
- バックアップから復元（一覧表示 → 選択 → 確認ダイアログ → 実行）

### 5.5 モーダルダイアログ
- 出欠選択モーダル: ○/×/△選択 → △時はメモ入力欄表示
- 削除確認モーダル: 対象セッション情報表示 + 確認/キャンセル
- 復元確認モーダル: ファイル名表示 + 確認/キャンセル

## 6. 主要機能の設計

### 6.1 出欠登録
1. ユーザーがセッションカードの「自分の出欠」ボタンをタップ
2. モーダルで ○/×/△ を選択（△選択時はメモ入力欄表示）
3. 確定 → POST `updateAttendance` → サーバー側で LockService 取得 → セル書き込み
4. 成功時はローカル AppState も更新して即座に再描画

### 6.2 練習日CRUD
- 追加: フォーム入力 → `addSession` → スプレッドシート末尾に行追加
- 編集: 既存データをフォームに展開 → `updateSession` → 行内容検証後に上書き
- 削除: 確認ダイアログ → `deleteSession` → 行内容検証後に行削除

### 6.3 楽観的排他制御
- 編集・削除時に `expectedDate`, `expectedVenue`, `expectedStartTime` を送信
- サーバー側で該当行の実際の値と比較 → 不一致なら `ROW_MISMATCH` エラー
- さらに `LockService.getScriptLock()` で10秒タイムアウトの排他ロック

### 6.4 オフライン対応
- API通信成功時に sessions + members を LocalStorage にキャッシュ
- 通信失敗時はキャッシュから読み取り専用モードで表示
- オフラインバナーで最終取得日時を表示 + 再接続ボタン

### 6.5 GitHubバックアップ/復元
- バックアップ: 全セッション + 出欠データをJSON化 → GitHub Contents API で PUT
- ファイル名: `backups/pickleball_YYYYMMDD_HHmmss.json` (JST)
- 復元前に自動で `_prerestore` バックアップを作成
- 復元: JSONデータからスプレッドシートのデータ行を再構築

### 6.6 15秒タイムアウト
- フロントエンドの `fetchAPI` は AbortController で15秒後にタイムアウト
- GAS側の Cold Start を考慮した設定

## 7. フロントエンド状態管理

```javascript
const AppState = {
  currentUser: null,    // 選択中のメンバー名
  sessions: [],         // Practice_Session 配列（ソート済み）
  members: [],          // メンバー名配列
  offline: false,       // オフラインモードフラグ
  loading: false,       // ローディング状態
  screen: 'main',      // 現在の画面名
};
```

- Single Source of Truth パターン
- fetchAndRender(): API取得 → AppState更新 → キャッシュ保存 → 再描画
- イベント委譲: `document.addEventListener('click')` で `data-action` 属性をディスパッチ

## 8. ファイル構成と責務

```
├── index.html          # DOM構造（各画面のコンテナのみ）
├── style.css           # ダークテーマCSS、レスポンシブ
├── common.js           # API通信、ソート、フォーマット、バリデーション、キャッシュ
├── app.js              # AppState、画面遷移、DOM生成、イベントハンドリング
├── gas/
│   ├── main.gs         # doGet/doPost ルーター、アクションハンドラー
│   ├── spreadsheet.gs  # スプレッドシート読み書き、データ変換
│   ├── validation.gs   # バリデーション（共通ロジック呼び出し + GASレスポンス化）
│   ├── response.gs     # 統一レスポンスビルダー
│   ├── github.gs       # GitHub API連携（バックアップ/復元/一覧）
│   └── all-in-one.gs   # （clasp push用の結合ファイル）
├── shared/
│   ├── validation.js   # バリデーション ピュアロジック（GAS/Node共通）
│   ├── response.js     # レスポンスビルダー ピュアロジック
│   └── github.js       # バックアップファイル名生成ロジック
└── tests/              # Vitest + fast-check プロパティベーステスト
```

### shared/ ディレクトリの役割
GAS (`gas/*.gs`) とテスト環境 (Node.js) で同一ロジックを共有するため、副作用のないピュア関数を `shared/` に切り出している。GAS側は同一ロジックを `var` 構文で再実装（GASはES Modulesに非対応のため）。

## 9. バリデーションルール

| 項目 | ルール |
|---|---|
| 日付 | 必須、YYYY-MM-DD形式、実在する日付 |
| 会場 | 必須、1〜100文字 |
| 開始時刻 | 必須、HH:MM形式(00-23:00-59) |
| 終了時刻 | 必須、HH:MM形式、開始時刻より後 |
| メンバー名 | 必須（出欠更新時） |
| 出欠ステータス | ○ / × / △ のいずれか |
| 出欠メモ | 任意、最大20文字 |
| 行番号 | 1以上の整数 |

## 10. テスト戦略

Vitest + fast-check によるプロパティベーステスト。13テストファイル:

| テスト | 検証内容 |
|---|---|
| property-attendance-format | △表示フォーマット (△+メモ→△（メモ）) |
| property-backup-filename | バックアップファイル名のJST変換 |
| property-cache-roundtrip | LocalStorageキャッシュの保存/復元 |
| property-note-validation | メモ20文字制限 |
| property-participant-count | 参加者カウント (○+△) |
| property-past-session | 過去日判定 |
| property-response | レスポンスビルダーのスキーマ検証 |
| property-row-mismatch | 行内容一致検証 |
| property-session-rendering | セッションカードDOM生成 |
| property-session-validation | セッションフォームバリデーション |
| property-sort-sessions | セッションソート (date→startTime ASC) |
| setup | テスト環境セットアップ |

## 11. 設定・環境変数

### フロントエンド
- `GAS_API_URL` (common.js): デプロイ済みGAS WebアプリのURL

### GAS Script Properties
- `GITHUB_TOKEN`: GitHub Personal Access Token
- `GITHUB_OWNER`: リポジトリオーナー
- `GITHUB_REPO`: リポジトリ名

### スプレッドシート
- `SPREADSHEET_ID` (spreadsheet.gs): 対象スプレッドシートのID（ハードコード）

## 12. デプロイ

1. `npm install` → 開発依存パッケージ取得
2. `npm test` → テスト実行
3. `npm run push` (`clasp push`) → GAS にコードデプロイ
4. GAS エディタで「ウェブアプリとしてデプロイ」→ URL取得
5. `common.js` の `GAS_API_URL` を更新
6. 静的ファイル (index.html, style.css, common.js, app.js) をホスティングに配置


## 13. Push通知機能

### アーキテクチャ

```
[フロントエンド(PWA)] → [Supabase push_subscriptions] ← 購読登録
[GAS 時限トリガー]    → [Supabase push_messages]      ← 通知キュー登録
[GitHub Actions cron] → [push_messages取得] → [web-push] → [端末のService Worker]
```

### フロー

1. **購読登録** (フロントエンド → Supabase)
   - 設定画面で「通知をONにする」タップ
   - ブラウザの Push API で購読作成（VAPID公開鍵使用）
   - `push_subscriptions` テーブルに device_id + subscription JSON を upsert

2. **通知キューイング** (GAS時限トリガー → Supabase)
   - 毎日8:00と17:30（JST）に `queueTodayPushNotifications()` が実行される
   - 当日の練習日がある場合、`push_messages` テーブルに通知メッセージをINSERT

3. **配信処理** (GitHub Actions cron → web-push)
   - JST 7:55〜8:05, 17:25〜17:35 の間に5分間隔でcron実行
   - `push_messages` の `sent=false` レコードを取得
   - 対象の `push_subscriptions` を取得して web-push で配信
   - 配信後 `sent=true` に更新
   - 410/404応答のサブスクリプションは自動削除

4. **Service Worker受信** (端末側)
   - `push` イベントでペイロードJSONをパースし `showNotification()` で表示
   - `notificationclick` でアプリを開く

### Supabaseテーブル

- `push_subscriptions`: id, device_id(UNIQUE), subscription(JSONB), member_name, created_at, updated_at
- `push_messages`: id, title, body, target_member_name, sent(bool), created_at

### 設定項目

| 場所 | 項目 |
|---|---|
| common.js | SUPABASE_URL, SUPABASE_KEY, VAPID_PUBLIC_KEY |
| GAS Script Properties | SUPABASE_URL, SUPABASE_KEY |
| GitHub Secrets | SUPABASE_URL, SUPABASE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL |

### ファイル構成（追加分）

```
├── sw.js                              # Service Worker（Push受信・通知表示）
├── manifest.json                      # PWA マニフェスト
├── scripts/
│   ├── package.json                   # 配信スクリプト用依存関係(web-push)
│   ├── push-notify.js                 # 配信処理（GitHub Actionsで実行）
│   └── generate-vapid-keys.js         # VAPID鍵ペア生成ユーティリティ
├── gas/
│   └── push-trigger.gs               # GAS時限トリガー（当日練習日検出→キュー登録）
├── supabase/
│   └── schema.sql                     # テーブル定義SQL
└── .github/workflows/
    └── push-notify.yml                # cron配信ワークフロー
```
