import * as assert from 'assert';
import * as colors from 'colors/safe';
import { WalletBackend, ConventionalDaemon, WalletError } from '../lib/index';

console.log(colors.white('=== Started testing ==='));

/* Setup a daemon */
const daemon = new ConventionalDaemon('127.0.0.1', 11898);

/* Create a new wallet */
const wallet = WalletBackend.createWallet(daemon);

/* Convert the wallet to JSON */
const initialJSON = JSON.stringify(wallet, null, 4);

/* Load a new wallet from the dumped JSON */
const loadedWallet = WalletBackend.loadWalletFromJSON(daemon, initialJSON);

/* Re-dump to JSON  */
const finalJSON = JSON.stringify(loadedWallet, null, 4);

console.log(colors.white('=== Checking wallet JSON serialization ==='));

/* Check round trip suceeded */
if (initialJSON !== finalJSON) {
    assert.fail(colors.red('❌') + ' Initial json is not equal to final json!');
} else {
    console.log(colors.green(' ✔️ ') + ' Wallet serialization was successful.');
}

console.log(colors.white('=== Loading test wallet file ==='));

/* Load a test file to check compatibility with C++ wallet backend */
const testWallet = WalletBackend.openWalletFromFile(daemon, './tests/test.wallet', 'password');

/* Got an error */
if (testWallet instanceof WalletError) {
    assert.fail(colors.red('❌') + ' Wallet loading failed: ' + testWallet.toString());
} else {
    console.log(colors.green(' ✔️ ') + ' Wallet loading succeeded');
}
