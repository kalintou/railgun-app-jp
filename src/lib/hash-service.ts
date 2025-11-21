import { pbkdf2 } from "@railgun-community/wallet";
import type { Pbkdf2Response } from "@railgun-community/shared-models";

/**
 * PBKDF2 のパラメータ
 */
type HashPasswordStringParams = {
  secret: string;
  salt: any; // getRandomBytes が返す型。SDK と同じ型を維持するため any にしている。
  iterations: number;
};

/**
 * PBKDF2 を使用してパスワードに KDF を適用する。
 * docs に記載されている hashPasswordString の例に対応。
 */
export const hashPasswordString = async ({
  secret,
  salt,
  iterations,
}: HashPasswordStringParams): Promise<Pbkdf2Response> => {
  return pbkdf2(secret, salt, iterations);
};
