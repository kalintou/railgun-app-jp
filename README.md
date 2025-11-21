# 🚄 Railgun Browser Wallet Demo（日本語）

このリポジトリは **Railgun ブラウザウォレットをテストするためのデモアプリ**です。  
Sepolia Testnet を使用して、EOA／0zk ウォレットの作成、Shield / Private Transfer / Unshield までの操作を一通り試すことができます。

> ⚠️ **本デモは学習・検証用途です。絶対に本番用の助記詞（メインウォレット）を使用しないでください。**

---

## 📦 セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/yourname/railgun-app-jp.git
cd railgun-app-jp
2. パッケージをインストール
bash
Copy code
pnpm install
# または npm install / yarn install
3. .env.local を作成
/.env.local.example をコピー：

bash
Copy code
cp .env.local.example .env.local
以下を必ず設定：

変数名	説明
NEXT_PUBLIC_RAILGUN_TEST_MNEMONIC	テスト用ウォレットの助記詞
NEXT_PUBLIC_RAILGUN_TEST_RPC	Sepolia Ethereum RPC URL

例：

ini
Copy code
NEXT_PUBLIC_RAILGUN_TEST_MNEMONIC="test test test ..."
NEXT_PUBLIC_RAILGUN_TEST_RPC="https://sepolia.infura.io/v3/xxxxx"
4. テストネットトークンを準備
ETH（Sepolia）

WETH（Sepolia）

JPYC Testnet
コントラクト: 0xd3ef95d29a198868241fe374a999fc25f6152253

▶️ アプリの起動
bash
Copy code
pnpm dev
ブラウザで http://localhost:3000 を開いてください。

🔧 主要機能紹介
1. EOA ページ
テスト EOA アドレス

ETH / WETH / JPYC の残高表示

2. Engine ページ
Railgun エンジンの起動

RPC（Sepolia）への接続
※ Privacy Engine を使う前に必須

3. Encryption ページ
Railgun 用の暗号化キーを作成

パスワード（例：123456）を設定

4. Wallet ページ（0zk ウォレット）
Engine + Encryption の準備後に 0zk ウォレットロード

EOA を変更した場合は Reset → 再ロード推奨

5. Balances ページ
Shield 後のプライベート残高を更新して表示
※ 反映に時間がかかる場合あり

6. Shield ページ（EOA → 0zk）
対応トークン：

Token	説明
ETH	Shield 後、自動的に WETH に変換
WETH	そのまま Shield
JPYC	ERC20 として Shield

操作手順：

Token 選択

金額入力

Shield 実行 → 0zk に反映

7. Private Tx ページ（0zk → 0zk）
自分の 0zk から他の 0zk へのプライベート送金

Token 選択で自動的に正しいコントラクトアドレス適用

8. Unshield ページ（0zk → EOA）
プライベート残高を EOA へ戻す

0zk → EOA の資金移動操作

⚠️ 注意事項
本番助記詞を絶対に使用しないでください

本デモは Sepolia Testnet 専用

