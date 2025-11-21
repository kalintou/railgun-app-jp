import { getProver, SnarkJSGroth16 } from "@railgun-community/wallet";
import { groth16 } from "snarkjs";

let groth16Setup = false;

/**
 * Railgun が snarkjs の Groth16 実装を使用するよう設定する。
 * ブラウザ / Node どちらでも一度だけ呼び出せばよい。
 */
export const setupGroth16 = async (): Promise<void> => {
  if (groth16Setup) return;

  // @ts-ignore
  getProver().setSnarkJSGroth16(groth16 as SnarkJSGroth16);
  groth16Setup = true;
};

/** 他の場所でこの名前を固定して使っている場合のために、別名として残してもよい。 */
export const setupNodeGroth16 = setupGroth16;