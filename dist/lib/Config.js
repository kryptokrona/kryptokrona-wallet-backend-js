"use strict";
// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
class Config {
    constructor() {
        /* The amount of decimal places your coin has, e.g. TurtleCoin has two decimals */
        this.decimalPlaces = 2;
        /* The address prefix your coin uses - you can find this in CryptoNoteConfig.h.
           In TurtleCoin, this converts to TRTL */
        this.addressPrefix = 3914525;
        /* Request timeout for daemon ops in milliseconds */
        this.requestTimeout = 5000;
        /* The block time of your coin, in seconds */
        this.blockTargetTime = 30;
        /* How often to do the 'main loop' - fetch from daemon, process blocks -
           in milliseconds */
        this.mainLoopInterval = 1000;
        /* Your coins 'ticker', generally used to refer to the coin, i.e. 123 TRTL */
        this.ticker = 'TRTL';
    }
}
exports.default = new Config();
