import { getRandomBytes } from "@railgun-community/wallet";
import { hashPasswordString } from "./hash-service";

// メモリ上の現在の encryptionKey（ディスクには書き込まない）
let currentEncryptionKey: string | null = null;

// localStorage の key にプレフィックスを付けて、衝突を避ける
const STORAGE_PREFIX = "railgun-demo-enc-";

const storageKey = (name: string) => `${STORAGE_PREFIX}${name}`;

const ensureStorageAvailable = () => {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    throw new Error("localStorage is not available in this environment.");
  }
};

/**
 * ブラウザの localStorage に JSON データを保存する
 */
export const storeData = async (name: string, data: any): Promise<void> => {
  ensureStorageAvailable();
  localStorage.setItem(storageKey(name), JSON.stringify({ data }));
};

/**
 * localStorage から JSON データを読み出す
 */
export const getData = async (name: string): Promise<any> => {
  ensureStorageAvailable();
  const raw = localStorage.getItem(storageKey(name));
  if (!raw) {
    throw new Error(`No stored data for key: ${name}`);
  }
  return JSON.parse(raw).data;
};

/**
 * すでにパスワードが設定されているかどうか
 * （ローカルに hash と salt が保存されているか）を確認する
 */
export const hasStoredPassword = async (): Promise<boolean> => {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return false;
  }
  const hasHash = localStorage.getItem(storageKey("hashPasswordStored"));
  const hasSalt = localStorage.getItem(storageKey("salt"));
  return !!hasHash && !!hasSalt;
};

/**
 * 初回のパスワード設定:
 * 1. salt をランダム生成
 * 2. (password, salt, 100000) から encryptionKey を導出
 * 3. (password, salt, 1000000) から「保存用パスワードハッシュ」を導出
 * 4. salt と hash を localStorage に保存
 * 5. encryptionKey をメモリ上の変数 currentEncryptionKey に保持
 * docs の setEncryptionKeyFromPassword のサンプルに対応。
 */
export const setEncryptionKeyFromPassword = async (
  password: string
): Promise<string> => {
  const salt = getRandomBytes(16); // ランダムな salt（SDK 提供）

  const [encryptionKey, hashPasswordStored] = await Promise.all([
    hashPasswordString({ secret: password, salt, iterations: 100000 }),
    hashPasswordString({ secret: password, salt, iterations: 1000000 }),
  ]);

  await Promise.all([
    storeData("hashPasswordStored", hashPasswordStored),
    storeData("salt", salt),
  ]);

  currentEncryptionKey = encryptionKey as unknown as string;
  return encryptionKey as unknown as string;
};

/**
 * 以後のログイン時:
 * 1. 保存されている hash と salt を取り出す
 * 2. 入力されたパスワード + salt で hash を再計算（1000000 回）
 * 3. hash が一致するか比較し、一致しない場合は「パスワードエラー」を投げる
 * 4. 同時に 100000 回の反復で encryptionKey を計算し、メモリ上に保持する
 * docs の getEncryptionKeyFromPassword のサンプルに対応。
 */
export const getEncryptionKeyFromPassword = async (
  password: string
): Promise<string> => {
  const [storedPasswordHash, storedSalt] = await Promise.all([
    getData("hashPasswordStored"),
    getData("salt"),
  ]);

  const [encryptionKey, hashPassword] = await Promise.all([
    hashPasswordString({
      secret: password,
      salt: storedSalt,
      iterations: 100000,
    }),
    hashPasswordString({
      secret: password,
      salt: storedSalt,
      iterations: 1000000,
    }),
  ]);

  if (storedPasswordHash !== hashPassword) {
    throw new Error("パスワードが正しくありません。");
  }

  currentEncryptionKey = encryptionKey as unknown as string;
  return encryptionKey as unknown as string;
};

/**
 * 後続の他モジュール（RAILGUN ウォレットの作成 / 読み込み）が、
 * 現在メモリ上にある encryptionKey を取得しやすくするためのヘルパー。
 * 注意: この値はメモリのみに存在し、永続化されない。
 */
export const getCurrentEncryptionKey = (): string | null => currentEncryptionKey;

/**
 * 開発・デバッグ時にローカルのパスワードをリセットする
 * （本番環境ではこの関数を削除してよい）
 */
export const clearStoredPassword = async (): Promise<void> => {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(storageKey("hashPasswordStored"));
  localStorage.removeItem(storageKey("salt"));
  currentEncryptionKey = null;
};
