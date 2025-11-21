"use client";

import { useCallback, useEffect, useState } from "react";
import { getProviderWallet } from "@/lib/wallet";
import { CopyButton } from "@/components/CopyButton";
import { formatEther, parseEther, Contract, formatUnits } from "ethers";
import { TEST_WETH, TEST_JPYC } from "@/lib/constants"; // Sepolia WETH コントラクトアドレス

type UnwrapStatus = "idle" | "working" | "success" | "error";

export function EoaAddressCard() {
  const [address, setAddress] = useState<string>("");
  const [ethFull, setEthFull] = useState<string | null>(null);
  const [ethShort, setEthShort] = useState<string | null>(null);

  const [wethFull, setWethFull] = useState<string | null>(null);
  const [wethShort, setWethShort] = useState<string | null>(null);

  // 👉 JPYC を追加
  const [jpycFull, setJpycFull] = useState<string | null>(null);
  const [jpycShort, setJpycShort] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WETH → ETH アンラップ関連の状態
  const [unwrapAmount, setUnwrapAmount] = useState<string>("0.01");
  const [unwrapStatus, setUnwrapStatus] = useState<UnwrapStatus>("idle");
  const [unwrapError, setUnwrapError] = useState<string | null>(null);
  const [unwrapTxHash, setUnwrapTxHash] = useState<string | null>(null);

  const refreshBalances = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { wallet, provider } = getProviderWallet();
      const addr = await wallet.getAddress();
      setAddress(addr);

      // 1) ETH 残高
      const balanceWei = await provider.getBalance(addr);
      const balanceEthFull = formatEther(balanceWei);
      const balanceEthShort = Number(balanceEthFull).toFixed(4);

      setEthFull(balanceEthFull);
      setEthShort(balanceEthShort);

      // 2) WETH 残高（ERC-20）
      const wethContract = new Contract(
        TEST_WETH,
        ["function balanceOf(address) view returns (uint256)"],
        provider,
      );

      const wethBalanceRaw = await wethContract.balanceOf(addr);
      const wethFullStr = formatEther(wethBalanceRaw);
      const wethShortStr = Number(wethFullStr).toFixed(4);

      setWethFull(wethFullStr);
      setWethShort(wethShortStr);

      // 3) JPYC 残高（ERC-20）
      const jpycContract = new Contract(
        TEST_JPYC,
        [
          "function balanceOf(address) view returns (uint256)",
          "function decimals() view returns (uint8)",
        ],
        provider,
      );

      const [jpycBalanceRaw, jpycDecimals] = await Promise.all([
        jpycContract.balanceOf(addr),
        jpycContract.decimals(),
      ]);

      const jpycFullStr = formatUnits(jpycBalanceRaw, Number(jpycDecimals));
      const jpycShortStr = Number(jpycFullStr).toFixed(4);

      setJpycFull(jpycFullStr);
      setJpycShort(jpycShortStr);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // WETH → ETH：現在の EOA アドレスから WETH をアンラップしてネイティブ ETH に戻す
  const handleUnwrapWETH = useCallback(async () => {
    setUnwrapStatus("working");
    setUnwrapError(null);
    setUnwrapTxHash(null);

    try {
      const { wallet } = getProviderWallet();
      const addr = await wallet.getAddress();

      if (!addr) {
        throw new Error("EOA アドレスが読み込まれていません。しばらくしてからもう一度お試しください。");
      }

      if (!wethFull) {
        throw new Error("現在の WETH 残高を取得できません。先に残高を更新してください。");
      }

      // 入力が空の場合は、全額アンラップをデフォルトにする
      const amountStr =
        unwrapAmount.trim() === "" ? wethFull : unwrapAmount.trim();

      let amount: bigint;
      try {
        amount = parseEther(amountStr);
      } catch {
        throw new Error("有効な数量を入力してください（例：0.01）。");
      }

      if (amount <= 0n) {
        throw new Error("変換する数量は 0 より大きい必要があります。");
      }

      // 現在の残高を超えていないかチェック
      const currentBalance = wethFull ? parseEther(wethFull) : 0n;
      if (amount > currentBalance) {
        throw new Error("変換数量が現在の WETH 残高を超えています。");
      }

      // signer 付きのコントラクトインスタンスで withdraw を呼び出す
      const wethWithSigner = new Contract(
        TEST_WETH,
        ["function withdraw(uint256 wad) external"],
        wallet,
      );

      const tx = await wethWithSigner.withdraw(amount);

      setUnwrapTxHash(tx.hash);

      await tx.wait();

      setUnwrapStatus("success");

      // トランザクション完了後に残高を再取得
      await refreshBalances();
    } catch (e) {
      console.error(e);
      setUnwrapStatus("error");
      setUnwrapError(e instanceof Error ? e.message : String(e));
    } finally {
      // 失敗した場合でも loading 状態は解除する
      setTimeout(() => {
        setUnwrapStatus((prev) => (prev === "success" ? prev : "idle"));
      }, 500);
    }
  }, [refreshBalances, unwrapAmount, wethFull]);

  // 初回マウント時に一度残高を取得
  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  const unwrapStatusLabel: Record<UnwrapStatus, string> = {
    idle: "待機中",
    working: "変換中…",
    success: "完了",
    error: "エラー発生",
  };

  const unwrapStatusColor: Record<UnwrapStatus, string> = {
    idle: "text-gray-500 bg-gray-50",
    working: "text-amber-700 bg-amber-50",
    success: "text-emerald-700 bg-emerald-50",
    error: "text-red-700 bg-red-50",
  };

  return (
    <div className="bg-white shadow-lg rounded-2xl p-8 border border-gray-100">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Railgun Local Dev
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            テスト用ニーモニックから生成された EOA アドレスです。Sepolia ETH テストネットでのローカル開発専用です。
          </p>
        </div>

        {/* 手動リフレッシュボタン */}
        <button
          type="button"
          onClick={() => void refreshBalances()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <span className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-transparent rounded-full" />
              更新中…
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              残高を更新
            </>
          )}
        </button>
      </header>

      <section className="space-y-6">
        {/* アドレス表示エリア */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-gray-400">
            EOA Address
          </div>

          <div className="flex items-center gap-2">
            <code className="text-sm break-all bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 flex-1">
              {address || "（読み込み中…）"}
            </code>
            {address && <CopyButton value={address} />}
          </div>
        </div>

        {/* Sepolia ETH 残高 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wide text-gray-400">
              Sepolia ETH Balance
            </div>
            <span className="text-[11px] text-gray-400">
              （テストネットの ETH トークン）
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold text-gray-900">
              {ethShort ?? "--"}
            </span>
            <span className="text-xs text-gray-500">
              ETH
              {ethFull && (
                <span className="ml-2 text-[10px] text-gray-400">
                  フル：{ethFull}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* WETH 残高 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wide text-gray-400">
              WETH Balance
            </div>
            <span className="text-[11px] text-gray-400">
              （Wrapped ETH ／ ERC-20）
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold text-gray-900">
              {wethShort ?? "--"}
            </span>
            <span className="text-xs text-gray-500">
              WETH
              {wethFull && (
                <span className="ml-2 text-[10px] text-gray-400">
                  フル：{wethFull}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* JPYC 残高 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wide text-gray-400">
              JPYC Balance
            </div>
            <span className="text-[11px] text-gray-400">
              （Sepolia JPYC テストトークン）
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold text-gray-900">
              {jpycShort ?? "--"}
            </span>
            <span className="text-xs text-gray-500">
              JPYC
              {jpycFull && (
                <span className="ml-2 text-[10px] text-gray-400">
                  フル：{jpycFull}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* WETH → ETH 変換操作エリア */}
        <div className="pt-4 mt-2 border-t border-dashed border-gray-200 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">
                WETH → ETH
              </div>
              <p className="mt-1 text-xs text-gray-500">
                現在の EOA アドレスから WETH をアンラップして Sepolia ETH に戻します。
                テスト環境専用です。事前に WETH 残高をご確認ください。
              </p>
            </div>
            <div
              className={
                "rounded-full px-3 py-1 text-[11px] font-medium " +
                unwrapStatusColor[unwrapStatus]
              }
            >
              {unwrapStatusLabel[unwrapStatus]}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input
              type="text"
              inputMode="decimal"
              value={unwrapAmount}
              onChange={(e) => setUnwrapAmount(e.target.value)}
              className="text-gray-700 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
              placeholder="例：0.01（空欄の場合は全額アンラップ）"
            />
            <button
              type="button"
              onClick={() => void handleUnwrapWETH()}
              disabled={unwrapStatus === "working"}
              className="inline-flex justify-center items-center gap-2 rounded-lg bg-gray-400 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {unwrapStatus === "working" ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white/60 border-t-transparent rounded-full" />
                  変換中…
                </>
              ) : (
                "WETH → ETH"
              )}
            </button>
          </div>

          {unwrapTxHash && (
            <p className="text-[11px] text-gray-500 break-all">
              送信済みトランザクションハッシュ：{unwrapTxHash}
            </p>
          )}

          {unwrapError && (
            <p className="text-[11px] text-red-500 break-all">
              変換に失敗しました：{unwrapError}
            </p>
          )}
        </div>
      </section>

      <footer className="mt-6 text-xs text-gray-400 leading-relaxed space-y-1">
        <p>
          ⚠️ これは Sepolia テストネット上の ETH／WETH 残高です。開発・デバッグ用途のみで使用し、
          メインネット資産として扱わないでください。
        </p>
        {error && (
          <p className="text-red-500 mt-1 break-all">
            残高の取得中にエラーが発生しました：{error}
          </p>
        )}
      </footer>
    </div>
  );
}
