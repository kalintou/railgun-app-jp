import {
  NETWORK_CONFIG,
  type NetworkName,
  TXIDVersion,
  type RailgunERC20AmountRecipient,
} from "@railgun-community/shared-models";
import {
  gasEstimateForShield,
  populateShield,
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
 * ユーティリティ： 「0.01」のような文字列を、トークンの decimals に基づいて BigInt に変換する。
 * 本番向けの実装ではないが、ローカルテストには十分。
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
 * shield ERC-20 の gas を見積もる。
 */
export const erc20ShieldGasEstimate = async (
  network: NetworkName,
  wallet: Wallet | HDNodeWallet,
  erc20AmountRecipients: RailgunERC20AmountRecipient[],
): Promise<bigint> => {
  const shieldPrivateKey = await getShieldSignature(wallet);

  // パブリックウォレットアドレス（どの 0x アドレスから送るか）
  const fromWalletAddress = wallet.address;

  const { gasEstimate } = await gasEstimateForShield(
    TXIDVersion.V2_PoseidonMerkle,
    network,
    shieldPrivateKey,
    erc20AmountRecipients,
    [], // nftAmountRecipients
    fromWalletAddress,
  );

  return gasEstimate;
};

/**
 * shield を実行するトランザクションを組み立てる（事前に allowance を approve する）。
 * docs の erc20PopulateShieldTransaction に対応。
 */
export const erc20PopulateShieldTransaction = async (
  network: NetworkName,
  wallet: Wallet | HDNodeWallet,
  erc20AmountRecipients: RailgunERC20AmountRecipient[],
  sendWithPublicWallet: boolean,
) => {
  // 1. RAILGUN proxy コントラクトに対して token allowance を approve
  const spender = NETWORK_CONFIG[network].proxyContract;

  for (const amountRecipient of erc20AmountRecipients) {
    const contract = new Contract(
      amountRecipient.tokenAddress,
      [
        "function allowance(address owner, address spender) view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)",
      ],
      wallet,
    );

    const allowance = await contract.allowance(wallet.address, spender);
    if (allowance >= amountRecipient.amount) {
      console.log("already have enough allowance");
      continue;
    }

    const tx = await contract.approve(spender, amountRecipient.amount);
    await tx.wait();
  }

  // 2. shield の gas を見積もる
  const gasEstimate = await erc20ShieldGasEstimate(
    network,
    wallet,
    erc20AmountRecipients,
  );

  // 3. shieldPrivateKey + gasDetails を取得
  const shieldPrivateKey = await getShieldSignature(wallet);

  const gasDetails = await getGasDetailsForTransaction(
    network,
    gasEstimate,
    sendWithPublicWallet,
    wallet,
  );

  // 4. populateShield を呼び出して、実際に送信するトランザクションを生成
  const { transaction, nullifiers } = await populateShield(
    TXIDVersion.V2_PoseidonMerkle, // RAILGUN V2
    network,
    shieldPrivateKey,
    erc20AmountRecipients,
    [], // nft recipients
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
 * 高レベルラッパー：ローカルの TEST EOA から、TEST_TOKEN を指定の 0zk アドレスへ shield する。
 *
 * @param railgunWalletAddress  送信先の 0zk アドレス
 * @param humanAmount           テキスト形式の金額（例: "0.01"）。TEST_TOKEN の decimals に従って処理
 */
export type ShieldERC20Params = {
  railgunWalletAddress: string;
  humanAmount: string;   // "0.01"
  tokenAddress: string;  // WETH または JPYC のコントラクトアドレス
};

export const shieldERC20FromTestWallet = async (
  params: ShieldERC20Params,
): Promise<{ txHash: string }> => {
  const { railgunWalletAddress, humanAmount, tokenAddress } = params;

  const { wallet } = getProviderWallet();
  const network = TEST_NETWORK as NetworkName;

  // token の decimals を取得し、「0.01」から最小単位への変換に使う
  const erc20Contract = new Contract(
    tokenAddress,
    ["function decimals() view returns (uint8)"],
    wallet.provider,
  );

  const decimals: number = Number(await erc20Contract.decimals());
  const amount = parseAmountToUnits(humanAmount, decimals);

  if (amount <= 0n) {
    throw new Error("金額は 0 より大きくなければなりません。");
  }

  const erc20AmountRecipients: RailgunERC20AmountRecipient[] = [
    serializeERC20Transfer(tokenAddress, amount, railgunWalletAddress),
  ];

  const { transaction } = await erc20PopulateShieldTransaction(
    network,
    wallet,
    erc20AmountRecipients,
    true, // sendWithPublicWallet
  );

  const tx = await wallet.sendTransaction(transaction);
  console.log("shield tx:", tx.hash);
  await tx.wait();

  return { txHash: tx.hash };
};

/**
 * docs と同じサンプル関数：最小単位 1 を指定の 0zk アドレスへ shield する。
 * Node スクリプトでのテスト用。
 */
export const TEST_shieldERC20 = async (
  railgunWalletAddress: string,
): Promise<void> => {
  const { wallet } = getProviderWallet();

  const erc20AmountRecipients: RailgunERC20AmountRecipient[] = [
    serializeERC20Transfer(TEST_TOKEN, 1n, railgunWalletAddress),
  ];

  const { transaction } = await erc20PopulateShieldTransaction(
    TEST_NETWORK as NetworkName,
    wallet,
    erc20AmountRecipients,
    true,
  );

  const tx = await wallet.sendTransaction(transaction);
  console.log("tx: ", tx.hash);
  await tx.wait();
};
