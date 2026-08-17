-- Push通知用テーブル定義
-- Supabaseプロジェクト作成後にSQL Editorで実行する

-- 購読情報テーブル
CREATE TABLE push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  subscription JSONB NOT NULL,
  member_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 通知メッセージキューテーブル
CREATE TABLE push_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_member_name TEXT,
  sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- インデックス
CREATE INDEX idx_push_messages_sent ON push_messages (sent) WHERE sent = false;
CREATE INDEX idx_push_subscriptions_device_id ON push_subscriptions (device_id);

-- RLS (Row Level Security) ポリシー
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_messages ENABLE ROW LEVEL SECURITY;

-- anon キーでの読み書きを許可（アプリ側から直接アクセスするため）
CREATE POLICY "Allow all operations on push_subscriptions"
  ON push_subscriptions FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on push_messages"
  ON push_messages FOR ALL
  USING (true) WITH CHECK (true);
