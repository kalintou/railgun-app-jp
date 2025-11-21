// src/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { DevShell } from "@/components/DevShell";
import { setTestMnemonic } from "@/lib/wallet";

export default function HomePage() {
  const [mnemonic, setMnemonic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // 起動時：前回の値があれば textarea にだけ入れておく（確定はユーザ操作）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("railgun-demo-mnemonic");
    if (saved) {
      setMnemonic(saved);
    }
  }, []);

  const handleConfirm = () => {
    const trimmed = mnemonic.trim();
    if (!trimmed) {
      setError("MNEMONIC を入力してください。");
      return;
    }

    try {
      // ✅ ここで今回のセッションに使う MNEMONIC をセット
      setTestMnemonic(trimmed);

      // お好みで：次回起動時のために保存（消したければこの行を消す）
      if (typeof window !== "undefined") {
        window.localStorage.setItem("railgun-demo-mnemonic", trimmed);
      }

      setError(null);
      setConfirmed(true); // ✅ ここで Step0 画面とは完全にお別れ
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // ✅ MNEMONIC 未確定の間は Step0 だけ表示
  if (!confirmed) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-xl space-y-4">
          <section className="bg-white border border-gray-100 shadow-sm rounded-2xl px-4 py-3 space-y-2">
            <h1 className="text-sm font-semibold text-gray-900">
              Step 0. テスト用 MNEMONIC を入力
            </h1>
            <p className="text-xs text-gray-500 leading-relaxed">
              このデモで使用する Sepolia テストネット用のニーモニックを入力してください。
              <br />
              入力内容はブラウザの localStorage にのみ保存されます。
            </p>

            <textarea
              className="mt-2 w-full text-xs rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 resize-none text-gray-500"
              rows={3}
              placeholder="例: test test test test test test test test test test test junk (必ずテスト用の MNEMONIC を使用してください)"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
            />

            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={handleConfirm}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-xl bg-gray-400 text-white hover:bg-gray-700 transition"
              >
                この MNEMONIC を使う
              </button>

              {mnemonic.trim() && (
                <span className="text-[11px] text-gray-400">
                  この値で EOA / RAILGUN がロードされます
                </span>
              )}
            </div>

            {error && (
              <p className="mt-1 text-[11px] text-red-500">
                {error}
              </p>
            )}
          </section>
        </div>
      </main>
    );
  }

  // ✅ ここから先は Step0 は一切レンダーされない
  return <DevShell />;
}
