// Copyright (c) 2018, Zpalmtree 
// 
// Please see the included LICENSE file for more information.

import { Block } from './Types';

export interface IDaemon {
    getWalletSyncData(
        blockHashCheckpoints: string[],
        startHeight: number,
        startTimestamp: number) : Promise<Block[]>;
}
