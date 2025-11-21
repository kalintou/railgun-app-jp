import {
  setOnUTXOMerkletreeScanCallback,
  setOnTXIDMerkletreeScanCallback,
  setOnBalanceUpdateCallback,
  refreshBalances,
} from "@railgun-community/wallet";
import {
  delay,
  type MerkletreeScanUpdateEvent,
  NETWORK_CONFIG,
  type NetworkName,
  type RailgunBalancesEvent,
  RailgunWalletBalanceBucket,
} from "@railgun-community/shared-models";
import { TEST_NETWORK } from "@/lib/constants";

// ポーリング間隔：1 分（必要に応じて 30 秒などに短くしてもよい）
const BALANCE_POLLER_INTERVAL = 1000 * 60 * 1;

// ===== UI コールバックの型 =====
export type UTXOScanUpdateHandler = (
  event: MerkletreeScanUpdateEvent
) => void;

export type TXIDScanUpdateHandler = (
  event: MerkletreeScanUpdateEvent
) => void;

export type BalanceUpdateHandler = (event: RailgunBalancesEvent) => void;

type Handlers = {
  onUTXOScanUpdate?: UTXOScanUpdateHandler;
  onTXIDScanUpdate?: TXIDScanUpdateHandler;
  onBalanceUpdate?: BalanceUpdateHandler;
};

// ===== 外部に公開する handler フック（React から注入する想定） =====
let externalUTXOHandler: UTXOScanUpdateHandler | undefined;
let externalTXIDHandler: TXIDScanUpdateHandler | undefined;
let externalBalanceHandler: BalanceUpdateHandler | undefined;

// ===== ドキュメントにあるコールバック実装 + UI コールバックの呼び出し =====

const onUTXOMerkletreeScanCallback = (eventData: MerkletreeScanUpdateEvent) => {
  // プライベート残高スキャン中に随時呼び出される
  console.log("UTXO scan update:", eventData.progress, eventData.scanStatus);
  if (externalUTXOHandler) {
    externalUTXOHandler(eventData);
  }
};

const onTXIDMerkletreeScanCallback = (eventData: MerkletreeScanUpdateEvent) => {
  console.log("TXID scan update:", eventData.progress, eventData.scanStatus);
  if (externalTXIDHandler) {
    externalTXIDHandler(eventData);
  }
};

/**
 * 直近の残高イベントを bucket ごとにキャッシュする
 */
export const balanceCache = new Map<
  RailgunWalletBalanceBucket,
  RailgunBalancesEvent
>();

const onBalanceUpdateCallback = (balancesFormatted: RailgunBalancesEvent) => {
  console.log("Balances updated:", balancesFormatted.balanceBucket);
  if (balancesFormatted.erc20Amounts.length > 0) {
    console.log("ERC20 Balances: ", balancesFormatted.erc20Amounts);
  }

  balanceCache.set(balancesFormatted.balanceBucket, balancesFormatted);

  if (externalBalanceHandler) {
    externalBalanceHandler(balancesFormatted);
  }
};

/**
 * Balance & Scan のコールバックを設定する。
 * Engine 起動後に 1 回呼び出すことを推奨。
 */
export const setupBalanceCallbacks = (handlers?: Handlers) => {
  externalUTXOHandler = handlers?.onUTXOScanUpdate;
  externalTXIDHandler = handlers?.onTXIDScanUpdate;
  externalBalanceHandler = handlers?.onBalanceUpdate;

  setOnUTXOMerkletreeScanCallback(onUTXOMerkletreeScanCallback);
  setOnTXIDMerkletreeScanCallback(onTXIDMerkletreeScanCallback);
  setOnBalanceUpdateCallback(onBalanceUpdateCallback);
};

export const refreshBalancesOnce = async (walletIds?: string[]) => {
  const chain = NETWORK_CONFIG[TEST_NETWORK as NetworkName].chain;
  await refreshBalances(chain, walletIds);
};

/**
 * 指定されたウォレットのプライベート残高をポーリングする。
 * refreshBalances を呼ぶ → 上のコールバックが発火 → delay → 自分を再度呼ぶ（無限ループ）。
 */
export const runBalancePoller = async (walletIds: string[]) => {
  const chain = NETWORK_CONFIG[TEST_NETWORK as NetworkName].chain;
  console.log("Running balance poller... on chain", chain);

  try {
    await refreshBalances(chain, walletIds);
  } catch (error) {
    console.error("BALANCE REFRESH ERROR", error);
    // シンプルにもう一度だけリトライ
    await refreshBalances(chain, walletIds);
  }

  console.log("Balance poller complete. Waiting for next poll...");
  if (balanceLoadedPromise != null) {
    balanceLoadedPromise("Loaded Balances");
    balanceLoadedPromise = undefined;
  }

  await delay(BALANCE_POLLER_INTERVAL);
  // 次のポーリングサイクルへ進む
  runBalancePoller(walletIds).catch((err) =>
    console.error("Balance poller loop error:", err),
  );
};

// ===== オプション: waitForBalancesLoaded ユーティリティ（今は未使用だが、将来のために残しておく） =====

let balanceLoadedPromise:
  | ((value: unknown) => void)
  | null
  | undefined = undefined;

export const waitForBalancesLoaded = async () => {
  return new Promise((resolve) => {
    balanceLoadedPromise = resolve;
  });
};

/**
 * キャッシュから「Spendable（支払い可能）」残高を取得する
 */
export const getSpendableBalances = () => {
  return balanceCache.get(RailgunWalletBalanceBucket.Spendable);
};