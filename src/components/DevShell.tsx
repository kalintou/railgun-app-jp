"use client";

import { useState } from "react";
import { EoaAddressCard } from "@/components/EoaAddressCard";
import { EngineControlCard } from "@/components/EngineControlCard";
import { EncryptionKeyCard } from "@/components/EncryptionKeyCard";
import { RailgunWalletCard } from "@/components/RailgunWalletCard";
import { BalanceSyncCard } from "@/components/BalanceSyncCard";
import { ShieldERC20Card } from "@/components/ShieldERC20Card";
import { PrivateTransferCard } from "@/components/PrivateTransferCard";
import { UnshieldERC20Card } from "@/components/UnshieldERC20Card";

type TabKey =
    | "eoa"
    | "engine"
    | "encryption"
    | "wallet"
    | "balance"
    | "shield"
    | "private-transfer"
    | "unshield";

const TABS: { key: TabKey; label: string; sub?: string }[] = [
    { key: "eoa", label: "EOA", sub: "公開アドレス" },
    { key: "engine", label: "Engine", sub: "プライバシーエンジン" },
    { key: "encryption", label: "Encryption", sub: "パスワード / Key" },
    { key: "wallet", label: "Wallet", sub: "RAILGUN 0zk" },
    { key: "balance", label: "Balances", sub: "プライベート残高" },
    { key: "shield", label: "Shield", sub: "EOA → 0zk" },
    { key: "private-transfer", label: "Private Tx", sub: "0zk → 0zk" },
    { key: "unshield", label: "Unshield", sub: "0zk → 0x" },
];

type DevShellProps = {
    eoaAddress: string;
};

export function DevShell({ eoaAddress }: DevShellProps) {
    const [currentTab, setCurrentTab] = useState<TabKey>("eoa");

    const tabButtonClass = (active: boolean) =>
        `flex flex-col px-3 py-1.5 rounded-xl text-xs transition ${
            active
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
        }`;

    return (
        <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="w-full max-w-xl space-y-4">
                {/* 上部ナビ（buttonに変更、ルーティングしないのでページリロードなし） */}
                <nav className="bg-white border border-gray-100 shadow-sm rounded-2xl px-4 py-3 flex flex-wrap items-center gap-2">
                    {TABS.map((tab) => {
                        const isActive = tab.key === currentTab;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setCurrentTab(tab.key)}
                                className={tabButtonClass(isActive)}
                            >
                                <span className="font-medium">{tab.label}</span>
                                {tab.sub && (
                                    <span
                                        className={
                                            isActive
                                                ? "text-[10px] text-gray-200"
                                                : "text-[10px] text-gray-400"
                                        }
                                    >
                                        {tab.sub}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* 各カードは常にマウントしたまま、hidden/block で可視切替 */}
                <div className={currentTab === "eoa" ? "block" : "hidden"}>
                    <EoaAddressCard />
                </div>

                <div className={currentTab === "engine" ? "block" : "hidden"}>
                    <EngineControlCard />
                </div>

                <div className={currentTab === "encryption" ? "block" : "hidden"}>
                    <EncryptionKeyCard />
                </div>

                <div className={currentTab === "wallet" ? "block" : "hidden"}>
                    <RailgunWalletCard />
                </div>

                <div className={currentTab === "balance" ? "block" : "hidden"}>
                    <BalanceSyncCard />
                </div>

                <div className={currentTab === "shield" ? "block" : "hidden"}>
                    <ShieldERC20Card />
                </div>

                <div className={currentTab === "private-transfer" ? "block" : "hidden"}>
                    <PrivateTransferCard />
                </div>

                <div className={currentTab === "unshield" ? "block" : "hidden"}>
                    <UnshieldERC20Card />
                </div>
            </div>
        </main>
    );
}
