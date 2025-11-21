import {
  EVMGasType,
  getEVMGasTypeForTransaction,
  type NetworkName,
  type RailgunERC20Amount,
  type RailgunERC20AmountRecipient,
  type RailgunNFTAmount,
  type RailgunNFTAmountRecipient,
  type TransactionGasDetails,
} from "@railgun-community/shared-models";
import {
  getShieldPrivateKeySignatureMessage,
  NFTTokenType,
} from "@railgun-community/wallet";
import { keccak256, type HDNodeWallet, type Wallet } from "ethers";
import { getProviderWallet } from "@/lib/wallet";

/**
 * パブリックウォレットで固定メッセージに署名し、その結果を keccak256 して shield private key を得る。
 * docs にある getShieldSignature に対応。
 */
export const getShieldSignature = async (
  wallet: Wallet | HDNodeWallet,
): Promise<string> => {
  const shieldSignatureMessage = getShieldPrivateKeySignatureMessage();
  const shieldPrivateKey = keccak256(
    await wallet.signMessage(shieldSignatureMessage),
  );
  return shieldPrivateKey;
};

/**
 * (tokenAddress, amount) を RailgunERC20Amount にシリアライズする。
 * unshield 用（現時点では予備）。
 */
export const serializeERC20RelayAdaptUnshield = (
  tokenAddress: string,
  amount: bigint,
): RailgunERC20Amount => {
  return {
    tokenAddress,
    amount,
  };
};

/**
 * ERC721 を RailgunNFTAmount にシリアライズする（予備・今は未使用）。
 */
export const serializeERC721RelayAdaptUnshield = (
  tokenAddress: string,
  tokenSubID: string,
): RailgunNFTAmount => {
  return {
    nftAddress: tokenAddress,
    amount: 1n,
    tokenSubID,
    nftTokenType: NFTTokenType.ERC721,
  };
};

/**
 * ERC20 送金情報を RailgunERC20AmountRecipient にシリアライズする。
 * shield ERC-20 で使用される。
 */
export const serializeERC20Transfer = (
  tokenAddress: string,
  amount: bigint,
  recipient: string,
): RailgunERC20AmountRecipient => {
  return {
    tokenAddress,
    amount,
    recipientAddress: recipient,
  };
};

/**
 * （予備）ERC721 送金情報を RailgunNFTAmountRecipient にシリアライズする。
 */
export const serializeERC721Transfer = (
  nftAddress: string,
  tokenSubID: string,
  recipient: string,
): RailgunNFTAmountRecipient => {
  return {
    nftAddress,
    amount: 1n,
    tokenSubID,
    nftTokenType: NFTTokenType.ERC721,
    recipientAddress: recipient,
  };
};

/**
 * ネットワークと gasEstimate に基づいて TransactionGasDetails を計算する。
 * 基本ロジックは docs をほぼそのまま移植：
 * まず wallet.populateTransaction で gas パラメータを取得し、
 * その後 EVM タイプに応じて組み立てる。
 *
 * ⚠️ 公式の説明どおり、あくまでデモ用の実装であり、
 *    本番環境での正確な gas 見積もりには適さない。
 */
export const getGasDetailsForTransaction = async (
  network: NetworkName,
  gasEstimate: bigint,
  sendWithPublicWallet: boolean,
  wallet: Wallet | HDNodeWallet,
): Promise<TransactionGasDetails> => {
  const evmGasType: EVMGasType = getEVMGasTypeForTransaction(
    network,
    sendWithPublicWallet,
  );

  // 自分自身に 1 wei を送るトランザクションを作り、EIP-1559 関連フィールドを取得する（デモ用）
  const { maxFeePerGas, maxPriorityFeePerGas } =
    await wallet.populateTransaction({
      to: wallet.address,
      value: 1n,
    });

  let gasDetails: TransactionGasDetails;

  switch (evmGasType) {
    case EVMGasType.Type0:
    case EVMGasType.Type1:
      gasDetails = {
        evmGasType,
        gasEstimate,
        gasPrice: BigInt(maxFeePerGas?.valueOf() ?? 0n),
      };
      break;
    case EVMGasType.Type2:
      gasDetails = {
        evmGasType,
        gasEstimate,
        maxFeePerGas: BigInt(maxFeePerGas?.valueOf() ?? 0n),
        maxPriorityFeePerGas: BigInt(
          maxPriorityFeePerGas?.valueOf() ?? 0n,
        ),
      };
      break;
  }

  return gasDetails;
};

export const getOriginalGasDetailsForTransaction = async (
  network: NetworkName,
  sendWithPublicWallet: boolean,
): Promise<TransactionGasDetails> => {
  // MOCK HANDLE WALLET MANAGEMENT AND GAS ESTIMATES（公式デモと同じ簡易実装）
  const { wallet } = getProviderWallet();
  const gasDetails = await getGasDetailsForTransaction(
    network,
    0n,
    sendWithPublicWallet,
    wallet,
  );
  return gasDetails;
};