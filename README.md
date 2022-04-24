![image](https://camo.githubusercontent.com/d344c9e18b69f96502f3bf61b0dedc1ca9603af3/68747470733a2f2f6b727970746f6b726f6e612e73652f77702d636f6e74656e742f75706c6f6164732f323031392f30372f786b722d6c6f676f2d626c61636b2d746578742e706e67)

#### Master Build Status
[![Build Status](https://travis-ci.org/turtlecoin/turtlecoin-wallet-backend-js.svg?branch=master)](https://travis-ci.org/turtlecoin/turtlecoin-wallet-backend-js)

#### NPM
https://www.npmjs.com/package/kryptokrona-wallet-backend-js

#### Github

https://github.com/kryptokrona/kryptokrona-wallet-backend-js

# Kryptokrona-wallet-backend

Provides an interface to the Kryptokrona network, allowing wallet applications to be built.

* Downloads blocks from the network, either through a traditional daemon, or a blockchain cache for increased speed
* Processes blocks, decrypting transactions that belong to the user
* Sends and receives transactions

## Installation

NPM:

`npm install kryptokrona-wallet-backend-js --save`

Yarn:

`yarn add kryptokrona-wallet-backend-js`

## Documentation

[You can view the documentation here](https://github.com/kryptokrona/kryptokrona-wallet-backend-js/blob/master/docs/classes/_walletbackend_.walletbackend.html)

You can see a list of all the other classes on the right side of the screen.
Note that you will need to prefix them all with `WB.` to access them, if you are not using typescript style imports, assuming you imported with `const WB = require('kryptokrona-wallet-backend-js')`.


### Javascript

```javascript
const WB = require('kryptokrona-wallet-backend-js');

(async () => {
    const daemon = new WB.Daemon('127.0.0.1', 11898);
    
    const wallet = WB.WalletBackend.createWallet(daemon);

    console.log('Created wallet');

    await wallet.start();

    console.log('Started wallet');

    wallet.saveWalletToFile('mywallet.wallet', 'hunter2');

    /* Make sure to call stop to let the node process exit */
    wallet.stop();
})().catch(err => {
    console.log('Caught promise rejection: ' + err);
});
```

### Typescript

```typescript
import { WalletBackend, Daemon } from 'kryptokrona-wallet-backend-js';

(async () => {
    const daemon: Daemon = new Daemon('127.0.0.1', 11898);

    const wallet: WalletBackend = await WalletBackend.createWallet(daemon);

    console.log('Created wallet');

    await wallet.start();

    console.log('Started wallet');

    wallet.saveWalletToFile('mywallet.wallet', 'hunter2');

    /* Make sure to call stop to let the node process exit */
    wallet.stop();
})().catch(err => {
    console.log('Caught promise rejection: ' + err);
});
```

## Configuration

There are a few features which you may wish to configure that are worth mentioning.

### Auto Optimize

Auto optimization is enabled by default. This makes the wallet automatically send fusion transactions when needed to keep the wallet permanently optimized.

To enable/disable this feature, use the following code:

```javascript
wallet.enableAutoOptimization(false); // disables auto optimization
```

### Coinbase Transaction Scanning

By default, coinbase transactions are not scanned.
This is due to the majority of people not having solo mined any blocks.

If you wish to enable coinbase transaction scanning, run this line of code:

```javascript
wallet.scanCoinbaseTransactions(true)
```

### Logging

By default, the logger is disabled. You can enable it like so:

```javascript
wallet.setLogLevel(WB.LogLevel.DEBUG);
```

and in typescript:

```typescript
wallet.setLogLevel(LogLevel.DEBUG);
```

The logger uses console.log, i.e. it outputs to stdout.

If you want to change this, or want more control over what messages are logged,
you can provide a callback for the logger to call.

```javascript
wallet.setLoggerCallback((prettyMessage, message, level, categories) => {
    if (categories.includes(WB.LogCategory.SYNC)) {
        console.log(prettyMessage);
    }
});
```

and in typescript:

```typescript
wallet.setLoggerCallback((prettyMessage, message, level, categories) => {
    if (categories.includes(LogCategory.SYNC)) {
        console.log(prettyMessage);
    }
});
```

In this example, we only print messages that fall into the SYNC category.

You can view available categories and log levels in the documentation.
