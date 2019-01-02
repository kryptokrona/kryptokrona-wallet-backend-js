import * as colors from 'colors/safe';
import {
    WalletBackend, ConventionalDaemon, WalletError, WalletErrorCode
} from '../lib/index';

class Tester {
    constructor() {
        console.log(colors.yellow('=== Started testing ===\n'));
    }

    test(
        testFunc: () => boolean,
        testDescription: string,
        successMsg: string,
        failMsg: string) {

        console.log(colors.yellow(`=== ${testDescription} ===`));

        const success = testFunc();

        this.totalTests++;

        if (success) {
            console.log(colors.green(' ✔️ ') + ' ' + successMsg);
            this.testsPassed++;
        } else {
            console.log(colors.red(' ❌') + ' ' + failMsg);
            this.testsFailed++;
        }

        console.log('');
    }

    summary(): void {
        console.log(colors.yellow('=== Testing complete! ==='));
        console.log(colors.white('Total tests: ') + colors.yellow(this.totalTests.toString()));
        console.log(colors.white('Tests passed: ') + colors.green(this.testsPassed.toString()));
        console.log(colors.white('Tests failed: ') + colors.red(this.testsFailed.toString()));
    }

    totalTests: number = 0;
    testsFailed: number = 0;
    testsPassed: number = 0;
}

/* Setup test class */
const tester: Tester = new Tester();

/* Setup a daemon */
const daemon = new ConventionalDaemon('127.0.0.1', 11898);

/* Begin testing */
tester.test(() => {
    /* Create a new wallet */
    const wallet = WalletBackend.createWallet(daemon);

    /* Convert the wallet to JSON */
    const initialJSON = JSON.stringify(wallet, null, 4);

    /* Load a new wallet from the dumped JSON */
    const loadedWallet = WalletBackend.loadWalletFromJSON(daemon, initialJSON);

    /* Re-dump to JSON  */
    const finalJSON = JSON.stringify(loadedWallet, null, 4);

    return initialJSON === finalJSON;

}, 'Checking wallet JSON serialization',
   'Wallet serialization was successful',
   'Initial JSON is not equal to final json!');

tester.test(() => {
    /* Load a test file to check compatibility with C++ wallet backend */
    const testWallet = WalletBackend.openWalletFromFile(daemon, './tests/test.wallet', 'password');

    return testWallet instanceof WalletBackend;

}, 'Loading test wallet file',
   'Wallet loading succeeded',
   'Wallet loading failed');

tester.test(() => {
    const seedWallet = WalletBackend.importWalletFromSeed(
        daemon, 0, 
        'skulls woozy ouch summon gifts huts waffle ourselves obtains hexagon tadpoles hacksaw dormant hence abort listen history atom cadets stylishly snout vegan girth guest history'
    ) as WalletBackend;

    const [privateSpendKey, privateViewKey] = seedWallet.getPrimaryAddressPrivateKeys();

    return privateSpendKey === 'd61a57a59318d70ff77cc7f8ad7f62887c828da1d5d3f3b0d2f7d3fa596c2904'
        && privateViewKey === '688e5229df6463ec4c27f6ee11c3f1d3d4b4d2480c0aabe64fb807182cfdc801';

}, 'Verifying seed restore works correctly',
   'Mnemonic seed wallet has correct keys',
   'Mnemonic seed wallet has incorrect keys!');

tester.test(() => {
    const keyWallet = WalletBackend.importWalletFromKeys(
        daemon, 0,
        '688e5229df6463ec4c27f6ee11c3f1d3d4b4d2480c0aabe64fb807182cfdc801',
        'd61a57a59318d70ff77cc7f8ad7f62887c828da1d5d3f3b0d2f7d3fa596c2904'
    ) as WalletBackend;

    const seed = keyWallet.getMnemonicSeed() as string;

    return seed === 'skulls woozy ouch summon gifts huts waffle ourselves obtains hexagon tadpoles hacksaw dormant hence abort listen history atom cadets stylishly snout vegan girth guest history';

}, 'Verifying key restore works correctly',
   'Deterministic key wallet has correct seed',
   'Deterministic key wallet has incorrect seed!');

tester.test(() => {
    const keyWallet = WalletBackend.importWalletFromKeys(
        daemon, 0,
        '1f3f6c220dd9f97619dbf44d967f79f3041b9b1c63da2c895f980f1411d5d704',
        '55e0aa4ca65c0ae016c7364eec313f56fc162901ead0e38a9f846686ac78560f'
    ) as WalletBackend;

    const err = keyWallet.getMnemonicSeed() as WalletError;

    return err.errorCode === WalletErrorCode.KEYS_NOT_DETERMINISTIC;

}, 'Verifying non deterministic wallet doesn\'t create seed',
   'Non deterministic wallet has no seed',
   'Non deterministic wallet has seed!');

tester.summary();
