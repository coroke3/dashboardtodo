# Dashboard Todo 🚀

高機能で徹底的にカスタマイズ可能なタスク管理ダッシュボードアプリケーションです。Google Tasksとシームレスに連携し、膨大なタスクを効率的に整理・分析するための強力な機能を提供します。単なるToDoリストを超え、日々のルーチンの自動検出や、詳細な分析ダッシュボードによる生産性の可視化を実現します。

## ✨ アプリケーションの全体概要

このダッシュボードは、**「美しさと機能性の両立」**をテーマに設計されています。60種類以上の精巧なテーマプリセット、柔軟なUIカスタマイズ機能（アニメーションやマウスエフェクト）、そして各種分析ツールを統合しています。

---

## 🎯 豊富な機能とビュー

アプリケーションは以下の主要なビュー（タブ）で構成されています：

### 1. 📝 アクティブタスク (Active Tasks)
- **インテリジェントなタスク追加**: AIプロンプト生成機能を活用した迅速なタスク入力。
- **期間ごとの進捗カード**: 今週・来週・今月のタスク消化率（KPI）を直感的に把握できるダッシュボード型ウィジェット。
- **タグ＆ルーチンフィルタリング**: サイドバーからワンクリックでタスク群をフィルタリング。

### 2. 📅 カレンダービュー (Calendar)
- 直感的なカレンダーインターフェースで、締め切りやタスクのスケジュールを可視化。
- モバイル・デスクトップ両方に最適化されたレスポンシブなカレンダーナビゲーション。

### 3. 📊 分析ダッシュボード (Analytics)
タスクの完了データに基づき、生産性を定量的に分析します：
- **リードタイム分析**: タスクの作成から完了までにかかった日数を計算・可視化。
- **バーンダウンチャート**: 特定期間におけるタスク消化の推移をトラッキング。
- **スループット**: 週別・月別のタスク完了数を比較し、生産ペースを測定。
- **ヒートマップ**: 活動が活発だった日を視覚的に表示。

### 4. 🗂️ 整理＆ルーチン管理 (Organize)
- **タグ管理**: タスクに含まれるプレフィックス（例: `[univ]`, `[private]`）から自動的にタグを抽出し、管理。
- **ルーチン検出**: 「定期的に発生するタスク」を自動で検出し、頻度や完了率などを集計する高度なルーチン機能。

### 5. 🛠 UI設定＆システム (Settings)
- **デザインカスタマイズ**: フォント、角丸、アクセントカラーからテクスチャ（Glass, Paper, Neon等）まで自由自在に変更可能。
- **タスク一括置換**: 正規表現をサポートした高度な一括置換機能。変更プレビューを確認しながら安全にタスク名を一括更新可能。

---

## 🎨 圧倒的なテーマシステム

本アプリの最大の特徴は、**60種類以上のテーマプリセット**を搭載している点です。あらゆるユーザーの好みに対応します。

- **🍏 ブランド・OS**: `Cupertino (iOS風)`, `Fluent (Windows風)`, `Material You`, `VisionOS`
- **⚪️ モノクロ・ミニマル**: `Notion Style`, `Studio Noir`, `Pure White`, `Linear`
- **👁 視認性・高コントラスト**: `UD Focus Light/Dark`, `Dyslexia Friendly`, `Terminal HC`
- **🌸 ライト・温かみ**: `Editorial Serif`, `Sakura`, `Creamy Latte`, `Rose Water`
- **🤖 ダーク・サイバー**: `Cyber Neon`, `Tokyo Night`, `Dracula`, `Cyberpunk 2077`
- **💎 エレガント・リッチ**: `Glass Morphism`, `Aurora Borealis`, `Velvet`, `Midnight Gold`
- **💻 テック・開発者系**: `GitHub Light`, `VSCode Dark`, `Vercel`, `Monokai`

### さらなるUIカスタマイズ設定
- **アニメーション**: `spring`, `blur`, `fade`, `slide`, `off`
- **UI密度 (Density)**: `compact`, `normal`, `loose`
- **マウスエフェクト**: 追従する `glow` エフェクト
- **アイコンスタイル**: 通常のアイコン（Lucide）またはテキストベース

---

## 🛠 技術スタック

モダンなフロントエンド技術を駆使して構築されています：
- **Frontend Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4 (変数を活用した高度なカスタムCSS実装)
- **Icons**: Lucide React
- **API Integration**: Google Tasks API (OAuth 2.0)
- **Deployment**: Cloudflare Workers に最適化

---

## 🚀 セットアップガイド

ローカル環境でプロジェクトを起動するための手順です。

### 1. リポジトリのクローン
```bash
git clone <your-repository-url>
cd dashboardtodo
```

### 2. パッケージのインストール
```bash
npm install
```

### 3. Google APIの準備と環境変数設定
本アプリはGoogle Tasksと連携します。Google Cloud Consoleにてプロジェクトを作成し、OAuth クライアントIDを取得してください（`https://www.googleapis.com/auth/tasks` のスコープが必要です）。

`.env.example` をコピーして `.env` を作成します。
```bash
cp .env.example .env
```

作成した `.env` ファイルにクライアントIDを設定します：
```env
VITE_GOOGLE_CLIENT_ID=あなたのGoogle_OAuth_クライアントID
```

### 4. 開発サーバーの起動
```bash
npm run dev
```
ブラウザで `http://localhost:5173` にアクセスしてください。

---

## 🌐 デプロイ (Cloudflare Workers)

本プロジェクトは Cloudflare Workers へのデプロイ構成 (`wrangler.toml`) が用意されています。以下のコマンドで簡単にデプロイできます。

```bash
npm run deploy:workers
```
※事前に `wrangler` へのログインが必要です (`npx wrangler login`)。

---

## 📄 ライセンス

このプロジェクトは [MIT License](LICENSE) のもとで公開されています。自由にフォーク・改変してお使いください。
