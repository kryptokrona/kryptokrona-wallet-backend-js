// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

class Config {
    /* The amount of decimal places your coin has, e.g. TurtleCoin has two decimals */
    decimalPlaces: number = 2;

    /* The address prefix your coin uses - you can find this in CryptoNoteConfig.h.
       In TurtleCoin, this converts to TRTL */
    addressPrefix: number = 3914525;
};

module.exports = new Config();
