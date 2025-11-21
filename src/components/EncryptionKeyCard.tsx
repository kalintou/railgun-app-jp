"use client";

import { useEffect, useState } from "react";

type Mode = "create" | "unlock";

type InitStatus = "loading" | "ready" | "error";

export function EncryptionKeyCard() {
  const [initStatus, setInitStatus] = useState<InitStatus>("loading");
  const [mode, setMode] = useState<Mode>("create");
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [encryptionKeyPreview, setEncryptionKeyPreview] = useState<string | null>(
    null
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { hasStoredPassword } = await import(
          "@/lib/encryption-browser"
        );
        const exists = await hasStoredPassword();
        if (!mounted) return;
        setHasPassword(exists);
        setMode(exists ? "unlock" : "create");
        setInitStatus("ready");
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        setInitStatus("error");
        setError("暗号化モジュールの初期化に失敗しました。コンソールを確認してください。");
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleCreate = async () => {
    if (!password) {
      setError("パスワードを入力してください。");
      return;
    }
    if (password.length < 6) {
      setError("安全のため、パスワードは最低 6 桁を推奨します。");
      return;
    }
    if (confirmPassword && password !== confirmPassword) {
      setError("入力されたパスワードが一致しません。");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { setEncryptionKeyFromPassword } = await import(
        "@/lib/encryption-browser"
      );
      const key = await setEncryptionKeyFromPassword(password);

      // 簡易プレビュー（完全キーは表示しない）
      if (typeof key === "string" && key.length >= 12) {
        setEncryptionKeyPreview(`${key.slice(0, 8)}…${key.slice(-4)}`);
      } else if (typeof key === "string") {
        setEncryptionKeyPreview(key);
      }

      setSuccessMessage("暗号化キーを作成し、パスワードハッシュを保存しました。今後はこのパスワードで復号できます。");
      setHasPassword(true);
      setMode("unlock");
      setPassword("");
      setConfirmPassword("");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlock = async () => {
    if (!password) {
      setError("パスワードを入力してください。");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { getEncryptionKeyFromPassword } = await import(
        "@/lib/encryption-browser"
      );
      const key = await getEncryptionKeyFromPassword(password);

      if (typeof key === "string" && key.length >= 12) {
        setEncryptionKeyPreview(`${key.slice(0, 8)}…${key.slice(-4)}`);
      } else if (typeof key === "string") {
        setEncryptionKeyPreview(key);
      }

      setSuccessMessage("暗号化キーのロックを解除しました。");
      setPassword("");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForDev = async () => {
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const { clearStoredPassword } = await import(
        "@/lib/encryption-browser"
      );
      await clearStoredPassword();
      setHasPassword(false);
      setMode("create");
      setEncryptionKeyPreview(null);
      setSuccessMessage("ローカルに保存されたパスワード情報を削除しました（開発用）。");
    } catch (e) {
      console.error(e);
      setError("リセットに失敗しました。コンソールを確認してください。");
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = initStatus === "loading";

  return (
    <section className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">暗号化パスワード / Encryption Key</h2>
          <p className="mt-1 text-xs text-gray-500">
            PBKDF2 を使用してユーザーのパスワードから 32 バイトの encryptionKey を生成し、
            RAILGUN ウォレットやニーモニックの暗号化に使用します。
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium bg-gray-50 text-gray-600">
            {initStatus === "loading" && "初期化中…"}
            {initStatus === "ready" &&
              (hasPassword ? "パスワード設定済み" : "パスワード未設定")}
            {initStatus === "error" && "初期化失敗"}
          </span>
          {encryptionKeyPreview && (
            <span className="text-[10px] text-gray-400">
              key プレビュー：{encryptionKeyPreview}
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-500">ローカルのパスワード状態を確認中…</p>
      ) : initStatus === "error" ? (
        <p className="text-xs text-red-500">
          初期化に失敗しました。詳細はコンソールをご確認ください。
        </p>
      ) : (
        <>
          {mode === "create" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                初回使用時はパスワードを設定してください。処理内容：
                <br />
                ・パスワード＋ランダムソルトから encryptionKey を生成（100,000 回反復）
                <br />
                ・別途、高反復のパスワードハッシュ（1,000,000 回）を生成して保存
              </p>
              <div className="space-y-2">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="新しいパスワードを入力"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="確認のため再入力（任意・推奨）"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium border border-gray-200 bg-gray-900 text-white disabled:opacity-60 disabled:cursor-not-allowed hover:bg-gray-800 transition"
              >
                {submitting ? "作成中…" : "暗号化キーを作成"}
              </button>
            </div>
          )}

          {mode === "unlock" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                ローカルに保存されたパスワードハッシュを検出しました。パスワードを入力して encryptionKey を解除してください。
              </p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleUnlock}
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium border border-gray-200 bg-white text-gray-900 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                >
                  {submitting ? "検証中…" : "encryptionKey を解除"}
                </button>
                <button
                  type="button"
                  onClick={handleResetForDev}
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-[11px] font-medium border border-gray-100 text-gray-400 hover:border-red-200 hover:text-red-500 transition"
                >
                  ローカルパスワードをリセット（開発用）
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 text-xs text-red-500 break-all">エラー：{error}</p>
          )}
          {successMessage && (
            <p className="mt-3 text-xs text-emerald-600 break-all">
              {successMessage}
            </p>
          )}
        </>
      )}
    </section>
  );
}
