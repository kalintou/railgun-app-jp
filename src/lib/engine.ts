import { startRailgunEngine } from "@railgun-community/wallet";
import type { POIList } from "@railgun-community/shared-models";
import { createWebDatabase } from "./database";
import { createArtifactStore } from "./artifact-storage";
import { setLoggers } from "@railgun-community/wallet";
import { setupGroth16 } from "./groth16"; // 👈 追加

let engineStarted = false;

/**
 * ブラウザで RAILGUN エンジンを初期化して起動する。
 * 使用するもの:
 *  - Web DB: createWebDatabase（IndexedDB + level-js）
 *  - ブラウザ用 ArtifactStore: IndexedDB に artifacts を永続化
 */
export const initializeBrowserRailgunEngine = async (): Promise<void> => {
  if (engineStarted) {
    // 二重に初期化しないようにする
    console.log("Railgun engine already started.");
    return;
  }

  const walletSource = "railgun"; // 16文字以内・小文字。プライベート履歴内に表示される

  // LevelDOWN 互換 DB：ブラウザでは level-js（IndexedDB）を使用
  const db = createWebDatabase("railgun-engine-db");

  const shouldDebug = true;

  // artifacts の永続化（大きなファイル用）
  const artifactStore = createArtifactStore("railgunartifacts");

  // ブラウザでは WASM artifacts を使用
  const useNativeArtifacts = false;

  // merkle tree / 残高スキャンをスキップするか（ここでは shield-only モードは有効にしない）
  const skipMerkletreeScans = false;

  // デフォルトのテスト PPOI ノード（公式サンプルの URL）
  const poiNodeURLs: string[] = [
    "https://ppoi-agg.horsewithsixlegs.xyz",
  ];

  const customPOILists: POIList[] = [];

  const verboseScanLogging = true;

  await startRailgunEngine(
    walletSource,
    db,
    shouldDebug,
    artifactStore,
    useNativeArtifacts,
    skipMerkletreeScans,
    poiNodeURLs,
    customPOILists,
    verboseScanLogging,
  );

  await setupGroth16();

  engineStarted = true;
  console.log("RAILGUN engine started in browser.");
};