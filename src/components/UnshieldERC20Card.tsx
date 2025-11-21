"use client";

import { useState } from "react";
import { TEST_TOKEN, TEST_JPYC } from "@/lib/constants";

type UnshieldStatus = "idle" | "running" | "success" | "error";
type TokenChoice = "WETH" | "JPYC";

export function UnshieldERC20Card() {
  const [railgunAddress, setRailgunAddress] = useState<string | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<string>("");
  const [amount, setAmount] = useState<string>("0.01");

  const [status, setStatus] = useState<UnshieldStatus>("idle");
  const [proofProgress, setProofProgress] = useState<number | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 👉 追加：現在 unshield するトークン
  const [selectedToken, setSelectedToken] = useState<TokenChoice>("WETH");

  const currentERC20Address =
    selectedToken === "WETH" ? TEST_TOKEN : TEST_JPYC;

  const [loadingWallet, setLoadingWallet] = useState(false);
  const [fillingEOA, setFillingEOA] = useState(false);

  const statusLabel: Record<UnshieldStatus, string> = {
    idle: "待機中",
    running: "実行中…",
    success: "成功",
    error: "エラー発生",
  };

  const statusColor: Record<UnshieldStatus, string> = {
    idle: "text-gray-500 bg-gray-50",
    running: "text-amber-700 bg-amber-50",
    success: "text-emerald-700 bg-emerald-50",
    error: "text-red-700 bg-red-50",
  };

  const handleLoadRailgunAddress = async () => {
    setLoadingWallet(true);
    setError(null);
    try {
      const { loadRailgunWalletForCurrentUser } = await import(
        "@/lib/wallet-browser"
      );
      const info = await loadRailgunWalletForCurrentUser();
      const addr = (info as any).railgunAddress as string | undefined;
      if (!addr) {
        throw new Error(
          "0zk アドレスを読み取れません。先に Wallet カードでウォレットを作成／読み込みしてください。",
        );
      }
      setRailgunAddress(addr);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : "RAILGUN ウォレットの読み込みに失敗しました。コンソールログを確認してください。",
      );
    } finally {
      setLoadingWallet(false);
    }
  };

  const handleUseCurrentEOA = async () => {
    setFillingEOA(true);
    setError(null);
    try {
      const { getProviderWallet } = await import("@/lib/wallet");
      const { wallet } = getProviderWallet();
      // HDNodeWallet には同期的な address フィールドがある
      const addr = wallet.address;
      setDestinationAddress(addr);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : "現在のテスト EOA アドレスの取得に失敗しました。コンソールログを確認してください。",
      );
    } finally {
      setFillingEOA(false);
    }
  };

  const handleUnshield = async () => {
    setStatus("running");
    setError(null);
    setTxHash(null);
    setProofProgress(null);

    try {
      if (!amount.trim()) {
        throw new Error("Unshield する金額を入力してください。");
      }
      if (!destinationAddress.trim()) {
        throw new Error("受取用の公開 0x アドレスを入力してください。");
      }

      const { unshieldERC20FromCurrentWallet } = await import(
        "@/lib/unshield/unshield-erc20"
      );

      const tokenAddress =
        selectedToken === "WETH" ? TEST_TOKEN : TEST_JPYC;

      const { txHash } = await unshieldERC20FromCurrentWallet({
        destinationAddress: destinationAddress.trim(),
        humanAmount: amount.trim(),
        tokenAddress,
        onProofProgress: (p: number) => {
          setProofProgress(p);
        },
      });

      setTxHash(txHash);
      setStatus("success");
    } catch (e) {
      console.error(e);
      setStatus("error");
      setError(
        e instanceof Error
          ? e.message
          : "Unshield に失敗しました。コンソールログを確認してください。",
      );
    }
  };

  return (
    <section className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Unshield ERC-20（0zk → 0x）
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            現在の RAILGUN 0zk プライベート残高から{" "}
            <span className="font-semibold">{selectedToken}</span>
            をアンシールドして、公開 EOA アドレスへ送ります。
          </p>
        </div>

        <div className="space-y-1 text-right">
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor[status]}`}
          >
            {statusLabel[status]}
          </div>

          {/* ERC-20 Token 切り替え */}
          <div className="inline-flex rounded-full bg-gray-50 p-1 text-[11px] font-medium text-gray-500">
            <button
              type="button"
              onClick={() => setSelectedToken("WETH")}
              className={`px-2 py-0.5 rounded-full transition ${
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
              className={`px-2 py-0.5 rounded-full transition ${
                selectedToken === "JPYC"
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              JPYC
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* 現在の 0zk アドレス（表示のみ） */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="uppercase tracking-wide text-gray-400">
              現在の RAILGUN 0zk アドレス
            </span>
            <button
              type="button"
              onClick={handleLoadRailgunAddress}
              disabled={loadingWallet}
              className="text-[11px] font-medium text-gray-500 hover:text-gray-800"
            >
              {loadingWallet ? "読込中…" : "現在のユーザーから読み込む"}
            </button>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-700 font-mono break-all min-h-[36px] flex items-center">
            {railgunAddress ??
              "まだ読み込まれていません。Unshield 実行時は現在ログイン中の RAILGUN ウォレットが自動的に使われます。"}
          </div>
        </div>

        {/* 送信先公開アドレス */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="uppercase tracking-wide text-gray-400">
              送信先の公開アドレス（0x）
            </span>
            <button
              type="button"
              onClick={handleUseCurrentEOA}
              disabled={fillingEOA}
              className="text-[11px] font-medium text-gray-500 hover:text-gray-800"
            >
              {fillingEOA ? "取得中…" : "現在のテスト EOA アドレスを使用"}
            </button>
          </div>
          <input
            type="text"
            value={destinationAddress}
            onChange={(e) => setDestinationAddress(e.target.value)}
            placeholder="0x で始まる公開ウォレットアドレス"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 font-mono"
          />
          <p className="text-[10px] text-gray-400">
            任意の 0x アドレスを入力できます（自分の別ウォレットや取引所の入金アドレスなど）。
          </p>
        </div>

        {/* Token & 金額 */}
        <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_minmax(0,1fr)] gap-3 items-end">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-gray-400">
              {selectedToken} トークンコントラクトアドレス
            </span>
            <div className="rounded-xl border border-gray-200 bg-gray-50 text-[11px] text-gray-700 font-mono break-all px-3 py-2">
              {currentERC20Address}
            </div>

            <p className="text-[10px] text-gray-400">
              現在の 0zk プライベート残高から {selectedToken} をアンシールドして公開アドレスへ送信します。
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-gray-400">
              Unshield 金額（{selectedToken}）
            </span>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="例）0.01"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
            />
            <p className="text-[10px] text-gray-400">
              金額はトークンの decimals に基づいて自動的に最小単位へ変換されます。現在のプライベート残高を超えることはできません。
            </p>
          </div>
        </div>

        {/* 操作ボタン */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleUnshield}
            disabled={status === "running"}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium border border-gray-200 bg-gray-900 text-white disabled:opacity-60 disabled:cursor-not-allowed hover:bg-gray-800 transition"
          >
            {status === "running"
              ? "Unshield 実行中…"
              : "ERC-20 Unshield を実行"}
          </button>
        </div>

        {/* 証明進捗バー */}
        {proofProgress !== null && (
          <div className="mt-2 space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-gray-400">
              証明生成の進捗
            </span>
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-2 rounded-full bg-gray-900 transition-all"
                style={{ width: `${proofProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400">
              Unshield でも zk 証明を生成する必要があるため、性能の低いデバイスでは少し時間がかかる場合があります。
            </p>
          </div>
        )}

        {/* Tx Hash */}
        {txHash && (
          <div className="mt-2 space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-emerald-600">
              Tx Hash
            </span>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800 font-mono break-all">
              {txHash}
            </div>
            <p className="text-[10px] text-emerald-700">
              これはチェーン上の公開トランザクションハッシュで、対応するテストネットのブロックエクスプローラーで確認できます。
            </p>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <p className="mt-2 text-xs text-red-500 break-all">
            エラー：{error}
          </p>
        )}

        {!error && status === "success" && (
          <p className="mt-2 text-[11px] text-gray-500">
            Unshield が成功したら、次のことを確認できます：
            <br />
            ・「プライベート残高」カードで更新して、{selectedToken} のプライベート残高が減っているか確認する。
            <br />
            ・パブリック EOA ウォレットで {selectedToken} の公開残高が増えているか確認する。
          </p>
        )}
      </div>
    </section>
  );
}