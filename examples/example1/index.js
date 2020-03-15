const WB = require('turtlecoin-wallet-backend');
const readline = require('readline');
const util = require('util');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question[util.promisify.custom] = (message) => {
    return new Promise((resolve) => {
        rl.question(message, resolve);
    });
}

const readlineAsync = util.promisify(rl.question);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    const response = await readlineAsync('Do you want to [c]reate or [o]pen a wallet?: ');

    rl.close();

    let wallet;

    /* Initialise our blockchain cache api. Can use a public node or local node
       with `const daemon = new WB.Daemon('127.0.0.1', 11898);` */
    const daemon = new WB.Daemon('blockapi.turtlepay.io', 443);

    if (response === 'c') {
        const newWallet = WB.WalletBackend.createWallet(daemon);

        wallet = newWallet;
    } else if (response === 'o') {
        /* Open wallet, giving our wallet path and password */
        const [openedWallet, error] = WB.WalletBackend.openWalletFromFile(daemon, 'mywallet.wallet', 'hunter2');

        if (error) {
            console.log('Failed to open wallet: ' + error.toString());
            return;
        }

        wallet = openedWallet;
    } else {
        console.log('Bad input');
        return;
    }

    /* Enable debug logging to the console */
    wallet.setLogLevel(WB.LogLevel.DEBUG);

    /* Start wallet sync process */
    await wallet.start();

    console.log('Started wallet');
    console.log('Address: ' + wallet.getPrimaryAddress());

    const [unlockedBalance, lockedBalance] = wallet.getBalance();

    if (unlockedBalance < 11) {
        console.log('Not enough funds to send a transaction...');
    } else {
        console.log('Attempting to send a transaction');

        const result = await wallet.sendTransactionBasic('TRTLv2Fyavy8CXG8BPEbNeCHFZ1fuDCYCZ3vW5H5LXN4K2M2MHUpTENip9bbavpHvvPwb4NDkBWrNgURAd5DB38FHXWZyoBh4wW', 1);

        if (result.success) {
            console.log(`Sent transaction, hash ${result.transactionHash}, fee ${WB.prettyPrintAmount(result.fee)}`);
        } else {
            console.log(`Failed to send transaction: ${result.error.toString()}`);
        }
    }

    await sleep(1000 * 10);

    /* Save the wallet to disk */
    wallet.saveWalletToFile('mywallet.wallet', 'hunter2');

    /* Stop the wallet so we can exit */
    wallet.stop();

    console.log('Saved wallet to file');
})().catch(err => {
    console.log('Caught promise rejection: ' + err);
});
