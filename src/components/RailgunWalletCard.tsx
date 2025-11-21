"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "./CopyButton";

type WalletStatus = "idle" | "working" | "ready" | "error";

export function RailgunWalletCard() {
  const [walletStatus, setWalletStatus] = useState<WalletStatus>("idle");
  const [walletId, setWalletId] = useState<string | null>(null);
  const [railgunAddress, setRailgunAddress] = useState<string | null>(null);
  const [hasStoredId, setHasStoredId] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Viewing Key 関連の状態
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  const [viewingKeyVisible, setViewingKeyVisible] = useState(false);
  const [viewingKeyWorking, setViewingKeyWorking] = useState(false);
  const [viewingKeyError, setViewingKeyError] = useState<string | null>(null);

  // ローカルに既に walletId が保存されているか確認
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { getStoredWalletID } = await import(
          "@/lib/wallet-browser"
        );
        const id = getStoredWalletID();
        if (!mounted) return;
        if (id) {
          setHasStoredId(true);
          setWalletId(id);
        }
      } catch (e) {
        console.error("ローカルの wallet ID の確認に失敗しました:", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleCreateOrLoad = async () => {
    setWalletStatus("working");
    setError(null);

    try {
      const { createOrLoadRailgunWallet } = await import(
        "@/lib/wallet-browser"
      );
      const info = await createOrLoadRailgunWallet();

      setWalletId(info.id);
      // 0zk アドレスフィールド
      // ts-expect-error: railgunAddress は実際の戻り値の構造に含まれている
      setRailgunAddress((info as any).railgunAddress ?? null);

      setWalletStatus("ready");
      setHasStoredId(true);
    } catch (e) {
      console.error(e);
      setWalletStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleResetWallet = async () => {
    setWalletStatus("working");
    setError(null);
    try {
      const { clearStoredWalletID } = await import(
        "@/lib/wallet-browser"
      );
      await clearStoredWalletID();
      setWalletId(null);
      setRailgunAddress(null);
      setHasStoredId(false);
      setWalletStatus("idle");
      setViewingKey(null);
      setViewingKeyVisible(false);
    } catch (e) {
      console.error(e);
      setWalletStatus("error");
      setError("wallet ID のリセットに失敗しました。コンソールを確認してください。");
    }
  };

  const handleExportViewingKey = async () => {
    setViewingKeyWorking(true);
    setViewingKeyError(null);

    try {
      const { getShareableViewingKeyForCurrentWallet } = await import(
        "@/lib/wallet-browser"
      );
      const vk = await getShareableViewingKeyForCurrentWallet();
      setViewingKey(vk);
      setViewingKeyVisible(true);
    } catch (e) {
      console.error(e);
      setViewingKeyError(
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setViewingKeyWorking(false);
    }
  };

  const statusTextMap: Record<WalletStatus, string> = {
    idle: hasStoredId ? "ウォレットを読み込めます" : "まだウォレットが作成されていません",
    working: "処理中…",
    ready: "ウォレットの準備ができました",
    error: "エラーが発生しました",
  };

  const statusColorMap: Record<WalletStatus, string> = {
    idle: "text-gray-500 bg-gray-50",
    working: "text-amber-700 bg-amber-50",
    ready: "text-emerald-700 bg-emerald-50",
    error: "text-red-700 bg-red-50",
  };

  return (
    <section className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            RAILGUN プライベートウォレット（0zk アドレス）
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            現在の暗号鍵（Encryption Key）とニーモニックを使ってローカルで
            RAILGUN ウォレットを作成／読み込みし、対応する 0zk アドレスと
            Viewing Key を表示します。
          </p>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-xs font-medium ${statusColorMap[walletStatus]}`}
        >
          {statusTextMap[walletStatus]}
        </div>
      </div>

      {/* ウォレット作成／読み込み + リセットボタン */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            onClick={handleCreateOrLoad}
            disabled={walletStatus === "working"}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium border border-gray-200 bg-gray-900 text-white disabled:opacity-60 disabled:cursor-not-allowed hover:bg-gray-800 transition"
          >
            {hasStoredId
              ? walletStatus === "working"
                ? "読み込み中…"
                : "ウォレットを読み込み／更新"
              : walletStatus === "working"
                ? "作成中…"
                : "RAILGUN ウォレットを作成"}
          </button>

          <button
            type="button"
            onClick={handleResetWallet}
            disabled={walletStatus === "working"}
            className="inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-[11px] font-medium border border-gray-100 text-gray-400 hover:border-red-200 hover:text-red-500 transition"
          >
            ローカル wallet ID をリセット（開発用）
          </button>
        </div>

        {walletId && (
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-gray-400">
              Wallet ID
            </div>
            <code className="text-[11px] break-all bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700 block">
              {walletId}
            </code>
          </div>
        )}

        {railgunAddress && (
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-gray-400">
              0zk Address
            </div>
            <div className="flex items-center gap-2">
              <code className="text-sm break-all bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 flex-1">
                {railgunAddress}
              </code>
              <CopyButton value={railgunAddress} />
            </div>
          </div>
        )}

        {!railgunAddress && (
          <p className="text-xs text-gray-400">
            ヒント：まず上のカードで
            <span className="font-medium text-gray-500">
              エンジンを起動し、Provider に接続し、Encryption Key を解除
            </span>
            してから、「RAILGUN ウォレットを作成／読み込み」をクリックしてください。
          </p>
        )}

        {error && (
          <p className="mt-2 text-xs text-red-500 break-all">
            エラー：{error}
          </p>
        )}
      </div>

      {/* 区切り線 */}
      <hr className="my-5 border-gray-100" />

      {/* Viewing Key エクスポートエリア */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              Viewing Key（閲覧専用ウォレット）
            </h3>
            <p className="mt-1 text-[11px] text-gray-500">
              Viewing Key は View-Only Wallet（閲覧専用ウォレット）にインポートでき、
              残高とトランザクション履歴のみ閲覧できますが、
              資金を使用することはできません。
              ただし
              <strong className="font-semibold">
                一度共有すると取り消すことはできません
              </strong>
              。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportViewingKey}
            disabled={viewingKeyWorking || !walletId}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium border border-gray-200 bg-white text-gray-900 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-gray-50 transition"
          >
            {viewingKeyWorking
              ? "エクスポート中…"
              : viewingKey
                ? "Viewing Key を再エクスポート"
                : "Viewing Key をエクスポート"}
          </button>

          {viewingKey && (
            <button
              type="button"
              onClick={() => setViewingKeyVisible((v) => !v)}
              className="inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-[11px] font-medium border border-gray-100 text-gray-500 hover:border-gray-200 hover:text-gray-700 transition"
            >
              {viewingKeyVisible ? "Viewing Key を隠す" : "Viewing Key を表示"}
            </button>
          )}

          {viewingKey && <CopyButton value={viewingKey} />}
        </div>

        {viewingKey && viewingKeyVisible && (
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-gray-400">
              Shareable Viewing Key
            </div>
            <code className="text-xs break-all bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 block">
              {viewingKey}
            </code>
          </div>
        )}

        {!walletId && (
          <p className="text-[11px] text-gray-400">
            まず RAILGUN ウォレットを作成／読み込みしてから、Viewing Key をエクスポートしてください。
          </p>
        )}

        {viewingKeyError && (
          <p className="mt-2 text-xs text-red-500 break-all">
            Viewing Key エラー：{viewingKeyError}
          </p>
        )}
      </div>
    </section>
  );
}
