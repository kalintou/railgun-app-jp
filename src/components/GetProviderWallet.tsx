// src/components/EoaAddressCard.tsx
import { getProviderWallet } from "@/lib/wallet";
import { CopyButton } from "@/components/CopyButton";

export async function EoaAddressCard() {
  const { wallet } = getProviderWallet();
  const address = await wallet.getAddress();

  return (
    <div className="bg-white shadow-lg rounded-2xl p-8 border border-gray-100">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Railgun Local Dev
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          テスト用ニーモニックから生成された EOA アドレスです。ローカル開発およびテストネット専用です。
        </p>
      </header>

      <section className="space-y-3">
        <div className="text-xs uppercase tracking-wide text-gray-400">
          EOA Address
        </div>

        <div className="flex items-center gap-2">
          <code className="text-sm break-all bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 flex-1">
            {address}
          </code>
          <CopyButton value={address} />
        </div>
      </section>

      <footer className="mt-6 text-xs text-gray-400 leading-relaxed">
        ⚠️ このニーモニックとアドレスはローカル／テストネット環境でのみ使用してください。
        本番の Railgun 連携では、ユーザー自身が作成またはインポートしたウォレットを使用するようにしてください。
      </footer>
    </div>
  );
}
