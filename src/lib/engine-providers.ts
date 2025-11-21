import {
  FallbackProviderJsonConfig,
  NETWORK_CONFIG,
  type NetworkName,
} from "@railgun-community/shared-models";
import { loadProvider } from "@railgun-community/wallet";
// ここでは、constants.ts にすでに TEST_NETWORK / TEST_RPC_URL が定義されている前提とする
import { TEST_NETWORK, TEST_RPC_URL } from "@/lib/constants";

/**
 * docs のサンプルに従って、Engine 用のネットワーク provider を設定・読み込む。
 *
 * @param providerUrl - メインの RPC URL。指定がない場合は constants.ts の TEST_RPC_URL を使用。
 */
export const loadEngineProvider = async (providerUrl: string = TEST_RPC_URL) => {
  // FallbackProviderJsonConfig は Engine に以下を伝える：
  // - どのネットワークの chainId を使うか
  // - どの RPC ノードがあるか（複数指定してフォールバックにもできる）
  const providersJSON: FallbackProviderJsonConfig = {
    chainId: NETWORK_CONFIG[TEST_NETWORK as NetworkName].chain.id,
    providers: [
      // 主に、引数として渡された providerUrl を使用
      getProviderInfo(providerUrl),

      // 他にもパブリック RPC があれば、docs の例のようにここに追加できる：
      // {
      //   provider: "https://cloudflare-eth.com/",
      //   priority: 3,
      //   weight: 2,
      //   maxLogsPerBatch: 1,
      // },
      // ...
    ],
  };

  // Engine はこのポーリング間隔でチェーン上のイベントログ（merkletree など）を取得する
  const pollingInterval = 1000 * 60 * 5; // 5 分

  await loadProvider(providersJSON, TEST_NETWORK as NetworkName, pollingInterval);
};

export const getProviderInfo = (providerUrl: string) => {
  return {
    provider: providerUrl,
    priority: 3,
    weight: 2,
    maxLogsPerBatch: 1,
  };
};
