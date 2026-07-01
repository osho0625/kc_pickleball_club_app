# 関東地区ピックル会 練習日管理アプリ

ピックルボールクラブの練習日程・出欠を管理するWebアプリケーションです。

## 技術スタック

- **フロントエンド**: Vanilla JS + 静的HTML/CSS（ダークテーマ）
- **バックエンド**: Google Apps Script（スタンドアロン）
- **データストア**: Google スプレッドシート（xlsx形式）
- **バックアップ**: GitHub API経由
- **テスト**: Vitest + fast-check（プロパティベーステスト）+ jsdom

## ディレクトリ構成

```
kc_pickleball_club_app/
├── index.html          # メインHTMLページ
├── style.css           # ダークテーマCSS
├── common.js           # API通信・ユーティリティ関数
├── app.js              # アプリケーションロジック・状態管理
├── gas/                # Google Apps Script（clasp管理）
│   ├── main.gs         # doGet/doPost ルーター
│   ├── spreadsheet.gs  # スプレッドシート読み書き
│   ├── github.gs       # GitHub API連携
│   ├── validation.gs   # バリデーション
│   ├── response.gs     # レスポンスビルダー
│   └── .claspignore    # clasp除外設定
├── tests/              # テストファイル（Vitest + fast-check）
├── package.json        # Node.js依存関係（dev tooling）
├── vitest.config.js    # Vitest設定
├── .clasp.json         # clasp設定（scriptId指定）
├── .gitignore          # Git除外設定
└── README.md           # このファイル
```

## セットアップ手順

### 1. 依存パッケージのインストール

```bash
cd kc_pickleball_club_app
npm install
```

### 2. テストの実行

```bash
npm test              # テスト実行（1回）
npm run test:watch    # ウォッチモードでテスト実行
```

### 3. GAS デプロイ（clasp）

1. `.clasp.json` の `scriptId` を実際のGASプロジェクトIDに書き換える
2. clasp にログイン:
   ```bash
   npx clasp login
   ```
3. GASにプッシュ:
   ```bash
   npm run push
   ```
4. GASエディタでWebアプリとしてデプロイ

### 4. フロントエンド配信

`index.html`, `style.css`, `common.js`, `app.js` を
GitHub Pages等の静的ホスティングに配置する。
