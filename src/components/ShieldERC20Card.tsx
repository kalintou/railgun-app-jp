"use client";

import { useState } from "react";
import { TEST_TOKEN, TEST_JPYC } from "@/lib/constants";

type ShieldStatus = "idle" | "working" | "success" | "error";
type TokenMode = "weth-erc20" | "eth-base";
type TokenChoice = "WETH" | "JPYC";

export function ShieldERC20Card() {
  const [railgunAddress, setRailgunAddress] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("0.01");
  const [status, setStatus] = useState<ShieldStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const [tokenMode, setTokenMode] = useState<TokenMode>("weth-erc20");

  // 👉 追加：現在選択中の ERC-20 トークン（weth-erc20 モードでのみ有効）
  const [selectedToken, setSelectedToken] = useState<TokenChoice>("WETH");

  const [loadingAddress, setLoadingAddress] = useState(false);
  const currentERC20Address =
    selectedToken === "WETH" ? TEST_TOKEN : TEST_JPYC;

  const statusLabel: Record<ShieldStatus, string> = {
    idle: "待機中",
    working: "実行中…",
    success: "成功",
    error: "エラー発生",
  };

  const statusColor: Record<ShieldStatus, string> = {
    idle: "text-gray-500 bg-gray-50",
    working: "text-amber-700 bg-amber-50",
    success: "text-emerald-700 bg-emerald-50",
    error: "text-red-700 bg-red-50",
  };

  const ensureRailgunAddress = async (): Promise<string> => {
    if (railgunAddress) return railgunAddress;

    setLoadingAddress(true);
    setError(null);
    try {
      const { loadRailgunWalletForCurrentUser } = await import(
        "@/lib/wallet-browser"
      );
      const info = await loadRailgunWalletForCurrentUser();
      // ts-expect-error: railgunAddress は実際の戻り値の構造に含まれている
      const addr = (info as any).railgunAddress as string | undefined;
      if (!addr) {
        throw new Error(
          "RAILGUN Wallet の情報から 0zk アドレスを取得できませんでした。",
        );
      }
      setRailgunAddress(addr);
      return addr;
    } finally {
      setLoadingAddress(false);
    }
  };

  const handleLoadAddress = async () => {
    try {
      await ensureRailgunAddress();
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : "0zk アドレスの読み込みに失敗しました。先にウォレットを作成／読み込みしてください。",
      );
    }
  };

  const handleShield = async () => {
    setStatus("working");
    setError(null);
    setTxHash(null);

    try {
      const railgunAddr = await ensureRailgunAddress();

      if (tokenMode === "weth-erc20") {
        // 選択中の ERC-20（WETH / JPYC）を直接 shield
        const { shieldERC20FromTestWallet } = await import(
          "@/lib/shield/shield-erc20"
        );

        const tokenAddress =
          selectedToken === "WETH" ? TEST_TOKEN : TEST_JPYC;

        const { txHash } = await shieldERC20FromTestWallet({
          railgunWalletAddress: railgunAddr,
          humanAmount: amount.trim(),
          tokenAddress,
        });

        setTxHash(txHash);
        setStatus("success");
      } else {
        // Base token（ETH）として shield：ETH -> wETH -> shield
        const { shieldBaseTokenFromTestWallet } = await import(
          "@/lib/shield/shield-base-token"
        );

        const { txHash } = await shieldBaseTokenFromTestWallet(
          railgunAddr,
          amount.trim(),
        );

        setTxHash(txHash);
        setStatus("success");
      }
    } catch (e) {
      console.error(e);
      setStatus("error");
      setError(
        e instanceof Error
          ? e.message
          : "Shield トランザクションに失敗しました。コンソールログを確認してください。",
      );
    }
  };

  const renderTokenModeTabs = () => (
    <div className="inline-flex rounded-full bg-gray-50 p-1 text-[11px] font-medium text-gray-500">
      <button
        type="button"
        onClick={() => setTokenMode("weth-erc20")}
        className={`px-3 py-1 rounded-full transition ${
          tokenMode === "weth-erc20"
            ? "bg-white shadow-sm text-gray-900"
            : "text-gray-500 hover:text-gray-800"
        }`}
      >
        WETH（ERC-20）
      </button>
      <button
        type="button"
        onClick={() => setTokenMode("eth-base")}
        className={`px-3 py-1 rounded-full transition ${
          tokenMode === "eth-base"
            ? "bg-white shadow-sm text-gray-900"
            : "text-gray-500 hover:text-gray-800"
        }`}
      >
        ETH（Base）
      </button>
    </div>
  );

  const renderERC20TokenTabs = () => (
    <div className="inline-flex rounded-full bg-gray-50 p-1 text-[11px] font-medium text-gray-500">
      <button
        type="button"
        onClick={() => setSelectedToken("WETH")}
        className={`px-3 py-1 rounded-full transition ${
          selectedToken === "WETH"
            ? "bg-white shadow-sm text-gray-900"
            : "text-gray-500 hover:text-gray-800"
        }`}
      >
        WETH
      </button>
      <button
        type="button"
        onClick={() => setSelectedToken("JPYC")}
        className={`px-3 py-1 rounded-full transition ${
          selectedToken === "JPYC"
            ? "bg-white shadow-sm text-gray-900"
            : "text-gray-500 hover:text-gray-800"
        }`}
      >
        JPYC
      </button>
    </div>
  );

  return (
    <section className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            トークンを 0zk に Shield（WETH / ETH）
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            現在のテスト EOA から、資産を RAILGUN 0zk アドレスへ shield します：
            <br />
            ・<span className="font-semibold">WETH（ERC-20）</span>
            ：既に保有している WETH をそのままプライベートプールに shield；
            <br />
            ・<span className="font-semibold">ETH（Base）</span>
            ：Relay Adapt によって ETH を自動で WETH に wrap してから shield。
          </p>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor[status]}`}
        >
          {statusLabel[status]}
        </div>
      </div>

      <div className="space-y-4">
        {/* モード切り替え */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-gray-400">
            Shield モード
          </span>
          {renderTokenModeTabs()}
        </div>

        {tokenMode === "weth-erc20" && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-gray-400">
              ERC-20 トークン
            </span>
            {renderERC20TokenTabs()}
          </div>
        )}

        {/* 対象 0zk アドレス */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="uppercase tracking-wide text-gray-400">
              対象 0zk アドレス
            </span>
            <button
              type="button"
              onClick={handleLoadAddress}
              disabled={loadingAddress}
              className="text-[11px] font-medium text-gray-500 hover:text-gray-800"
            >
              {loadingAddress ? "読込中…" : "現在のウォレットアドレスを読み込む"}
            </button>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-700 font-mono break-all min-h-[36px] flex items-center">
            {railgunAddress ??
              "まだ読み込まれていません。先に RAILGUN ウォレットを作成／読み込みしてから、上のボタンをクリックしてください。"}
          </div>
        </div>

        {/* トークン情報 + 金額入力 */}
        <div className="grid ...">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-gray-400">
              {tokenMode === "eth-base"
                ? "Wrapped Token (WETH) Address"
                : selectedToken === "WETH"
                ? "WETH Token Address"
                : "JPYC Token Address"}
            </span>
            <div className="rounded-xl border ...">
              {tokenMode === "eth-base" ? TEST_TOKEN : currentERC20Address}
            </div>
            <p className="text-[10px] text-gray-400">
              {tokenMode === "eth-base"
                ? "ETH モードでは、ここが内部的に使われる WETH コントラクトアドレスです。ユーザーは ETH を用意するだけで構いません。"
                : `現在の ERC-20 トークン: ${selectedToken} (${currentERC20Address})`}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-gray-400">
              Shield 数量（{tokenMode === "eth-base" ? "ETH" : "WETH"}）
            </span>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="例）0.01"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
            />
            <p className="text-[10px] text-gray-400">
              金額はトークンの decimals に基づいて自動的に最小単位へ換算されます。
            </p>
          </div>
        </div>

        {/* 操作ボタン */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleShield}
            disabled={status === "working" || !railgunAddress}
            className="w-full inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {tokenMode === "eth-base"
              ? "Shield ETH（Base Token）"
              : selectedToken === "WETH"
              ? "Shield WETH"
              : "Shield JPYC"}
          </button>
        </div>

        {/* トランザクション結果 */}
        {txHash && (
          <div className="mt-2 space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-emerald-600">
              Tx Hash
            </span>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800 font-mono break-all">
              {txHash}
            </div>
            <p className="text-[10px] text-emerald-700">
              これは公開トランザクションハッシュで、対応するテストネットのブロックエクスプローラーで確認できます。
            </p>
          </div>
        )}

        {error && (
          <p className="mt-2 text-xs text-red-500 break-all">
            エラー：{error}
          </p>
        )}

        {!error && status === "success" && (
          <p className="mt-2 text-[11px] text-gray-500">
            Shield が成功したら、「プライベート残高同期」カードに戻り、
            「手動で一度更新」をクリックするかポーリングを続けて、
            {" "}
            {tokenMode === "eth-base"
              ? "wETH"
              : selectedToken === "WETH"
              ? "WETH"
              : "JPYC"}{" "}
            がプライベート残高に反映されているか確認してみてください。
          </p>
        )}
      </div>
    </section>
  );
}
