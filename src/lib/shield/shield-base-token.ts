import {
  NETWORK_CONFIG,
  type NetworkName,
  TXIDVersion,
  type RailgunERC20AmountRecipient,
} from "@railgun-community/shared-models";
import {
  gasEstimateForShieldBaseToken,
  populateShieldBaseToken,
} from "@railgun-community/wallet";
import { Contract, type HDNodeWallet, type Wallet } from "ethers";

import { TEST_NETWORK, TEST_TOKEN } from "@/lib/constants";
import { getProviderWallet } from "@/lib/wallet";
import {
  getGasDetailsForTransaction,
  getShieldSignature,
  serializeERC20Transfer,
} from "@/lib/shield/tx-utils";

/**
 * 「0.01」のような文字列を、トークンの decimals に応じて BigInt に変換する。
 */
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
 * base token の shield（ETH→wETH→shield）の gas を見積もる。
 */
export const baseShieldGasEstimate = async (
  network: NetworkName,
  wallet: Wallet | HDNodeWallet,
  erc20AmountRecipient: RailgunERC20AmountRecipient,
  railgunWalletAddress: string,
): Promise<bigint> => {
  const shieldPrivateKey = await getShieldSignature(wallet);

  const fromWalletAddress = wallet.address;

  const { gasEstimate } = await gasEstimateForShieldBaseToken(
    TXIDVersion.V2_PoseidonMerkle,
    network,
    railgunWalletAddress,
    shieldPrivateKey,
    erc20AmountRecipient,
    fromWalletAddress,
  );

  return gasEstimate;
};

/**
 * base token shield 用のトランザクションを構築する。
 */
export const basePopulateShieldTransaction = async (
  network: NetworkName,
  wallet: Wallet | HDNodeWallet,
  erc20AmountRecipient: RailgunERC20AmountRecipient,
  sendWithPublicWallet: boolean,
  railgunWalletAddress: string,
) => {
  const gasEstimate = await baseShieldGasEstimate(
    network,
    wallet,
    erc20AmountRecipient,
    railgunWalletAddress,
  );

  const shieldPrivateKey = await getShieldSignature(wallet);

  const gasDetails = await getGasDetailsForTransaction(
    network,
    gasEstimate,
    sendWithPublicWallet,
    wallet,
  );

  const { transaction, nullifiers } = await populateShieldBaseToken(
    TXIDVersion.V2_PoseidonMerkle,
    network,
    railgunWalletAddress,
    shieldPrivateKey,
    erc20AmountRecipient,
    gasDetails,
  );

  return {
    gasEstimate,
    gasDetails,
    transaction,
    nullifiers,
  };
};

/**
 * ローカルテスト用 EOA から、ETH をベーストークンとして現在の 0zk に shield する
 * （内部的には WETH に wrap される）。
 *
 * @param railgunWalletAddress  送信先の 0zk アドレス
 * @param humanAmount           "0.01" のようなテキスト形式の金額
 */
export const shieldBaseTokenFromTestWallet = async (
  railgunWalletAddress: string,
  humanAmount: string,
): Promise<{ txHash: string }> => {
  const { wallet } = getProviderWallet();
  const network = TEST_NETWORK as NetworkName;

  // TEST_TOKEN（WETH）の decimals を取得し、金額換算に利用
  const wethContract = new Contract(
    TEST_TOKEN,
    ["function decimals() view returns (uint8)"],
    wallet.provider,
  );

  const decimals: number = Number(await wethContract.decimals());
  const amount = parseAmountToUnits(humanAmount, decimals);

  if (amount <= 0n) {
    throw new Error("金額は 0 より大きくなければなりません。");
  }

  const erc20AmountRecipient: RailgunERC20AmountRecipient =
    serializeERC20Transfer(TEST_TOKEN, amount, railgunWalletAddress);

  const { transaction } = await basePopulateShieldTransaction(
    network,
    wallet,
    erc20AmountRecipient,
    true,
    railgunWalletAddress,
  );

  const tx = await wallet.sendTransaction(transaction);
  console.log("base shield tx:", tx.hash);
  await tx.wait();

  return { txHash: tx.hash };
};

/**
 * docs のサンプルに対応しており、最小単位でのテスト版。
 */
export const TEST_shieldBASE = async (
  railgunWalletAddress: string,
): Promise<void> => {
  console.log("TEST_shieldBASE");
  const { wallet } = getProviderWallet();
  const network = TEST_NETWORK as NetworkName;

  const erc20AmountRecipients: RailgunERC20AmountRecipient[] = [
    serializeERC20Transfer(TEST_TOKEN, 1n, railgunWalletAddress),
  ];

  const { transaction } = await basePopulateShieldTransaction(
    network,
    wallet,
    erc20AmountRecipients[0],
    true,
    railgunWalletAddress,
  );

  const tx = await wallet.sendTransaction(transaction);
  console.log("tx: ", tx.hash);
  await tx.wait();
};