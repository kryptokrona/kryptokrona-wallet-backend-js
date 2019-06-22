import { Config } from './Config';
export declare function generateKeyDerivation(transactionPublicKey: string, privateViewKey: string, config: Config): Promise<string>;
export declare function generateKeyImagePrimitive(publicSpendKey: string, privateSpendKey: string, outputIndex: number, derivation: string, config: Config): Promise<[string, string]>;
export declare function generateKeyImage(transactionPublicKey: string, privateViewKey: string, publicSpendKey: string, privateSpendKey: string, transactionIndex: number, config: Config): Promise<[string, string]>;
export declare function underivePublicKey(derivation: string, outputIndex: number, outputKey: string, config: Config): Promise<string>;
