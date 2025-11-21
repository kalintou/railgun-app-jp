// src/lib/wallet.ts
import { JsonRpcProvider, Wallet } from "ethers";
import { TEST_RPC_URL, TEST_MNEMONIC } from "./constants";

let currentMnemonic: string = TEST_MNEMONIC ?? "";

export const setTestMnemonic = (mnemonic: string) => {
  currentMnemonic = mnemonic.trim();
};

export const getCurrentTestMnemonic = (): string => {
  if (!currentMnemonic) {
    throw new Error(
      "テスト用ニーモニックが設定されていません。MNEMONIC 入力画面で設定してください。"
    );
  }
  return currentMnemonic;
};

export const getProviderWallet = () => {
  const provider = new JsonRpcProvider(TEST_RPC_URL);
  const mnemonic = getCurrentTestMnemonic();
  const wallet = Wallet.fromPhrase(mnemonic, provider);

  return {
    provider,
    wallet,
  };
};
