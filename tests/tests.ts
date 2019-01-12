import * as colors from 'colors';

import {
    ConventionalDaemon, prettyPrintAmount, WalletBackend, WalletError,
    WalletErrorCode,
} from '../lib/index';

class Tester {

    public totalTests: number = 0;
    public testsFailed: number = 0;
    public testsPassed: number = 0;

    constructor() {
        console.log(colors.yellow('=== Started testing ===\n'));
    }

    public async test(
        testFunc: () => Promise<boolean>,
        testDescription: string,
        successMsg: string,
        failMsg: string) {

        console.log(colors.yellow(`=== ${testDescription} ===`));

        const success = await testFunc();

        this.totalTests++;

        if (success) {
            console.log(colors.green(' ✔️  ') + successMsg);
            this.testsPassed++;
        } else {
            console.log(colors.red(' ❌ ') + failMsg);
            this.testsFailed++;
        }

        console.log('');
    }

    public summary(): void {
        console.log(colors.yellow('=== Testing complete! ==='));
        console.log(colors.white('Total tests: ') + colors.yellow(this.totalTests.toString()));
        console.log(colors.white('Tests passed: ') + colors.green(this.testsPassed.toString()));
        console.log(colors.white('Tests failed: ') + colors.red(this.testsFailed.toString()));
    }

    public setExitCode(): void {
        process.exitCode = this.testsFailed === 0 ? 0 : 1;
    }
}

(async () => {
    /* Setup test class */
    const tester: Tester = new Tester();

    /* Setup a daemon */
    const daemon = new ConventionalDaemon('127.0.0.1', 11898);

    /* Begin testing */
    await tester.test(async () => {
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

    await tester.test(async () => {
        /* Load a test file to check compatibility with C++ wallet backend */
        const testWallet = WalletBackend.openWalletFromFile(daemon, './tests/test.wallet', 'password');

        return testWallet instanceof WalletBackend;

    }, 'Loading test wallet file',
       'Wallet loading succeeded',
       'Wallet loading failed');

    await tester.test(async () => {
        const seedWallet = WalletBackend.importWalletFromSeed(
            daemon, 0,
            'skulls woozy ouch summon gifts huts waffle ourselves obtains hexagon ' +
            'tadpoles hacksaw dormant hence abort listen history atom cadets stylishly ' +
            'snout vegan girth guest history',
        ) as WalletBackend;

        const [privateSpendKey, privateViewKey] = seedWallet.getPrimaryAddressPrivateKeys();

        return privateSpendKey === 'd61a57a59318d70ff77cc7f8ad7f62887c828da1d5d3f3b0d2f7d3fa596c2904'
            && privateViewKey === '688e5229df6463ec4c27f6ee11c3f1d3d4b4d2480c0aabe64fb807182cfdc801';

    }, 'Verifying seed restore works correctly',
       'Mnemonic seed wallet has correct keys',
       'Mnemonic seed wallet has incorrect keys!');

    await tester.test(async () => {
        const keyWallet = WalletBackend.importWalletFromKeys(
            daemon, 0,
            '688e5229df6463ec4c27f6ee11c3f1d3d4b4d2480c0aabe64fb807182cfdc801',
            'd61a57a59318d70ff77cc7f8ad7f62887c828da1d5d3f3b0d2f7d3fa596c2904',
        ) as WalletBackend;

        const seed = keyWallet.getMnemonicSeed() as string;

        return seed === 'skulls woozy ouch summon gifts huts waffle ourselves obtains ' +
                        'hexagon tadpoles hacksaw dormant hence abort listen history ' +
                        'atom cadets stylishly snout vegan girth guest history';

    }, 'Verifying key restore works correctly',
       'Deterministic key wallet has correct seed',
       'Deterministic key wallet has incorrect seed!');

    await tester.test(async () => {
        const keyWallet = WalletBackend.importWalletFromKeys(
            daemon, 0,
            '1f3f6c220dd9f97619dbf44d967f79f3041b9b1c63da2c895f980f1411d5d704',
            '55e0aa4ca65c0ae016c7364eec313f56fc162901ead0e38a9f846686ac78560f',
        ) as WalletBackend;

        const err = keyWallet.getMnemonicSeed() as WalletError;

        return err.errorCode === WalletErrorCode.KEYS_NOT_DETERMINISTIC;

    }, 'Verifying non deterministic wallet doesn\'t create seed',
       'Non deterministic wallet has no seed',
       'Non deterministic wallet has seed!');

    await tester.test(async () => {
        const viewWallet = WalletBackend.importViewWallet(
            daemon, 0,
            '3c6cfe7a29a371278abd9f5725a3d2af5eb73d88b4ed9b8d6c2ff993bbc4c20a',
            'TRTLuybJFCU8BjP18bH3VZCNAu1fZ2r3d85SsU2w3VnJAHoRfnzLKgtTK2b58nfwDu59hKxwVuSMhTN31gmUW8nN9aoAN9N8Qyb',
        ) as WalletBackend;

        const [privateSpendKey, privateViewKey] = viewWallet.getPrimaryAddressPrivateKeys();

        return privateSpendKey === '0'.repeat(64);

    }, 'Verifying view wallet has null private spend key',
       'View wallet has null private spend key',
       'View wallet has private spend key!');

    await tester.test(async () => {
        const seedWallet = WalletBackend.importWalletFromSeed(
            daemon, 0,
            'skulls woozy ouch summon gifts huts waffle ourselves obtains hexagon ' +
            'tadpoles hacksaw dormant hence abort listen history atom cadets stylishly ' +
            'snout vegan girth guest history',
        ) as WalletBackend;

        const address = seedWallet.getPrimaryAddress();

        return address === 'TRTLv1s9JQeHAJFoHvcqVBPyHYom2ynKeK6dpYptbp8gQNzdzE73ZD' +
                           'kNmNurqfhhcMSUXpS1ZGEJKiKJUcPCyw7vYaCc354DCN1';

    }, 'Verifying correct address is created from seed',
       'Seed wallet has correct address',
       'Seed wallet has incorrect address!');

    await tester.test(async () => {
        const test1: boolean = prettyPrintAmount(12345607) === '123,456.07 TRTL';
        const test2: boolean = prettyPrintAmount(0) === '0.00 TRTL';
        const test3: boolean = prettyPrintAmount(-1234) === '-12.34 TRTL';

        return test1 && test2 && test3;

    }, 'Testing prettyPrintAmount works as expected...',
       'prettyPrintAmount works',
       'prettyPrintAmount gave unexpected output!');

    await tester.test(async () => {
        const wallet = WalletBackend.importWalletFromSeed(
            daemon, 0,
            'skulls woozy ouch summon gifts huts waffle ourselves obtains hexagon ' +
            'tadpoles hacksaw dormant hence abort listen history atom cadets stylishly ' +
            'snout vegan girth guest history',
        ) as WalletBackend;

        // wallet.setLogLevel(LogLevel.DEBUG);

        const startTime = new Date().getTime();

        wallet.start();

        /* Wait for 60 seconds */
        await new Promise((resolve) => setTimeout(resolve, 1000 * 60));

        wallet.stop();

        const endTime = new Date().getTime();

        const [walletBlockCount] = wallet.getSyncStatus();

        if (walletBlockCount === 0) {
            console.log(colors.red(' ❌ ') +
                'You must have a daemon running on 127.0.0.1:11898 to run this test...');
            return false;
        }

        const executionTime: number = endTime - startTime;

        const timePerBlock: string = (executionTime / walletBlockCount).toFixed(2);

        console.log(colors.green(' ✔️  ') + `Time to process one block: ${timePerBlock} ms`);

        return true;
    }, 'Testing performance (60 second test)',
       'Performance test complete',
       'Performance test failed!');

    /* Print a summary of passed/failed tests */
    tester.summary();

    /* Set exit code based on if we failed any tests */
    tester.setExitCode();
})();
