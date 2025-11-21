// src/lib/wallet.ts
import { JsonRpcProvider, Wallet } from "ethers";
import { TEST_RPC_URL, TEST_MNEMONIC } from "./constants";

export const getProviderWallet = () => {
  const provider = new JsonRpcProvider(TEST_RPC_URL);
  const wallet = Wallet.fromPhrase(TEST_MNEMONIC, provider);

  return {
    provider,
    wallet,
  };
};
