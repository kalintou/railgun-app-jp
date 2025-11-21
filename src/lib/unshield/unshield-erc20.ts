import {
  calculateGasPrice,
  type NetworkName,
  TXIDVersion,
  type RailgunERC20AmountRecipient,
  type RailgunWalletInfo,
  type TransactionGasDetails,
} from "@railgun-community/shared-models";
import {
  gasEstimateForUnprovenUnshield,
  generateUnshieldProof,
  populateProvedUnshield,
} from "@railgun-community/wallet";

import {
  getGasDetailsForTransaction,
  getOriginalGasDetailsForTransaction,
  serializeERC20Transfer,
} from "@/lib/shield/tx-utils";
import { TEST_NETWORK, TEST_TOKEN } from "@/lib/constants";
import { getProviderWallet } from "@/lib/wallet";
import { getCurrentEncryptionKey } from "@/lib/encryption-browser";
import { loadRailgunWalletForCurrentUser } from "@/lib/wallet-browser";
import { Contract } from "ethers";

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
 * Gas 推定：docs に記載されている方法で gasEstimateForUnprovenUnshield を呼び出す。
 */
export const erc20UnshieldGasEstimate = async (
  network: NetworkName,
  railgunWalletID: string,
  encryptionKey: string,
  erc20AmountRecipients: RailgunERC20AmountRecipient[],
): Promise<bigint> => {
  const sendWithPublicWallet = true;

  const originalGasDetails = await getOriginalGasDetailsForTransaction(
    network,
    sendWithPublicWallet,
  );
  // broadcaster には接続せず、ローカルのデモとして簡略化。
  const feeTokenDetails = undefined;

  console.log("unshield originalGasDetails: ", originalGasDetails);

  const { gasEstimate } = await gasEstimateForUnprovenUnshield(
    TXIDVersion.V2_PoseidonMerkle,
    network,
    railgunWalletID,
    encryptionKey,
    erc20AmountRecipients,
    [], // nft amount recipients
    originalGasDetails,
    feeTokenDetails,
    sendWithPublicWallet,
  );

  return gasEstimate;
};

type UnshieldProofOptions = {
  sendWithPublicWallet?: boolean;
  broadcasterFeeERC20AmountRecipient?: RailgunERC20AmountRecipient;
  onProgress?: (progress: number) => void;
};

/**
 * Unshield 用の証明を生成する。
 */
export const erc20UnshieldGenerateProof = async (
  encryptionKey: string,
  network: NetworkName,
  railgunWalletID: string,
  tokenAmountRecipients: RailgunERC20AmountRecipient[],
  overallBatchMinGasPrice: bigint,
  options: UnshieldProofOptions = {},
) => {
  const {
    sendWithPublicWallet = true,
    broadcasterFeeERC20AmountRecipient,
    onProgress,
  } = options;

  const progressCallback = (progress: number) => {
    // 公式ドキュメントによると、性能の低いデバイスでは 20〜30 秒かかる場合がある。
    console.log("Unshield ERC20 Proof progress: ", progress);
    if (onProgress) {
      const v = progress <= 1 ? progress * 100 : progress;
      const clamped = Math.max(0, Math.min(100, v));
      onProgress(clamped);
    }
  };

  await generateUnshieldProof(
    TXIDVersion.V2_PoseidonMerkle,
    network,
    railgunWalletID,
    encryptionKey,
    tokenAmountRecipients,
    [], // nft amount recipients
    broadcasterFeeERC20AmountRecipient,
    sendWithPublicWallet,
    overallBatchMinGasPrice,
    progressCallback,
  );
};

type UnshieldPopulateOptions = {
  sendWithPublicWallet?: boolean;
  broadcasterFeeERC20AmountRecipient?: RailgunERC20AmountRecipient;
};

/**
 * 生成済みの証明を用いて、最終的に送信する Unshield トランザクションを組み立てる。
 */
export const erc20UnshieldPopulateTransaction = async (
  network: NetworkName,
  railgunWalletID: string,
  tokenAmountRecipients: RailgunERC20AmountRecipient[],
  overallBatchMinGasPrice: bigint,
  transactionGasDetails: TransactionGasDetails,
  options: UnshieldPopulateOptions = {},
) => {
  const {
    sendWithPublicWallet = true,
    broadcasterFeeERC20AmountRecipient,
  } = options;

  const populateResponse = await populateProvedUnshield(
    TXIDVersion.V2_PoseidonMerkle,
    network,
    railgunWalletID,
    tokenAmountRecipients,
    [], // nftAmountRecipients
    broadcasterFeeERC20AmountRecipient,
    sendWithPublicWallet,
    overallBatchMinGasPrice,
    transactionGasDetails,
  );

  return populateResponse;
};

export type UnshieldParams = {
  destinationAddress: string; // 公開 0x アドレス
  humanAmount: string;        // "0.01" のような文字列
  tokenAddress: string;       // WETH / JPYC コントラクトアドレス
  onProofProgress?: (progress: number) => void;
};

export type UnshieldResult = {
  txHash: string;
};

/**
 * 高レベルのラッパー:
 * 「現在のユーザーの RAILGUN ウォレット + 現在の encryptionKey」を使って、
 * プライベート TEST_TOKEN（WETH）残高から任意の公開 0x アドレスへ unshield する。
 */
export const unshieldERC20FromCurrentWallet = async (
  params: UnshieldParams,
): Promise<UnshieldResult> => {
  const { destinationAddress, humanAmount, tokenAddress, onProofProgress } =
    params;

  const dest = destinationAddress.trim();
  if (!dest) {
    throw new Error("unshield を受け取る公開 0x アドレスを入力してください。");
  }
  if (!dest.startsWith("0x") || dest.length < 10) {
    throw new Error("公開アドレスの形式が正しくないようです。確認してからもう一度お試しください。");
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

  // provider を使って、選択された ERC-20 の decimals を読み出す
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
    serializeERC20Transfer(tokenAddress, amount, dest),
  ];

  // 1) Gas の事前推定
  const gasEstimate = await erc20UnshieldGasEstimate(
    network,
    railgunWalletInfo.id,
    encryptionKey,
    erc20AmountRecipients,
  );

  console.log("ERC20 UNSHIELD gasEstimate:", gasEstimate.toString());

  const transactionGasDetails = await getGasDetailsForTransaction(
    network,
    gasEstimate,
    sendWithPublicWallet,
    wallet,
  );

  const overallBatchMinGasPrice = calculateGasPrice(transactionGasDetails);

  // 2) Unshield 証明を生成
  await erc20UnshieldGenerateProof(
    encryptionKey,
    network,
    railgunWalletInfo.id,
    erc20AmountRecipients,
    overallBatchMinGasPrice,
    {
      sendWithPublicWallet,
      broadcasterFeeERC20AmountRecipient: undefined,
      onProgress: onProofProgress,
    },
  );

  // 3) トランザクションを Populate
  const { transaction } = await erc20UnshieldPopulateTransaction(
    network,
    railgunWalletInfo.id,
    erc20AmountRecipients,
    overallBatchMinGasPrice,
    transactionGasDetails,
    {
      sendWithPublicWallet,
      broadcasterFeeERC20AmountRecipient: undefined,
    },
  );

  console.log("ERC20 UNSHIELD populated tx:", transaction);

  // 4) public EOA を使って Unshield トランザクションを送信
  const txResponse = await wallet.sendTransaction(transaction);
  console.log("ERC20 UNSHIELD tx hash:", txResponse.hash);
  await txResponse.wait();

  return { txHash: txResponse.hash };
};
