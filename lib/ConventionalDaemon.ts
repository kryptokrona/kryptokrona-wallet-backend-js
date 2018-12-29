// Copyright (c) 2018, Zpalmtree 
// 
// Please see the included LICENSE file for more information.

import { IDaemon } from './IDaemon';
import { Block } from './Types';

const request = require('request-promise');

export class ConventionalDaemon implements IDaemon {
    constructor(daemonHost: string, daemonPort: number) {
        this.daemonHost = daemonHost;
        this.daemonPort = daemonPort;
        this.daemonURL = 'http://' + daemonHost + ':' + daemonPort;
    }

    private daemonHost: string;

    private daemonPort: number;

    private daemonURL: string;

    async getWalletSyncData(
        blockHashCheckpoints: string[],
        startHeight: number,
        startTimestamp: number): Promise<Block[]> {

        const data = {
            blockHashCheckpoints: blockHashCheckpoints,
            startHeight: startHeight,
            startTimestamp: startTimestamp
        };

        const options = {
            uri: this.daemonURL + '/getwalletsyncdata',
            timeout: 1000 * 10, // 10 seconds
            json: true,
            body: data 
        };

        try {
            const response = await request.post(options);

            console.log('Got response from /getwalletsyncdata: ' + response);

            if (!response.status || !response.items || response.status != 'OK') {
                const msg = 'Failed to get wallet sync data, items missing or status incorrect.';
                return Promise.reject(msg);
            }

            return Promise.resolve(response.items);

        } catch (error) {
            console.log('Error retrieving wallet sync data: ' + error.toString());
            return Promise.reject(error);
        }
    }
}
