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
       with `const daemon = new WB.ConventionalDaemon('127.0.0.1', 11898);` */
    const daemon = new WB.BlockchainCacheApi('blockapi.turtlepay.io', true);

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

    await sleep(1000 * 10);

    /* Save the wallet to disk */
    wallet.saveWalletToFile('mywallet.wallet', 'hunter2');

    /* Stop the wallet so we can exit */
    wallet.stop();

    console.log('Saved wallet to file');
})().catch(err => {
    console.log('Caught promise rejection: ' + err);
});
