import LevelDB from "level-js";

/**
 * ブラウザ環境で LevelDOWN 互換のデータベース（IndexedDB ベース）を作成する。
 * クライアント側のみで呼び出し、サーバー側には indexedDB は存在しない。
 */
export const createWebDatabase = (dbLocationPath: string) => {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }

  // 公式サンプルと同様に：ブラウザによっては先に databases() を呼ぶとより安定する
  (indexedDB as any).databases?.();

  console.log("Creating web database at path:", dbLocationPath);
  const db = new LevelDB(dbLocationPath);
  return db;
};
