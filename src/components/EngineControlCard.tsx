"use client";

import { useState } from "react";

type EngineStatus = "idle" | "initializing" | "running" | "error";
type ProviderStatus = "idle" | "connecting" | "connected" | "error";

export function EngineControlCard() {
  const [status, setStatus] = useState<EngineStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const [providerStatus, setProviderStatus] =
    useState<ProviderStatus>("idle");
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerUrl, setProviderUrl] = useState<string>("");

  const handleStart = async () => {
    if (status === "initializing" || status === "running") return;

    setStatus("initializing");
    setError(null);

    try {
      // ✅ 新しい構成に合わせて import パスを変更
      const { initializeBrowserRailgunEngine } = await import(
        "@/lib/engine"
      );
      await initializeBrowserRailgunEngine();
      setStatus("running");
    } catch (e) {
      console.error(e);
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleConnectProvider = async () => {
    if (providerStatus === "connecting" || providerStatus === "connected") {
      return;
    }

    // 先に Engine を起動する
    if (status !== "running") {
      setProviderError("先に RAILGUN エンジンを起動してください。");
      setProviderStatus("error");
      return;
    }

    setProviderStatus("connecting");
    setProviderError(null);

    try {
      // ✅ 新しいパスに合わせる
      const { loadEngineProvider } = await import(
        "@/lib/engine-providers"
      );

      // 入力が空なら loadEngineProvider が内部で TEST_RPC_URL を使用
      const urlToUse = providerUrl.trim();
      if (urlToUse) {
        await loadEngineProvider(urlToUse);
      } else {
        await loadEngineProvider(); // デフォルト TEST_RPC_URL
      }

      setProviderStatus("connected");
    } catch (e) {
      console.error(e);
      setProviderStatus("error");
      setProviderError(e instanceof Error ? e.message : String(e));
    }
  };

  const statusTextMap: Record<EngineStatus, string> = {
    idle: "未起動",
    initializing: "初期化中…",
    running: "起動済み",
    error: "起動失敗",
  };

  const statusColorMap: Record<EngineStatus, string> = {
    idle: "text-gray-500 bg-gray-50",
    initializing: "text-amber-700 bg-amber-50",
    running: "text-emerald-700 bg-emerald-50",
    error: "text-red-700 bg-red-50",
  };

  const providerStatusText: Record<ProviderStatus, string> = {
    idle: "未接続",
    connecting: "接続中…",
    connected: "接続済み",
    error: "接続失敗",
  };

  const providerStatusColor: Record<ProviderStatus, string> = {
    idle: "text-gray-500 bg-gray-50",
    connecting: "text-amber-700 bg-amber-50",
    connected: "text-emerald-700 bg-emerald-50",
    error: "text-red-700 bg-red-50",
  };

  return (
    <section className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
      {/* エンジン部分 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            RAILGUN プライバシーエンジン
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            ブラウザ上で Web データベースとローカル Artifact ストレージを使用して RAILGUN エンジンを起動します。
          </p>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-xs font-medium ${statusColorMap[status]}`}
        >
          {statusTextMap[status]}
        </div>
      </div>

      <button
        onClick={handleStart}
        disabled={status === "initializing" || status === "running"}
        className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium border border-gray-200 bg-gray-900 text-white disabled:opacity-60 disabled:cursor-not-allowed hover:bg-gray-800 transition"
      >
        {status === "idle" && "RAILGUN エンジンを起動"}
        {status === "initializing" && "初期化中…"}
        {status === "running" && "エンジン起動済み"}
        {status === "error" && "再試行"}
      </button>

      {error && (
        <p className="mt-3 text-xs text-red-500 break-all">
          エラー：{error}
        </p>
      )}

      {/* 区切り線 */}
      <hr className="my-5 border-gray-100" />

      {/* Provider 部分 */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-gray-900">
            Engine Network Provider
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            RAILGUN エンジンのための RPC を読み込み、Merkletree 同期とプライベート残高更新を行います。
          </p>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-xs font-medium ${providerStatusColor[providerStatus]}`}
        >
          {providerStatusText[providerStatus]}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={providerUrl}
          onChange={(e) => setProviderUrl(e.target.value)}
          placeholder="空欄の場合はデフォルト TEST_RPC_URL を使用"
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
        />
        <button
          onClick={handleConnectProvider}
          disabled={providerStatus === "connecting"}
          className="mt-1 sm:mt-0 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium border border-gray-200 bg-white text-gray-900 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-gray-50 transition"
        >
          {providerStatus === "idle" && "Provider に接続"}
          {providerStatus === "connecting" && "接続中…"}
          {providerStatus === "connected" && "接続済み"}
          {providerStatus === "error" && "再接続"}
        </button>
      </div>

      {providerError && (
        <p className="mt-3 text-xs text-red-500 break-all">
          Provider エラー：{providerError}
        </p>
      )}
    </section>
  );
}
