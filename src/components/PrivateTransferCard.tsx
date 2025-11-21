"use client";

import { useState } from "react";
import { TEST_TOKEN, TEST_JPYC } from "@/lib/constants";

type TransferStatus = "idle" | "running" | "success" | "error";
type TokenChoice = "WETH" | "JPYC";

export function PrivateTransferCard() {
  const [senderRailgunAddress, setSenderRailgunAddress] =
    useState<string | null>(null);
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [amount, setAmount] = useState<string>("0.01");
  const [memo, setMemo] = useState<string>("");

  const [status, setStatus] = useState<TransferStatus>("idle");
  const [proofProgress, setProofProgress] = useState<number | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 👉 追加：現在のプライベート送金に使用するトークン
  const [selectedToken, setSelectedToken] = useState<TokenChoice>("WETH");
  const [loadingWallet, setLoadingWallet] = useState(false);

  const currentERC20Address =
    selectedToken === "WETH" ? TEST_TOKEN : TEST_JPYC;

  const statusLabel: Record<TransferStatus, string> = {
    idle: "待機中",
    running: "実行中…",
    success: "成功",
    error: "エラー発生",
  };

  const statusColor: Record<TransferStatus, string> = {
    idle: "text-gray-500 bg-gray-50",
    running: "text-amber-700 bg-amber-50",
    success: "text-emerald-700 bg-emerald-50",
    error: "text-red-700 bg-red-50",
  };

  const handleLoadWallet = async () => {
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
          "0zk アドレスを取得できません。先に Wallet カードでウォレットを作成／読み込みしてください。",
        );
      }
      setSenderRailgunAddress(addr);
      // デフォルトで受取アドレスにも自分を入れておく（自己送金テスト用）
      if (!recipientAddress) {
        setRecipientAddress(addr);
      }
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

  const handleUseSelfRecipient = () => {
    if (!senderRailgunAddress) {
      setError("まず現在の RAILGUN ウォレットアドレスを読み込んでください。");
      return;
    }
    setRecipientAddress(senderRailgunAddress);
  };

  const handleTransfer = async () => {
    setStatus("running");
    setError(null);
    setTxHash(null);
    setProofProgress(null);

    try {
      if (!recipientAddress.trim()) {
        throw new Error("受取側の 0zk アドレスを入力してください。");
      }
      if (!amount.trim()) {
        throw new Error("送金額を入力してください。");
      }

      const { privateTransferERC20FromCurrentWallet } = await import(
        "@/lib/transfer/private-transfer-erc20"
      );

      const tokenAddress =
        selectedToken === "WETH" ? TEST_TOKEN : TEST_JPYC;

      const { txHash } = await privateTransferERC20FromCurrentWallet({
        recipientRailgunAddress: recipientAddress.trim(),
        humanAmount: amount.trim(),
        memoText: memo.trim() || undefined,
        tokenAddress,
        onProofProgress: (p: number) => {
          // 公式デモでは progress は 0〜1 なので、そのまま 0〜100 に変換しておく
          const v = p <= 1 ? p * 100 : p;
          const clamped = Math.max(0, Math.min(100, v));
          setProofProgress(clamped);
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
          : "プライベート送金に失敗しました。コンソールログを確認してください。",
      );
    }
  };

  return (
    <section className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            プライベート ERC-20 送金（RAILGUN → RAILGUN）
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            現在の RAILGUN 0zk プライベート残高から{" "}
            <span className="font-semibold">
              {selectedToken}（ERC-20）
            </span>{" "}
            を別の RAILGUN ウォレットアドレスへ送金します。トランザクションと
            Memo テキストは、いずれも暗号化された状態でチェーン上に保存されます。
          </p>
        </div>

        <div className="space-y-1 text-right">
          {/* ERC-20 トークン切り替え */}
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

        <div
          className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor[status]}`}
        >
          {statusLabel[status]}
        </div>
      </div>

      <div className="space-y-4">
        {/* 現在の送信元ウォレット 0zk アドレス */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="uppercase tracking-wide text-gray-400">
              現在の送信元ウォレット（0zk アドレス）
            </span>
            <button
              type="button"
              onClick={handleLoadWallet}
              disabled={loadingWallet}
              className="text-[11px] font-medium text-gray-500 hover:text-gray-800"
            >
              {loadingWallet ? "読み込み中…" : "現在のユーザーから読み込む"}
            </button>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-700 font-mono break-all min-h-[36px] flex items-center">
            {senderRailgunAddress ??
              "まだ読み込まれていません。先に RAILGUN ウォレットを作成／読み込みしてください。"}
          </div>
        </div>

        {/* 受取側 0zk アドレス */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="uppercase tracking-wide text-gray-400">
              受取側 RAILGUN 0zk アドレス
            </span>
            <button
              type="button"
              onClick={handleUseSelfRecipient}
              className="text-[11px] font-medium text-gray-500 hover:text-gray-800"
            >
              上のアドレスを使用（自己送金テスト）
            </button>
          </div>
          <input
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="0zk 受取アドレス（例：rail1q...）"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 font-mono"
          />
        </div>

        {/* Token + 金額 */}
        <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_minmax(0,1fr)] gap-3 items-end">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-gray-400">
              {selectedToken} Token コントラクトアドレス
            </span>
            <div className="rounded-xl border border-gray-200 bg-gray-50 text-[11px] text-gray-700 font-mono break-all px-3 py-2">
              {currentERC20Address}
            </div>

            <p className="text-[10px] text-gray-400">
              このデモでは TEST_TOKEN（WETH）をプライベート送金用トークンとして使用していますが、
              今後はマルチトークン対応に拡張できます。
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-gray-400">
              送金額（{selectedToken}）
            </span>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="例）0.01"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
            />
            <p className="text-[10px] text-gray-400">
              金額は Token の decimals に基づいて自動的に最小単位へ変換されます。
              現在のプライベート残高を超える額は送金できません。
            </p>
          </div>
        </div>

        {/* Memo テキスト */}
        <div className="space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-gray-400">
            Memo（任意／暗号化されてオンチェーン保存）
          </span>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            placeholder="相手へのひとことメモを入力できます。絵文字も可。暗号化されてチェーン上に保存されます。"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
          />
          <p className="text-[10px] text-gray-400">
            Memo に長さの制限はありませんが、長くなるほど（暗号化データが増えるため）gas コストも高くなります。
          </p>
        </div>

        {/* 操作ボタン */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleTransfer}
            disabled={status === "running"}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium border border-gray-200 bg-gray-900 text-white disabled:opacity-60 disabled:cursor-not-allowed hover:bg-gray-800 transition"
          >
            {status === "running" ? "プライベート送金を実行中…" : "プライベート送金を実行"}
          </button>
        </div>

        {/* 証明生成の進捗 */}
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
              証明生成は、低スペックなデバイスでは時間がかかることがあります（正常な挙動です）。
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
              これは公開チェーン上のトランザクションハッシュです。
              対応するテストネットのブロックエクスプローラーで確認できます。
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
            プライベート送金が成功したら、「プライベート残高同期」カードで手動更新を行い、
            送信側／受信側のプライベート残高における TEST_TOKEN の変化を確認してみてください。
          </p>
        )}
      </div>
    </section>
  );
}
