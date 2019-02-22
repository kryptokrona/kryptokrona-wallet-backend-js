export declare function generateKeyDerivation(transactionPublicKey: string, privateViewKey: string): Promise<string>;
export declare function generateKeyImagePrimitive(publicSpendKey: string, privateSpendKey: string, outputIndex: number, derivation: string): Promise<[string, string]>;
export declare function generateKeyImage(transactionPublicKey: string, privateViewKey: string, publicSpendKey: string, privateSpendKey: string, transactionIndex: number): Promise<[string, string]>;
export declare function underivePublicKey(derivation: string, outputIndex: number, outputKey: string): Promise<string>;
