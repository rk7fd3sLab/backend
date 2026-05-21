# backend

Express で構成した社内備品貸出アプリの API サーバーです。

> AWS 上への公開手順（CloudFormation / ECS / CodeBuild を使った構築手順）は、[cicd_iacリポジトリ](../../../cicd_iac) を参照してください。

> frontend と backend は別のサービスを立ち上げる前提となっています。frontend と backend を 1 つのサービスで実現する構成は、single_service ブランチを参照してください。

## ローカル起動

### 開発モード

```bash
npm install
npm run dev
```

### 本番起動

```bash
npm run start
```

## 提供 API

- `GET /api/health`
- `GET /api/user`
- `GET /api/stats`
- `GET /api/equipment`
- `GET /api/equipment/:id`
- `GET /api/active-loans`

## アプリ設定

- `PORT`: 起動ポート。既定値は `4000`
- `CORS_ORIGIN`: 許可する frontend のオリジン。既定値は `http://localhost:3000`

## ローカル Docker 実行

```bash
docker build -t aws_cicd_backend .
docker run --rm -p 4000:4000 aws_cicd_backend
```

## 接続先

- backend health: http://localhost:4000/api/health

## CI/CD

このリポジトリの backend は GitHub Actions で CI と CD を分離しています。

### CI（テスト）

- ワークフロー: `.github/workflows/ci-workflow.yml`
- トリガー: `develop` 向け Pull Request（opened/synchronize/reopened）
- 処理: `npm install` と `npm run test`
- 通知: success/failure/cancel を Slack 通知

### CD（デプロイ）

- ワークフロー: `.github/workflows/cd-workflow.yml`
- トリガー:
	- `develop` への push -> `dev`
	- `release/**` への push -> `stage`
	- `*.*.*` 形式タグ push -> `real`
- 実行内容: CodeBuild で Docker build/push を行い、ECS service を `--force-new-deployment`

### デプロイ実行可否（DEPLOY_FLG）

CD 実行可否は `DEPLOY_FLG` で制御します。

- `DEPLOY_FLG=true`: AWS 認証、CodeBuild、デプロイを実行
- `DEPLOY_FLG=false`: デプロイをスキップし、Slack に skipped 通知

同じキーは `.env.<env>` と GitHub Environment Variables の両方に定義できます。
値の優先順位は次の通りで、重複時は上位の値で上書きされます。

1. GitHub Environment Variables
2. `.env.<env>` ファイル
3. workflow 内デフォルト値（`false`）

### 環境別設定ファイル

- `.env.dev`
- `.env.stage`
- `.env.real`

`.env.<env>` には GitHub Variables と同じキー（`DEPLOY_FLG`, `AWS_REGION` など）を記載可能です。
通常は `.env.<env>` を基準値として管理し、必要に応じて GitHub Environment Variables で上書きします。

現行の既定値は以下です。

- `dev`: `DEPLOY_FLG=false`
- `stage`: `DEPLOY_FLG=false`
- `real`: `DEPLOY_FLG=true`

### CD の Composite Actions

- `.github/actions/resolve-deploy-env`
	- git ref から `DEPLOY_ENV` 決定、`.env.<env>` 読み込み、GitHub vars 上書き
- `.github/actions/validate-and-gate`
	- `DEPLOY_FLG` 判定と必須設定チェック
- `.github/actions/run-codebuild`
	- CodeBuild 起動と完了までのポーリング
- `.github/actions/notify-slack`
	- success/failure/cancel/skipped の通知

### GitHub Secrets / Variables

必須 Secrets:

- `AWS_ACCOUNT_ID`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

任意 Secrets:

- `SLACK_WEBHOOK`

Variables（Environment 単位で上書き可）:

- `DEPLOY_FLG`
- `AWS_REGION`
- `CODEBUILD_PROJECT_NAME`
- `ECR_CONTAINER_NAME`
- `ECS_SERVICE`
- `ECS_CLUSTER_NAME`

## AWS設定ガイド（backend CD用）

この章は、backend の CD を GitHub Actions から AWS に接続して動かすための設定手順です。

### 1. 事前に AWS 側で準備するもの

- ECR リポジトリ
	- 例: `cicd/backend`
- ECS クラスター
	- 例: `ecs-cluster`
- ECS サービス
	- 例: `backend-task-service`
- CodeBuild プロジェクト
	- 例: `backend-build-deploy`
	- `buildspec.yml` は backend 配下のものを利用

### 2. GitHub Environments の作成

以下の Environment を作成します。（`.env.<env>` にも記載可能なので非必須）

- `dev`
- `stage`
- `real`

branch/tag からの環境振り分けは次の通りです。

- `develop` push -> `dev`
- `release/**` push -> `stage`
- `*.*.*` タグ push -> `real`

### 3. GitHub Secrets に登録する値

- 必須
- `AWS_ACCOUNT_ID`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

- 任意
- `SLACK_WEBHOOK`

補足:

- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` は GitHub Actions が AWS API を呼ぶための資格情報です。
- `SLACK_WEBHOOK` が未設定の場合、通知は送信されません。

### 4. GitHub Variables に登録する値

登録対象キー:

- `DEPLOY_FLG`
- `AWS_REGION`
- `CODEBUILD_PROJECT_NAME`
- `ECR_CONTAINER_NAME`
- `ECS_SERVICE`
- `ECS_CLUSTER_NAME`

運用ルール:

- 同じキーは `.env.<env>` にも記載可能です。
- 実行時は GitHub Environment Variables が `.env.<env>` より優先され、重複キーを上書きします。

### 5. IAM（GitHub Actions 用アクセスキー）

GitHub Actions 側の AWS 資格情報には、少なくとも次の操作が必要です。

- `codebuild:StartBuild`
- `codebuild:BatchGetBuilds`

推奨:

- IAM User よりも OIDC（`AssumeRoleWithWebIdentity`）構成がより安全です。
- まずは現行のアクセスキー運用で動作確認し、後で OIDC へ移行する方針でも問題ありません。

### 6. IAM（CodeBuild サービスロール）

CodeBuild のサービスロールには、buildspec の実行内容に対応する権限が必要です。

- ECR ログインと push
	- `ecr:GetAuthorizationToken`
	- `ecr:BatchCheckLayerAvailability`
	- `ecr:InitiateLayerUpload`
	- `ecr:UploadLayerPart`
	- `ecr:CompleteLayerUpload`
	- `ecr:PutImage`
- ECS サービス更新
	- `ecs:UpdateService`
	- `ecs:DescribeServices`
- アカウント情報取得
	- `sts:GetCallerIdentity`
- ログ出力
	- CloudWatch Logs への書き込み権限

### 7. 初回デプロイ時の確認ポイント

- `DEPLOY_FLG=true` の Environment でのみ CD が実行されること
- CodeBuild が `SUCCEEDED` になること
- ECR に `latest` と必要タグが push されること
- ECS サービスが新規デプロイされること
- Slack 通知（success / failure / skipped）が期待通りに送られること

## 補足

- CodeBuild 定義は `buildspec.yml` を参照してください。
- Docker ビルド文脈は `backend/Dockerfile` 優先で解決されます。