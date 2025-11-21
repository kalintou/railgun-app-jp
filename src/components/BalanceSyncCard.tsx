"use client";

import { useState } from "react";
import {
  MerkletreeScanUpdateEvent,
  RailgunBalancesEvent,
  RailgunERC20Amount,
  RailgunWalletBalanceBucket,
} from "@railgun-community/shared-models";
import { formatUnits } from "ethers";
import { TEST_TOKEN, TEST_JPYC } from "@/lib/constants";

type SyncStatus = "idle" | "running" | "error";

type ScanState = {
  progress: number | null; // 0-100
  status: string | null;
};

const normalizeProgress = (raw?: number | null): number | null => {
  if (raw == null || Number.isNaN(raw)) return null;
  if (raw <= 1) return raw * 100;
  return raw;
};

const formatPercent = (value: number | null): string => {
  if (value == null) return "--%";
  return `${Math.round(value)}%`;
};

/** balances から対象のシールドトークン（TEST_TOKEN / WETH）を探す */
const findTokenAmount = (
  event: RailgunBalancesEvent | null,
  tokenAddress: string | null | undefined,
): RailgunERC20Amount | null => {
  if (!event || !tokenAddress) return null;

  const target = event.erc20Amounts.find((amt) => {
    const addr = (amt as any).tokenAddress as string | undefined;
    return (
      addr &&
      addr.toLowerCase() === tokenAddress.toLowerCase()
    );
  });

  return target ?? null;
};

/** シールドトークンの BigInt 金額を人間が読める形式にフォーマット（デフォルトで 18 桁小数として扱う） */
const formatShieldTokenAmount = (amount: RailgunERC20Amount | null) => {
  if (!amount) {
    return { short: "--", full: "--" };
  }

  const raw = (amount as any).amount as bigint | string | undefined;
  if (raw == null) {
    return { short: "--", full: "--" };
  }

  const decimals =
    (amount as any).decimals ??
    (amount as any).tokenData?.decimals ??
    18;

  const big =
    typeof raw === "bigint" ? raw : BigInt(raw);

  const full = formatUnits(big, decimals);
  const short = Number(full).toFixed(4);

  return { short, full };
};

export function BalanceSyncCard() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const [utxoScan, setUtxoScan] = useState<ScanState>({
    progress: null,
    status: null,
  });
  const [txidScan, setTxidScan] = useState<ScanState>({
    progress: null,
    status: null,
  });

  const [latestBalanceEvent, setLatestBalanceEvent] =
    useState<RailgunBalancesEvent | null>(null);

  const [walletId, setWalletId] = useState<string | null>(null);

  const registerCallbacks = async () => {
    const { setupBalanceCallbacks } = await import(
      "@/lib/balance-sync-browser"
    );

    setupBalanceCallbacks({
      onUTXOScanUpdate: (event: MerkletreeScanUpdateEvent) => {
        setUtxoScan({
          progress: normalizeProgress(event.progress),
          status: event.scanStatus ?? null,
        });
      },
      onTXIDScanUpdate: (event: MerkletreeScanUpdateEvent) => {
        setTxidScan({
          progress: normalizeProgress(event.progress),
          status: event.scanStatus ?? null,
        });
      },
      onBalanceUpdate: (event: RailgunBalancesEvent) => {
        console.log(
          "Balance update bucket:",
          event.balanceBucket,
          event.erc20Amounts,
        );

        // ✅ Spendable bucket のみ保存
        if (event.balanceBucket === RailgunWalletBalanceBucket.Spendable) {
          setLatestBalanceEvent(event);
        }
      },
    });
  };

  const handleStartSync = async () => {
    if (syncStatus === "running") return;

    setError(null);

    try {
      const [{ runBalancePoller }, { getStoredWalletID }] = await Promise.all([
        import("@/lib/balance-sync-browser"),
        import("@/lib/wallet-browser"),
      ]);

      const id = getStoredWalletID();
      if (!id) {
        setError("ローカルに保存された RAILGUN wallet ID がありません。先にウォレットを作成／読み込んでください。");
        setSyncStatus("error");
        return;
      }

      setWalletId(id);

      // コールバックを登録
      await registerCallbacks();

      setSyncStatus("running");

      // ポーリングを開始（await せず、UI をブロックしない）
      runBalancePoller([id]).catch((err) => {
        console.error("Balance poller error:", err);
        setSyncStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      });
    } catch (e) {
      console.error(e);
      setSyncStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRefreshOnce = async () => {
    // 長時間ポーリング中であれば単発更新は行わない（許可してもよいが、ここでは簡単な挙動にする）
    if (syncStatus === "running") {
      setError("残高のポーリング中のため、手動更新は不要です。");
      return;
    }

    setError(null);
    setSyncStatus("running");

    try {
      const [{ refreshBalancesOnce }, { getStoredWalletID }] = await Promise.all(
        [
          import("@/lib/balance-sync-browser"),
          import("@/lib/wallet-browser"),
        ],
      );

      const id = getStoredWalletID();
      if (!id) {
        setError("ローカルに保存された RAILGUN wallet ID がありません。先にウォレットを作成／読み込んでください。");
        setSyncStatus("error");
        return;
      }

      setWalletId(id);

      // コールバックが登録済みであることを保証する。そうでないと、この更新中の進捗や残高が UI に反映されない。
      await registerCallbacks();

      // 残高を 1 回だけ手動更新
      await refreshBalancesOnce([id]);

      // 単発更新完了後は状態を idle に戻す
      setSyncStatus("idle");
    } catch (e) {
      console.error(e);
      setSyncStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const statusLabel: Record<SyncStatus, string> = {
    idle: "未開始／待機中",
    running: "スキャン中",
    error: "エラー発生",
  };

  const statusColor: Record<SyncStatus, string> = {
    idle: "text-gray-500 bg-gray-50",
    running: "text-emerald-700 bg-emerald-50",
    error: "text-red-700 bg-red-50",
  };

  const renderScanRow = (title: string, state: ScanState) => {
    const percent = state.progress;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-gray-500">{title}</span>
          <span className="text-gray-400">
            {formatPercent(percent)}
            {state.status ? ` · ${state.status}` : ""}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-gray-900 transition-all"
            style={{ width: `${percent ?? 0}%` }}
          />
        </div>
      </div>
    );
  };

  const spendableOnly = (event: RailgunBalancesEvent | null) => {
    if (!event) return null;
    return event;
  };

  const balances = spendableOnly(latestBalanceEvent);

  // WETH (TEST_TOKEN) のプライベート残高
  const wethAmount = findTokenAmount(balances, TEST_TOKEN);
  const wethSummary = formatShieldTokenAmount(wethAmount);

  // JPYC のプライベート残高
  const jpycAmount = findTokenAmount(balances, TEST_JPYC);
  const jpycSummary = formatShieldTokenAmount(jpycAmount);

  const renderERC20Row = (amount: RailgunERC20Amount, index: number) => {
    const tokenAddress = (amount as any).tokenAddress ?? "";
    const displayAddress =
      tokenAddress.length > 16
        ? `${tokenAddress.slice(0, 8)}…${tokenAddress.slice(-6)}`
        : tokenAddress;

    const rawAmount = (amount as any).amount;
    const amountStr =
      typeof rawAmount === "bigint"
        ? rawAmount.toString()
        : rawAmount?.toString
          ? rawAmount.toString()
          : String(rawAmount ?? "");

    return (
      <div
        key={`${tokenAddress}-${index}`}
        className="flex items-center justify-between text-xs text-gray-700"
      >
        <span className="font-mono">{displayAddress || "Unknown ERC20"}</span>
        <span className="font-semibold">{amountStr}</span>
      </div>
    );
  };

  return (
    <section className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            プライベート残高の同期（Balance & Updating）
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            <code className="px-1 mx-0.5 rounded bg-gray-100 text-[10px]">
              refreshBalances
            </code>
            を呼び出してプライベート残高を更新します。ポーリングと 1 回だけの手動更新の両方に対応しています。
          </p>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor[syncStatus]}`}
        >
          {statusLabel[syncStatus]}
        </div>
      </div>

      <div className="space-y-4">
        {/* 2 つのボタン：ポーリング＋単発更新 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleStartSync}
            disabled={syncStatus === "running"}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium border border-gray-200 bg-gray-900 text-white disabled:opacity-60 disabled:cursor-not-allowed hover:bg-gray-800 transition"
          >
            {syncStatus === "running"
              ? "残高をポーリング中…"
              : "残高ポーリングを開始（Poller）"}
          </button>

          <button
            onClick={handleRefreshOnce}
            disabled={syncStatus === "running"}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium border border-gray-200 bg-white text-gray-900 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-gray-50 transition"
          >
            残高を 1 回手動更新（refreshBalances）
          </button>
        </div>

        {walletId && (
          <p className="text-[11px] text-gray-400">
            現在の対象ウォレット：<span className="font-mono">{walletId}</span>
          </p>
        )}

        {/* スキャン進捗 */}
        <div className="space-y-3">
          {renderScanRow("UTXO Merkle ツリーのスキャン", utxoScan)}
          {renderScanRow("TXID Merkle ツリーのスキャン", txidScan)}
        </div>

        {/* 新規：Shield トークン（WETH）のプライベート残高を強調表示 */}
        <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">
                Shield トークン プライベート残高（WETH / JPYC）
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                現在のウォレットが RAILGUN プール内で保有している WETH／JPYC のプライベート残高
                （Spendable bucket）を表示します。
              </p>
            </div>
          </div>

          {/* WETH 行 */}
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-semibold text-gray-900">
              {wethSummary.short}
            </span>
            <span className="text-xs text-gray-500">
              WETH
              {wethSummary.full !== "--" && (
                <span className="ml-2 text-[10px] text-gray-400">
                  フル：{wethSummary.full}
                </span>
              )}
            </span>
          </div>

          {/* JPYC 行 */}
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-semibold text-gray-900">
              {jpycSummary.short}
            </span>
            <span className="text-xs text-gray-500">
              JPYC
              {jpycSummary.full !== "--" && (
                <span className="ml-2 text-[10px] text-gray-400">
                  フル：{jpycSummary.full}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* 最新の残高イベント（完全一覧） */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">
              最新の残高イベント（RailgunBalancesEvent）
            </h3>
            {balances && (
              <span className="text-[11px] text-gray-400">
                Bucket:{" "}
                {
                  (balances as any)
                    .balanceBucket as RailgunWalletBalanceBucket
                }
              </span>
            )}
          </div>

          {balances ? (
            <>
              {balances.erc20Amounts.length > 0 ? (
                <div className="mt-1 space-y-1 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  {balances.erc20Amounts.map(renderERC20Row)}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400">
                  この bucket には ERC20 残高がありません。
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-gray-400">
              まだ残高イベントを受信していません。以下を確認してください：
              <br />
              1）エンジンを起動し Provider に接続していること
              <br />
              2）RAILGUN ウォレットを作成／読み込み済みであること
              <br />
              3）ウォレットに shield 済みのプライベート資産があること
              <br />
              その上で、上のボタンからポーリングまたは手動更新を実行してください。
            </p>
          )}
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-500 break-all">エラー：{error}</p>
        )}
      </div>
    </section>
  );
}
