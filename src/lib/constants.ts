import { NETWORK_CONFIG, NetworkName } from "@railgun-community/shared-models";

// ✅ NEXT_PUBLIC を付けて、Next.js のフロント側でも利用できるようにする
const RPC_URL = process.env.NEXT_PUBLIC_RAILGUN_TEST_RPC;

if (!RPC_URL) {
  throw new Error("NEXT_PUBLIC_RAILGUN_TEST_RPC が設定されていません。");
}

/**
 * テスト用途で使用するネットワーク。
 * 現在は Ethereum Sepolia ネットワークを設定。
 */
export const TEST_NETWORK = NetworkName.EthereumSepolia;

/**
 * RAILGUN テスト環境用の RPC URL。
 * RAILGUN のチェーン操作のためにテスト用ブロックチェーンに接続する際に使用する。
 */
export const TEST_RPC_URL = RPC_URL;

/**
 * テストネットワークにおける Wrapped Base Token のアドレス。
 */
export const TEST_TOKEN =
  NETWORK_CONFIG[TEST_NETWORK].baseToken.wrappedAddress;

/**
 * テスト用 NFT コントラクトの Ethereum アドレス。
 * TODO: 必要に応じて "0x...." を実際のテスト用 NFT アドレスに置き換える。
 */
export const TEST_NFT_ADDRESS = "0x....";

/**
 * テスト NFT のサブ ID。
 */
export const TEST_NFT_SUBID = "1";

/**
 * RAILGUN 用のテスト Mnemonic（ニーモニック）。
 * NEXT_PUBLIC_RAILGUN_TEST_MNEMONIC があればそれを使用し、
 * なければデフォルトのテスト用ニーモニックを使用。
 * ⚠️ テスト環境専用。
 */
export const TEST_MNEMONIC =
  process.env.NEXT_PUBLIC_RAILGUN_TEST_MNEMONIC ??
  "";

/**
 * 開発用のテスト Encryption Key。
 * ⚠️ 本番環境では絶対に使用しないこと。
 */
export const TEST_ENCRYPTION_KEY =
  "0101010101010101010101010101010101010101010101010101010101010101";

// Sepolia WETH
export const TEST_WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";

// JPYC（6 decimals）テストネットアドレス
export const TEST_JPYC =
  "0xd3eF95d29A198868241FE374A999fc25F6152253";
