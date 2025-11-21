import {
  NETWORK_CONFIG,
  type NetworkName,
  type RailgunWalletInfo,
} from "@railgun-community/shared-models";
import {
  createRailgunWallet,
  loadWalletByID,
  getWalletShareableViewingKey,
} from "@railgun-community/wallet";
import { TEST_NETWORK, TEST_MNEMONIC } from "@/lib/constants";
import { getCurrentEncryptionKey } from "./encryption-browser";
import { getCurrentTestMnemonic } from "./wallet"; 

// ローカルに wallet ID を保存するためのキー（文字列のみ保存し、秘密鍵などは保存しない）
const WALLET_ID_STORAGE_KEY = "railgun-demo-private-wallet-id";

const ensureBrowser = () => {
  if (typeof window === "undefined") {
    throw new Error("RAILGUN Wallet APIs must be called in a browser environment.");
  }
};

export const getStoredWalletID = (): string | null => {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return null;
  }
  return localStorage.getItem(WALLET_ID_STORAGE_KEY);
};

const storeWalletID = (id: string) => {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(WALLET_ID_STORAGE_KEY, id);
};

export const clearStoredWalletID = (): void => {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(WALLET_ID_STORAGE_KEY);
};

/**
 * 新しい RAILGUN ウォレットを作成する:
 * - 現在アンロックされている encryptionKey を使用
 * - TEST_MNEMONIC（テスト用）を使用
 * - NETWORK_CONFIG[TEST_NETWORK].deploymentBlock を creationBlockMap として使用
 */
export const createRailgunWalletForCurrentUser =
  async (): Promise<RailgunWalletInfo> => {
    ensureBrowser();

    const encryptionKey = getCurrentEncryptionKey();
    if (!encryptionKey) {
      throw new Error("encryption key がまだアンロックされていません。先に上のパスワードカードでパスワードを入力してください。");
    }

    const networkName = TEST_NETWORK as NetworkName;
    const { deploymentBlock } = NETWORK_CONFIG[networkName];

    const creationBlockNumberMap = {
      [networkName]: deploymentBlock,
    };

    const railgunWalletInfo = await createRailgunWallet(
      encryptionKey,
      getCurrentTestMnemonic(),
      creationBlockNumberMap,
    );

    storeWalletID(railgunWalletInfo.id);

    return railgunWalletInfo;
  };

/**
 * 現在の encryptionKey + 保存済み walletId を使って RAILGUN ウォレットを読み込む。
 */
export const loadRailgunWalletForCurrentUser =
  async (): Promise<RailgunWalletInfo> => {
    ensureBrowser();

    const encryptionKey = getCurrentEncryptionKey();
    if (!encryptionKey) {
      throw new Error("encryption key がまだアンロックされていません。先に上のパスワードカードでパスワードを入力してください。");
    }

    const walletId = getStoredWalletID();
    if (!walletId) {
      throw new Error("ローカルに保存されたウォレット ID がありません。先に RAILGUN ウォレットを作成してください。");
    }

    const info = await loadWalletByID(encryptionKey, walletId, false);
    return info;
  };

/**
 * 既存ウォレットの読み込みを優先して試み、なければ新しく作成する。
 */
export const createOrLoadRailgunWallet =
  async (): Promise<RailgunWalletInfo> => {
    ensureBrowser();

    const encryptionKey = getCurrentEncryptionKey();
    if (!encryptionKey) {
      throw new Error("encryption key がまだアンロックされていません。先に上のパスワードカードでパスワードを入力してください。");
    }

    const existingID = getStoredWalletID();
    if (existingID) {
      try {
        const info = await loadWalletByID(encryptionKey, existingID, false);
        return info;
      } catch (err) {
        console.warn("既存の RAILGUN ウォレットの読み込みに失敗しました。新しく作成します。", err);
      }
    }

    const info = await createRailgunWalletForCurrentUser();
    return info;
  };

/**
 * 現在のウォレットの shareable viewing key をエクスポートする。
 * - encryptionKey がアンロックされている場合のみエクスポートを許可（他人がブラウザを開いただけでエクスポートできないようにする）。
 * - 公式の getWalletShareableViewingKey(railgunWalletID) を呼び出す。
 */
export const getShareableViewingKeyForCurrentWallet =
  async (): Promise<string> => {
    ensureBrowser();

    const encryptionKey = getCurrentEncryptionKey();
    if (!encryptionKey) {
      throw new Error("encryption key がまだアンロックされていないため、viewing key をエクスポートできません。");
    }

    const walletId = getStoredWalletID();
    if (!walletId) {
      throw new Error("ローカルに保存されたウォレット ID がありません。先に RAILGUN ウォレットを作成してください。");
    }

    const viewingKey = await getWalletShareableViewingKey(walletId);
    return viewingKey;
  };
