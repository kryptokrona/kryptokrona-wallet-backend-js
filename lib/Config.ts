// Copyright (C) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

/* I'm gonna give an extended explanation of how mainLoopInterval,
   blockFetchInterval, and blocksPerTick interact here.
   As you may know, nodeJS is single threaded. When we run a function, it
   runs to completion and blocks any other functions waiting to be ran in
   a setTimeout/setInterval.

   Obviously we want to download and process blocks from the daemon. Processing
   blocks is somewhat slow, with it taking somewhere between 10 to 30 seconds
   to process 100 blocks.

   Obviously blocking the event loop for 10 seconds is very far from ideal -
   if we want an interactive UI, we need preferably sub second responses.

   A decent way to solve this is to fetch blocks, say, every second.
   (blockFetchInterval)
   Store these 100 blocks to process for later.

   Then, every mainLoopInterval (10 milliseconds), take blocksPerTick blocks
   from the queue, and process it. This should take less than a second,
   but potentially can be longer if we need to contact the daemon for global
   indexes. Either way, it should be pretty fast.

   Since we then timeout, any other code in the event loop waiting to run
   can proceed, for example user input.

   For my experiments, it seems like processing one block per tick is optimal.
   Depending on how many transactions are in the block, and how powerful your
   CPU is, 10 blocks can take a number of seconds. */

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

    /* How often to process blocks, in millseconds */
    public mainLoopInterval: number = 10;

    /* How often to fetch blocks from the daemon, in milliseconds */
    public blockFetchInterval: number = 1000;

    /* The amount of blocks to process per 'tick' of the mainloop. Note: too
       high a value will cause the event loop to be blocked, and your interaction
       to be laggy. */
    public blocksPerTick: number = 1;

    /* Your coins 'ticker', generally used to refer to the coin, i.e. 123 TRTL */
    public ticker: string = 'TRTL';
}

export default new Config();
