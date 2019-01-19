export declare function isHex64(key: string): boolean;
export declare function addressToKeys(address: string): [string, string];
export declare function getLowerBound(val: number, nearestMultiple: number): number;
export declare function getUpperBound(val: number, nearestMultiple: number): number;
export declare function getCurrentTimestampAdjusted(): number;
export declare function isInputUnlocked(unlockTime: number, currentHeight: number): boolean;
export declare function prettyPrintAmount(amount: number): string;
export declare function delay(ms: number): Promise<void>;
export declare function splitAmountIntoDenominations(amount: number): number[];
