import {
  calculateGasPrice,
  type NetworkName,
  TXIDVersion,
  type RailgunERC20AmountRecipient,
  type RailgunWalletInfo,
  type TransactionGasDetails,
} from "@railgun-community/shared-models";
import {
  gasEstimateForUnprovenTransfer,
  generateTransferProof,
  populateProvedTransfer,
} from "@railgun-community/wallet";
import { Contract, type Wallet, type HDNodeWallet } from "ethers";

import { TEST_NETWORK, TEST_TOKEN } from "@/lib/constants";
import { getProviderWallet } from "@/lib/wallet";
import {
  getGasDetailsForTransaction,
  getOriginalGasDetailsForTransaction,
  serializeERC20Transfer,
} from "@/lib/shield/tx-utils";
import {
  getCurrentEncryptionKey,
} from "@/lib/encryption-browser";
import {
  loadRailgunWalletForCurrentUser,
} from "@/lib/wallet-browser";

/** 「0.01」のような文字列を decimals に応じて BigInt に変換する */
const parseAmountToUnits = (amountStr: string, decimals: number): bigint => {
  const trimmed = amountStr.trim();
  if (!trimmed) {
    throw new Error("0 より大きい金額を入力してください。");
  }

  const [integerPartRaw, fractionRaw = ""] = trimmed.split(".");
  const integerPart = integerPartRaw || "0";

  if (!/^\d+$/.test(integerPart) || !/^\d*$/.test(fractionRaw)) {
    throw new Error("金額の形式が正しくありません。0.01 のような数値を入力してください。");
  }

  const fracPadded = (fractionRaw + "0".repeat(decimals)).slice(0, decimals);
  const whole = BigInt(integerPart);
  const frac = fracPadded ? BigInt(fracPadded) : 0n;

  return whole * 10n ** BigInt(decimals) + frac;
};

/**
 * Gas 推定：gasEstimateForUnprovenTransfer を呼び出して計算する。
 */
export const erc20PrivateTransferGasEstimate = async (
  encryptionKey: string,
  network: NetworkName,
  railgunWalletID: string,
  erc20AmountRecipients: RailgunERC20AmountRecipient[],
  sendWithPublicWallet: boolean = true,
  memoText: string | undefined = undefined,
) => {
  const originalGasDetails = await getOriginalGasDetailsForTransaction(
    network,
    sendWithPublicWallet,
  );
  console.log("private transfer originalGasDetails:", originalGasDetails);

  // ローカルデモ：feeTokenDetails は undefined のまま、broadcaster には接続しない。
  const feeTokenDetails = undefined;

  const { gasEstimate } = await gasEstimateForUnprovenTransfer(
    TXIDVersion.V2_PoseidonMerkle,
    network,
    railgunWalletID,
    encryptionKey,
    memoText,
    erc20AmountRecipients,
    [], // nftAmountRecipients
    originalGasDetails,
    feeTokenDetails,
    sendWithPublicWallet,
  );

  const estimatedGasDetails: TransactionGasDetails = {
    ...originalGasDetails,
    gasEstimate,
  };

  return {
    gasEstimate,
    estimatedGasDetails,
    originalGasDetails,
  };
};

type GenerateProofOptions = {
  showSenderAddressToRecipient?: boolean;
  sendWithPublicWallet?: boolean;
  broadcasterFeeERC20AmountRecipient?: RailgunERC20AmountRecipient;
  memoText?: string;
  onProgress?: (progress: number) => void;
};

/**
 * プライベート送金用の ZK 証明を生成する。
 */
export const erc20PrivateTransferGenerateProof = async (
  encryptionKey: string,
  network: NetworkName,
  railgunWalletID: string,
  tokenAmountRecipients: RailgunERC20AmountRecipient[],
  overallBatchMinGasPrice: bigint,
  options: GenerateProofOptions = {},
) => {
  const {
    showSenderAddressToRecipient = true,
    sendWithPublicWallet = true,
    broadcasterFeeERC20AmountRecipient,
    memoText,
    onProgress,
  } = options;

  const progressCallback = (progress: number) => {
    console.log("Private ERC20 Transfer Proof progress:", progress);
    if (onProgress) onProgress(progress);
  };

  await generateTransferProof(
    TXIDVersion.V2_PoseidonMerkle,
    network,
    railgunWalletID,
    encryptionKey,
    showSenderAddressToRecipient,
    memoText,
    tokenAmountRecipients,
    [], // nftAmountRecipients
    broadcasterFeeERC20AmountRecipient,
    sendWithPublicWallet,
    overallBatchMinGasPrice,
    progressCallback,
  );
};

type PopulateOptions = {
  sendWithPublicWallet?: boolean;
  broadcasterFeeERC20AmountRecipient?: RailgunERC20AmountRecipient;
  showSenderAddressToRecipient?: boolean;
  memoText?: string;
};

/**
 * 生成済みの証明を用いて、実際に送信するトランザクションを組み立てる。
 */
export const erc20PrivateTransferPopulateTransaction = async (
  network: NetworkName,
  railgunWalletID: string,
  tokenAmountRecipients: RailgunERC20AmountRecipient[],
  overallBatchMinGasPrice: bigint,
  transactionGasDetails: TransactionGasDetails,
  options: PopulateOptions = {},
) => {
  const {
    sendWithPublicWallet = true,
    broadcasterFeeERC20AmountRecipient,
    showSenderAddressToRecipient = true,
    memoText,
  } = options;

  const populateResponse = await populateProvedTransfer(
    TXIDVersion.V2_PoseidonMerkle,
    network,
    railgunWalletID,
    showSenderAddressToRecipient,
    memoText,
    tokenAmountRecipients,
    [], // nftAmountRecipients
    broadcasterFeeERC20AmountRecipient,
    sendWithPublicWallet,
    overallBatchMinGasPrice,
    transactionGasDetails,
  );

  return populateResponse;
};

export type PrivateTransferParams = {
  recipientRailgunAddress: string; // 受取側の 0zk アドレス
  humanAmount: string;             // 「0.01」のような文字列
  tokenAddress: string;            // WETH / JPYC コントラクトアドレス
  memoText?: string;
  onProofProgress?: (progress: number) => void;
};

export type PrivateTransferResult = {
  txHash: string;
};

/**
 * 高レベルのラッパー：
 * 「現在のユーザーの RAILGUN ウォレット + 現在の encryption key」を用いて、
 * プライベート残高から任意の 0zk アドレスへ TEST_TOKEN（WETH） をプライベート送金する。
 */
export const privateTransferERC20FromCurrentWallet = async (
  params: PrivateTransferParams,
): Promise<PrivateTransferResult> => {
  const {
    recipientRailgunAddress,
    humanAmount,
    memoText,
    tokenAddress,
    onProofProgress,
  } = params;

  if (!recipientRailgunAddress.trim()) {
    throw new Error("受取側の RAILGUN 0zk アドレスを入力してください。");
  }

  const encryptionKey = getCurrentEncryptionKey();
  if (!encryptionKey) {
    throw new Error("暗号化キーが見つかりません。先に Encryption カードでキーをアンロック／作成してください。");
  }

  const railgunWalletInfo = (await loadRailgunWalletForCurrentUser()) as
    | RailgunWalletInfo
    | (RailgunWalletInfo & { railgunAddress?: string });

  if (!railgunWalletInfo?.id) {
    throw new Error("RAILGUN ウォレットが見つかりません。先に Wallet カードで作成／読み込みを行ってください。");
  }

  const network = TEST_NETWORK as NetworkName;
  const sendWithPublicWallet = true;

  // EOA の provider を使って、指定されたトークンの decimals を取得
  const { wallet } = getProviderWallet();
  const erc20 = new Contract(
    tokenAddress,
    ["function decimals() view returns (uint8)"],
    wallet.provider,
  );

  const decimals: number = Number(await erc20.decimals());
  const amount = parseAmountToUnits(humanAmount, decimals);

  if (amount <= 0n) {
    throw new Error("金額は 0 より大きくなければなりません。");
  }

  const erc20AmountRecipients: RailgunERC20AmountRecipient[] = [
    serializeERC20Transfer(
      tokenAddress,
      amount,
      recipientRailgunAddress.trim(),
    ),
  ];

  // 1) Gas の事前推定
  const { gasEstimate } = await erc20PrivateTransferGasEstimate(
    encryptionKey,
    network,
    railgunWalletInfo.id,
    erc20AmountRecipients,
    sendWithPublicWallet,
    memoText,
  );

  const transactionGasDetails = await getGasDetailsForTransaction(
    network,
    gasEstimate,
    sendWithPublicWallet,
    wallet as Wallet | HDNodeWallet,
  );

  const overallBatchMinGasPrice = calculateGasPrice(
    transactionGasDetails,
  );

  // 2) 証明を生成（進捗コールバック付き）
  await erc20PrivateTransferGenerateProof(
    encryptionKey,
    network,
    railgunWalletInfo.id,
    erc20AmountRecipients,
    overallBatchMinGasPrice,
    {
      showSenderAddressToRecipient: true,
      sendWithPublicWallet,
      broadcasterFeeERC20AmountRecipient: undefined,
      memoText,
      onProgress: onProofProgress,
    },
  );

  // 3) トランザクションを Populate
  const { transaction } = await erc20PrivateTransferPopulateTransaction(
    network,
    railgunWalletInfo.id,
    erc20AmountRecipients,
    overallBatchMinGasPrice,
    transactionGasDetails,
    {
      sendWithPublicWallet,
      broadcasterFeeERC20AmountRecipient: undefined,
      showSenderAddressToRecipient: true,
      memoText,
    },
  );

  console.log("Private ERC20 tx:", transaction);

  // 4) public EOA を使って tx を送信
  const txResponse = await wallet.sendTransaction(transaction);
  console.log("Private ERC20 tx hash:", txResponse.hash);
  await txResponse.wait();

  return { txHash: txResponse.hash };
};