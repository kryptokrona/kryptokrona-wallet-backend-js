// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

class Config {
    /* The amount of decimal places your coin has, e.g. TurtleCoin has two decimals */
    public decimalPlaces: number = 2;

    /* The address prefix your coin uses - you can find this in CryptoNoteConfig.h.
       In TurtleCoin, this converts to TRTL */
    public addressPrefix: number = 3914525;

    /* Request timeout for daemon ops in milliseconds */
    public requestTimeout: number = 5000;

    /* The block time of your coin, in seconds */
    public blockTargetTime: number = 30;

    /* How often to do the 'main loop' - fetch from daemon, process blocks -
       in milliseconds */
    public mainLoopInterval: number = 1000;

    /* Your coins 'ticker', generally used to refer to the coin, i.e. 123 TRTL */
    public ticker: string = 'TRTL';
}

export default new Config();
