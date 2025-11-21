import { ArtifactStore } from "@railgun-community/wallet";
import { Buffer } from "buffer";

/**
 * ブラウザ環境用の ArtifactStore：
 * - fs / ファイルシステムは使用しない
 * - メモリ上の Map で現在セッションの回路ファイルをキャッシュする
 * - ページをリロードすると再ダウンロードされる（開発段階としては十分）
 */
export const createArtifactStore = (namespace: string): ArtifactStore => {
  // ここでは明示的に Buffer 型を使用し、ArtifactStore の型定義と揃える
  const memoryStore = new Map<string, string | Buffer>();

  const makeKey = (path: string) => `${namespace}:${path}`;

  // ✅ 型は Promise<string | Buffer | null> である必要がある
  const getFile = async (path: string): Promise<string | Buffer | null> => {
    const key = makeKey(path);
    const value = memoryStore.get(key) ?? null;
    return value;
  };

  // storeFile の SDK 上の定義は：string | Uint8Array<ArrayBufferLike>
  const storeFile = async (
    _dir: string,
    path: string,
    item: string | Uint8Array<ArrayBufferLike>,
  ): Promise<void> => {
    const key = makeKey(path);
    if (typeof item === "string") {
      memoryStore.set(key, item);
    } else {
      // Buffer でラップして、型要件を満たす
      memoryStore.set(key, Buffer.from(item));
    }
  };

  const fileExists = async (path: string): Promise<boolean> => {
    const key = makeKey(path);
    return memoryStore.has(key);
  };

  return new ArtifactStore(getFile, storeFile, fileExists);
};