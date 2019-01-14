import * as colors from 'colors';

import deepEqual = require('deep-equal');

import {
    ConventionalDaemon, prettyPrintAmount, SUCCESS, validateAddresses, WalletBackend,
    WalletError, WalletErrorCode,
} from '../lib/index';

import { CryptoUtils } from '../lib/CnUtils';

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

        console.log(colors.white(' 📰 ')
                  + colors.white('Total tests:  ')
                  + colors.white(this.totalTests.toString()));

        console.log(colors.green(' ✔️  ')
                  + colors.white('Tests passed: ')
                  + colors.green(this.testsPassed.toString()));

        console.log(colors.red(' ❌ ')
                  + colors.white('Tests failed: ')
                  + colors.red(this.testsFailed.toString()));
    }

    public setExitCode(): void {
        process.exitCode = this.testsFailed === 0 ? 0 : 1;
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

    }, 'Testing prettyPrintAmount',
       'prettyPrintAmount works',
       'prettyPrintAmount gave unexpected output!');

    await tester.test(async () => {
        /* Create a new wallet */
        const wallet = WalletBackend.createWallet(daemon);

        const err1: WalletError = wallet.getMnemonicSeedForAddress('') as WalletError;

        /* Verify invalid address is detected */
        const test1: boolean = err1.errorCode === WalletErrorCode.ADDRESS_NOT_VALID;

        const err2: WalletError = wallet.getMnemonicSeedForAddress(
            'TRTLv1s9JQeHAJFoHvcqVBPyHYom2ynKeK6dpYptbp8gQNzdzE73ZD' +
            'kNmNurqfhhcMSUXpS1ZGEJKiKJUcPCyw7vYaCc354DCN1',
        ) as WalletError;

        /* Random address shouldn't be present in wallet */
        const test2: boolean = deepEqual(err2, new WalletError(WalletErrorCode.ADDRESS_NOT_IN_WALLET));

        /* Should get a seed back when we supply our address */
        const test3: boolean = typeof wallet.getMnemonicSeedForAddress(wallet.getPrimaryAddress()) === 'string';

        /* TODO: Add a test for testing a new subwallet address, when we add
           subwallet creation */

        return test1 && test2 && test3;

    }, 'Testing getMnemonicSeedForAddress',
       'getMnemonicSeedForAddress works',
       'getMnemonicSeedForAddress doesn\'t work!');

    await tester.test(async () => {
        const wallet = WalletBackend.createWallet(daemon);

        /* Not called wallet.start(), so node fee should be unset here */
        const [feeAddress, feeAmount] = wallet.getNodeFee();

        return feeAddress === '' && feeAmount === 0;

    }, 'Testing getNodeFee',
       'getNodeFee works',
       'getNodeFee doesn\'t work!');

    await tester.test(async () => {
        const wallet = WalletBackend.createWallet(daemon);

        const address: string = wallet.getPrimaryAddress();

        const err: WalletError = validateAddresses([address], false);

        return deepEqual(err, SUCCESS);

    }, 'Testing getPrimaryAddress',
       'getPrimaryAddress works',
       'getPrimaryAddress doesn\'t work!');

    await tester.test(async () => {
        const privateViewKey: string = '3c6cfe7a29a371278abd9f5725a3d2af5eb73d88b4ed9b8d6c2ff993bbc4c20a';

        const viewWallet = WalletBackend.importViewWallet(
            daemon, 0,
            privateViewKey,
            'TRTLuybJFCU8BjP18bH3VZCNAu1fZ2r3d85SsU2w3VnJAHoRfnzLKgtTK2b58nfwDu59hKxwVuSMhTN31gmUW8nN9aoAN9N8Qyb',
        ) as WalletBackend;

        return viewWallet.getPrivateViewKey() === privateViewKey;

    }, 'Testing getPrivateViewKey',
       'getPrivateViewKey works',
       'getPrivateViewKey doesn\'t work!');

    await tester.test(async () => {
        const keyWallet = WalletBackend.importWalletFromKeys(
            daemon, 0,
            '1f3f6c220dd9f97619dbf44d967f79f3041b9b1c63da2c895f980f1411d5d704',
            '55e0aa4ca65c0ae016c7364eec313f56fc162901ead0e38a9f846686ac78560f',
        ) as WalletBackend;

        const [publicSpendKey, privateSpendKey]
            = keyWallet.getSpendKeys(keyWallet.getPrimaryAddress()) as [string, string];

        return publicSpendKey === 'ff9b6e048297ee435d6219005974c2c8df620a4aca9ca5c4e13f071823482029' &&
               privateSpendKey === '55e0aa4ca65c0ae016c7364eec313f56fc162901ead0e38a9f846686ac78560f';

    }, 'Testing getSpendKeys',
       'getSpendKeys works',
       'getSpendKeys doesn\'t work!');

    /* TODO: Maybe use a remote node? */
    await tester.test(async () => {
        const wallet = WalletBackend.createWallet(daemon);

        /* Not started sync, all should be zero */
        const [a, b, c] = wallet.getSyncStatus();

        const test1: boolean = a === 0 && b === 0 && c === 0;

        await wallet.start();

        /* Wait 5 seconds */
        await delay(1000 * 5);

        wallet.stop();

        /* Started sync, some should be non zero */
        const [d, e, f] = wallet.getSyncStatus();

        const test2: boolean = d !== 0 || e !== 0 || f !== 0;

        return test1 && test2;

    }, 'Testing getSyncStatus (5 second test)',
       'getSyncStatus works',
       'getSyncStatus doesn\'t work! (Do you have a local daemon running?)');

    await tester.test(async () => {

        /* Just random public + private keys */
        const derivation: string = CryptoUtils.generateKeyDerivation(
            'f235acd76ee38ec4f7d95123436200f9ed74f9eb291b1454fbc30742481be1ab',
            '89df8c4d34af41a51cfae0267e8254cadd2298f9256439fa1cfa7e25ee606606',
        );

        const loopIterations: number = 6000;

        const startTime = new Date().getTime();

        for (let i = 0; i < loopIterations; i++) {
            /* Use i as output index to prevent optimization */
            const derivedOutputKey = CryptoUtils.underivePublicKey(
                derivation, i,
                '4a078e76cd41a3d3b534b83dc6f2ea2de500b653ca82273b7bfad8045d85a400',
            );
        }

        const endTime = new Date().getTime();

        const executionTime: number = endTime - startTime;

        const timePerDerivation: string = (executionTime / loopIterations).toFixed(3);

        console.log(colors.green(' ✔️  ') + `Time to perform underivePublicKey: ${timePerDerivation} ms`);

        return true;

    }, 'Testing underivePublicKey performance',
       'underivePublicKey performance test complete',
       'underivePublicKey performance test failed!');

    await tester.test(async () => {
        const loopIterations: number = 6000;

        const startTime = new Date().getTime();

        for (let i = 0; i < loopIterations; i++) {
            /* Just random public + private keys */
            const derivation: string = CryptoUtils.generateKeyDerivation(
                'f235acd76ee38ec4f7d95123436200f9ed74f9eb291b1454fbc30742481be1ab',
                '89df8c4d34af41a51cfae0267e8254cadd2298f9256439fa1cfa7e25ee606606',
            );
        }

        const endTime = new Date().getTime();

        const executionTime: number = endTime - startTime;

        const timePerDerivation: string = (executionTime / loopIterations).toFixed(3);

        console.log(colors.green(' ✔️  ') + `Time to perform generateKeyDerivation: ${timePerDerivation} ms`);

        return true;

    }, 'Testing generateKeyDerivation performance',
       'generateKeyDerivation performance test complete',
       'generateKeyDerivation performance test failed!');

    await tester.test(async () => {
        const wallet = WalletBackend.importWalletFromSeed(
            daemon, 0,
            'skulls woozy ouch summon gifts huts waffle ourselves obtains hexagon ' +
            'tadpoles hacksaw dormant hence abort listen history atom cadets stylishly ' +
            'snout vegan girth guest history',
        ) as WalletBackend;

        const startTime = new Date().getTime();

        await wallet.start();

        /* Wait for 60 seconds */
        await delay(1000 * 60);

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

    }, 'Testing wallet syncing performance (60 second test)',
       'Wallet syncing performance test complete',
       'Wallet syncing performance test failed!');

    /* Print a summary of passed/failed tests */
    tester.summary();

    /* Set exit code based on if we failed any tests */
    tester.setExitCode();
})();
