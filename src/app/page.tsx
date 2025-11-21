// src/app/page.tsx
import { getProviderWallet } from "@/lib/wallet";
import { DevShell } from "@/components/DevShell";

export default async function Home() {
  // テスト用 EOA は引き続きサーバー側で生成する（ニーモニックをフロントエンドのバンドルに含めない）
  const { wallet } = getProviderWallet();
  const address = await wallet.getAddress();

  return <DevShell eoaAddress={address} />;
}
