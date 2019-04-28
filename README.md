![image](https://user-images.githubusercontent.com/34389545/35821974-62e0e25c-0a70-11e8-87dd-2cfffeb6ed47.png)

#### Master Build Status
[![Build Status](https://travis-ci.org/turtlecoin/turtlecoin-wallet-backend-js.svg?branch=master)](https://travis-ci.org/turtlecoin/turtlecoin-wallet-backend-js)

# turtlecoin-wallet-backend

Provides an interface to the TurtleCoin network, allowing wallet applications to be built.

* Downloads blocks from the network, either through a traditional daemon, or a blockchain cache for increased speed
* Processes blocks, decrypting transactions that belong to the user
* Sends and receives transactions

## Installation

NPM:

`npm install git+https://git@github.com/turtlecoin/turtlecoin-wallet-backend-js.git --save`

Yarn:

`yarn add https://github.com/turtlecoin/turtlecoin-wallet-backend-js`

## Documentation

You can view the documentation here:  https://turtlecoin.github.io/turtlecoin-wallet-backend-js/classes/_walletbackend_.walletbackend.html

## Quick Start

### Javascript

```javascript
const WB = require('turtlecoin-wallet-backend');

(async () => {
    const daemon = new WB.ConventionalDaemon('127.0.0.1', 11898);
    /* OR
    const daemon = new WB.BlockchainCacheApi('blockapi.turtlepay.io', true);
    */
    
    const wallet = WB.WalletBackend.createWallet(daemon);

    console.log('Created wallet');

    await wallet.start();

    console.log('Started wallet');

    /* After some time...
    wallet.stop();
    */

})().catch(err => {
    console.log('Caught promise rejection: ' + err);
});
```

### Typescript

```typescript
import { WalletBackend, ConventionalDaemon, BlockchainCacheApi } from 'turtlecoin-wallet-backend';

(async () => {
    const daemon: ConventionalDaemon = new ConventionalDaemon('127.0.0.1', 11898);

    /* OR
    const daemon: BlockchainCacheApi = new BlockchainCacheApi('blockapi.turtlepay.io', true);
    */
    
    const wallet: WalletBackend = WalletBackend.createWallet(daemon);

    console.log('Created wallet');

    await wallet.start();

    console.log('Started wallet');

    /* After some time...
    wallet.stop();
    */

})().catch(err => {
    console.log('Caught promise rejection: ' + err);
});
```

### Logging

By default, the logger is disabled. You can enable it like so:

```javascript
wallet.setLogLevel(LogLevel.DEBUG);
```

The logger uses console.log, i.e. it outputs to stdout.

If you want to change this, or want more control over what messages are logged,
you can provide a callback for the logger to call.

```javascript
wallet.setLoggerCallback((prettyMessage, message, level, categories) => {
    if (categories.includes(LogCategory.SYNC)) {
        console.log(prettyMessage);
    }
});
```

In this example, we only print messages that fall into the SYNC category.

You can view available categories and log levels in the documentation below.

### Things To Note

By default, coinbase transactions are not scanned. This is due to the majority of people not having solo mined any blocks.

If you wish to enable coinbase transaction scanning, run this line of code:

```javascript
wallet.scanCoinbaseTransactions(true);
```

## Building (For Developers)

`git clone https://github.com/zpalmtree/turtlecoin-wallet-backend.git`

`cd turtlecoin-wallet-backend`

`npm install -g yarn` (Skip this if you already have yarn installed)

`yarn build`

Generated javascript files will be written to the dist/lib/ folder.

## Running tests

`yarn test` - This will run the basic tests

`yarn test-all` - This will run all tests, including performance tests.
You need a daemon running on 127.0.0.1:11898 for these to work.

## Building documentation

`yarn docs`

## Contributing

Please run `yarn style` to ensure your changes adhere to the tslint rules before committing.

You can try running `yarn style --fix` to automatically fix issues.
