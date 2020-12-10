import * as _ from 'lodash';
import * as colors from 'colors';
import * as fs from 'fs';

import {
    Config,
    createIntegratedAddress,
    Daemon,
    isValidMnemonic,
    isValidMnemonicWord,
    prettyPrintAmount,
    SUCCESS,
    validateAddresses,
    WalletBackend,
    WalletError,
    WalletErrorCode,
} from '../lib/index';

import {generateKeyDerivation, underivePublicKey} from '../lib/CryptoWrapper';

import {Address, Crypto as TurtleCoinCrypto, CryptoType, LedgerTransport} from 'turtlecoin-utils';

const doPerformanceTests: boolean = process.argv.includes('--do-performance-tests');

const daemonAddress = 'fastpool.xyz';
const daemonPort = 11898;

enum TestStatus {
    PASS,
    FAIL,
    SKIP
}

class Tester {

    public totalTests: number = 0;
    public testsFailed: number = 0;
    public testsPassed: number = 0;
    public testsSkipped: number = 0;

    constructor() {
        console.log(colors.yellow('=== Started testing ===\n'));
    }

    public async test(
        testFunc: () => Promise<TestStatus>,
        testDescription: string,
        successMsg: string,
        failMsg: string,
        skipMsg?: string) {

        console.log(colors.yellow(`=== ${testDescription} ===`));

        let status: TestStatus = TestStatus.FAIL;

        try {
            status = await testFunc();
        } catch (err) {
            console.log(`Error executing test: ${err}`);
        }

        this.totalTests++;

        if (status === TestStatus.PASS) {
            console.log(colors.green(' ✔️  ') + successMsg);
            this.testsPassed++;
        } else if (status === TestStatus.FAIL) {
            console.log(colors.red(' ❌ ') + failMsg);
            this.testsFailed++;
        } else {
            console.log(colors.blue(' - ') + skipMsg);
            this.testsSkipped++;
        }

        console.log('');
    }

    public summary(): void {
        console.log(colors.yellow('=== Testing complete! ==='));

        console.log(colors.white(' 📰  ')
                  + colors.white('Total tests:  ')
                  + colors.white(this.totalTests.toString()));

        console.log(colors.green(' ✔️  ')
                  + colors.white('Tests passed: ')
                  + colors.green(this.testsPassed.toString()));

        console.log(colors.blue(' - ')
                  + colors.white('Tests skipped: ')
                  + colors.blue(this.testsSkipped.toString()));

        console.log(colors.red(' ❌  ')
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

async function encryptDecryptWallet(
    wallet: WalletBackend,
    daemon: Daemon,
    password: string): Promise<boolean> {
        const encryptedString = wallet.encryptWalletToString(password);
        const [, error] = await WalletBackend.openWalletFromEncryptedString(daemon, encryptedString, password);

        if (error) {
            return false;
        }

        return true;
    }

async function roundTrip(
    wallet: WalletBackend,
    daemon: Daemon,
    password: string): Promise<boolean> {

    /* Save wallet to file */
    if (!wallet.saveWalletToFile('tmp.wallet', password)) {
        return false;
    }

    /* Check we can re-open saved file */
    const [loadedWallet, error] = await WalletBackend.openWalletFromFile(
        daemon, 'tmp.wallet', password,
    );

    /* Remove file */
    fs.unlinkSync('tmp.wallet');

    if (error) {
        return false;
    }

    /* Loaded file should equal original JSON */
    return wallet.toJSONString() === (loadedWallet as WalletBackend).toJSONString();
}

(async () => {
    /* Setup test class */
    const tester: Tester = new Tester();

    /* Setup a daemon */
    const daemon: Daemon = new Daemon(daemonAddress, daemonPort, undefined, true);

    /* Begin testing */
    await tester.test(async () => {
        /* Create a new wallet */
        const wallet = await WalletBackend.createWallet(daemon);

        /* Convert the wallet to JSON */
        const initialJSON = JSON.stringify(wallet, null, 4);

        /* Load a new wallet from the dumped JSON */
        const [loadedWallet, ] = await WalletBackend.loadWalletFromJSON(daemon, initialJSON);

        /* Re-dump to JSON  */
        const finalJSON = JSON.stringify(loadedWallet, null, 4);

        return (initialJSON === finalJSON) ? TestStatus.PASS : TestStatus.FAIL;
    }, 'Checking wallet JSON serialization',
       'Wallet serialization was successful',
       'Initial JSON is not equal to final json!');

    await tester.test(async () => {
        /* Load a test file to check compatibility with C++ wallet backend */
        const [, error] = await WalletBackend.openWalletFromFile(
            daemon, './tests/test.wallet', 'password',
        );

        return (error === undefined) ? TestStatus.PASS : TestStatus.FAIL;
    }, 'Loading test wallet file',
       'Wallet loading succeeded',
       'Wallet loading failed');

    await tester.test(async () => {
        try {
            const wallet = await WalletBackend.createWallet(daemon);

            if (!roundTrip(wallet, daemon, 'password')) {
                return TestStatus.FAIL;
            }

            /* Verify loaded wallet runs */
            await wallet.start();

            await delay(1000 * 2);

            await wallet.stop();

        } catch (err) {
            return TestStatus.FAIL;
        }

        return TestStatus.PASS;
    }, 'Checking can open saved file',
       'Can open saved file',
       'Can\'t open saved file!');

    await tester.test(async () => {
        const wallet = await WalletBackend.createWallet(daemon);

        /* Blank password */
        const test1: boolean = await roundTrip(
            wallet, daemon, '',
        );

        /* Nipponese */
        const test2: boolean = await roundTrip(
            wallet, daemon, 'お前はもう死んでいる',
        );

        /* A variety of unicode symbols, suggested by VMware */
        const test3: boolean = await roundTrip(
            wallet, daemon, '表ポあA鷗ŒéＢ逍Üßªąñ丂㐀𠀀',
        );

        /* Emojis */
        const test4: boolean = await roundTrip(
            wallet, daemon, '❤️ 💔 💌 💕 💞 💓 💗 💖 💘 💝 💟 💜 💛 💚 💙',
        );

        /* Right to left test */
        const test5: boolean = await roundTrip(
            wallet, daemon, 'בְּרֵאשִׁית, בָּרָא אֱלֹהִים, אֵת הַשָּׁמַיִם, וְאֵת הָאָרֶץ',
        );

        /* Cyrillic */
        const test6: boolean = await roundTrip(
            wallet, daemon, 'Дайте советов чтоли!',
        );

        return (test1 && test2 && test3 && test4 && test5 && test6) ? TestStatus.PASS : TestStatus.FAIL;

    }, 'Verifying special passwords work as expected',
       'Special passwords work as expected',
       'Special passwords do not work as expected!');

    await tester.test(async () => {
        const wallet = await WalletBackend.createWallet(daemon);

        return (await encryptDecryptWallet(wallet, daemon, 'password')) ? TestStatus.PASS : TestStatus.FAIL;
    },  'Verifying wallet encryption and decryption work as expected',
        'Encrypt/Decrypt wallet works as expected',
        'Encrypt/Decrypt wallet does not work as expected!');

    await tester.test(async () => {
        const [seedWallet, ] = await WalletBackend.importWalletFromSeed(
            daemon, 0,
            'skulls woozy ouch summon gifts huts waffle ourselves obtains hexagon ' +
            'tadpoles hacksaw dormant hence abort listen history atom cadets stylishly ' +
            'snout vegan girth guest history',
        );

        const [privateSpendKey, privateViewKey]
            = (seedWallet as WalletBackend).getPrimaryAddressPrivateKeys();

        return (privateSpendKey === 'd61a57a59318d70ff77cc7f8ad7f62887c828da1d5d3f3b0d2f7d3fa596c2904'
            && privateViewKey === '688e5229df6463ec4c27f6ee11c3f1d3d4b4d2480c0aabe64fb807182cfdc801') ?
            TestStatus.PASS : TestStatus.FAIL;

    }, 'Verifying seed restore works correctly',
       'Mnemonic seed wallet has correct keys',
       'Mnemonic seed wallet has incorrect keys!');

    await tester.test(async () => {
        const [keyWallet, ] = await WalletBackend.importWalletFromKeys(
            daemon, 0,
            '688e5229df6463ec4c27f6ee11c3f1d3d4b4d2480c0aabe64fb807182cfdc801',
            'd61a57a59318d70ff77cc7f8ad7f62887c828da1d5d3f3b0d2f7d3fa596c2904',
        );

        const [seed, ] = await (keyWallet as WalletBackend).getMnemonicSeed();

        return (seed === 'skulls woozy ouch summon gifts huts waffle ourselves obtains ' +
                        'hexagon tadpoles hacksaw dormant hence abort listen history ' +
                        'atom cadets stylishly snout vegan girth guest history') ? TestStatus.PASS : TestStatus.FAIL;

    }, 'Verifying key restore works correctly',
       'Deterministic key wallet has correct seed',
       'Deterministic key wallet has incorrect seed!');

    await tester.test(async () => {
        const [keyWallet, ] = await WalletBackend.importWalletFromKeys(
            daemon, 0,
            '1f3f6c220dd9f97619dbf44d967f79f3041b9b1c63da2c895f980f1411d5d704',
            '55e0aa4ca65c0ae016c7364eec313f56fc162901ead0e38a9f846686ac78560f',
        );

        const [, err] = await (keyWallet as WalletBackend).getMnemonicSeed();

        return ((err as WalletError).errorCode === WalletErrorCode.KEYS_NOT_DETERMINISTIC) ?
            TestStatus.PASS : TestStatus.FAIL;

    }, 'Verifying non deterministic wallet doesn\'t create seed',
       'Non deterministic wallet has no seed',
       'Non deterministic wallet has seed!');

    await tester.test(async () => {
        const [viewWallet, ] = await WalletBackend.importViewWallet(
            daemon, 0,
            '3c6cfe7a29a371278abd9f5725a3d2af5eb73d88b4ed9b8d6c2ff993bbc4c20a',
            'TRTLuybJFCU8BjP18bH3VZCNAu1fZ2r3d85SsU2w3VnJAHoRfnzLKgtTK2b58nfwDu59hKxwVuSMhTN31gmUW8nN9aoAN9N8Qyb',
        );

        const [privateSpendKey, ] = (viewWallet as WalletBackend).getPrimaryAddressPrivateKeys();

        return (privateSpendKey === '0'.repeat(64)) ? TestStatus.PASS : TestStatus.FAIL;

    }, 'Verifying view wallet has null private spend key',
       'View wallet has null private spend key',
       'View wallet has private spend key!');

    await tester.test(async () => {
        const [seedWallet, ] = await WalletBackend.importWalletFromSeed(
            daemon, 0,
            'skulls woozy ouch summon gifts huts waffle ourselves obtains hexagon ' +
            'tadpoles hacksaw dormant hence abort listen history atom cadets stylishly ' +
            'snout vegan girth guest history',
        );

        const address = (seedWallet as WalletBackend).getPrimaryAddress();

        return (address === 'TRTLv1s9JQeHAJFoHvcqVBPyHYom2ynKeK6dpYptbp8gQNzdzE73ZD' +
                           'kNmNurqfhhcMSUXpS1ZGEJKiKJUcPCyw7vYaCc354DCN1') ? TestStatus.PASS : TestStatus.FAIL;

    }, 'Verifying correct address is created from seed',
       'Seed wallet has correct address',
       'Seed wallet has incorrect address!');

    await tester.test(async () => {
        const test1: boolean = prettyPrintAmount(12345607) === '123,456.07 TRTL';
        const test2: boolean = prettyPrintAmount(0) === '0.00 TRTL';
        const test3: boolean = prettyPrintAmount(-1234) === '-12.34 TRTL';

        return (test1 && test2 && test3) ? TestStatus.PASS : TestStatus.FAIL;

    }, 'Testing prettyPrintAmount',
       'prettyPrintAmount works',
       'prettyPrintAmount gave unexpected output!');

    await tester.test(async () => {
        /* Create a new wallet */
        const wallet = await WalletBackend.createWallet(daemon);

        const [, err1] = await wallet.getMnemonicSeedForAddress('');

        /* Verify invalid address is detected */
        const test1: boolean = (err1 as WalletError).errorCode === WalletErrorCode.ADDRESS_WRONG_LENGTH;

        const [, err2] = await wallet.getMnemonicSeedForAddress(
            'TRTLv1s9JQeHAJFoHvcqVBPyHYom2ynKeK6dpYptbp8gQNzdzE73ZD' +
            'kNmNurqfhhcMSUXpS1ZGEJKiKJUcPCyw7vYaCc354DCN1',
        );

        /* Random address shouldn't be present in wallet */
        const test2: boolean = _.isEqual(err2, new WalletError(WalletErrorCode.ADDRESS_NOT_IN_WALLET));

        /* Should get a seed back when we supply our address */
        const test3: boolean = (await wallet.getMnemonicSeedForAddress(wallet.getPrimaryAddress()))[0] !== undefined;

        /* TODO: Add a test for testing a new subwallet address, when we add
           subwallet creation */

        return (test1 && test2 && test3) ? TestStatus.PASS : TestStatus.FAIL;

    }, 'Testing getMnemonicSeedForAddress',
       'getMnemonicSeedForAddress works',
       'getMnemonicSeedForAddress doesn\'t work!');

    await tester.test(async () => {
        const wallet = await WalletBackend.createWallet(new Daemon(daemonAddress, daemonPort));

        /* Not called wallet.start(), so node fee should be unset here */
        const [feeAddress, feeAmount] = wallet.getNodeFee();

        return (feeAddress === '' && feeAmount === 0) ? TestStatus.PASS : TestStatus.FAIL;

    }, 'Testing getNodeFee',
       'getNodeFee works',
       'getNodeFee doesn\'t work!');

    await tester.test(async () => {
        const wallet = await WalletBackend.createWallet(daemon);

        const address: string = wallet.getPrimaryAddress();

        const err: WalletError = await validateAddresses([address], false);

        return (_.isEqual(err, SUCCESS)) ? TestStatus.PASS : TestStatus.FAIL;

    }, 'Testing getPrimaryAddress',
       'getPrimaryAddress works',
       'getPrimaryAddress doesn\'t work!');

    await tester.test(async () => {
        const privateViewKey: string = '3c6cfe7a29a371278abd9f5725a3d2af5eb73d88b4ed9b8d6c2ff993bbc4c20a';

        const [viewWallet, ] = await WalletBackend.importViewWallet(
            daemon, 0,
            privateViewKey,
            'TRTLuybJFCU8BjP18bH3VZCNAu1fZ2r3d85SsU2w3VnJAHoRfnzLKgtTK2b58nfwDu59hKxwVuSMhTN31gmUW8nN9aoAN9N8Qyb',
        );

        return ((viewWallet as WalletBackend).getPrivateViewKey() === privateViewKey) ?
            TestStatus.PASS : TestStatus.FAIL;

    }, 'Testing getPrivateViewKey',
       'getPrivateViewKey works',
       'getPrivateViewKey doesn\'t work!');

    await tester.test(async () => {
        const [keyWallet, ] = await WalletBackend.importWalletFromKeys(
            daemon, 0,
            '1f3f6c220dd9f97619dbf44d967f79f3041b9b1c63da2c895f980f1411d5d704',
            '55e0aa4ca65c0ae016c7364eec313f56fc162901ead0e38a9f846686ac78560f',
        );

        const wallet = keyWallet as WalletBackend;

        const [publicSpendKey, privateSpendKey, ]
            = await wallet.getSpendKeys(wallet.getPrimaryAddress());

        return (publicSpendKey === 'ff9b6e048297ee435d6219005974c2c8df620a4aca9ca5c4e13f071823482029' &&
               privateSpendKey === '55e0aa4ca65c0ae016c7364eec313f56fc162901ead0e38a9f846686ac78560f') ?
            TestStatus.PASS : TestStatus.FAIL;

    }, 'Testing getSpendKeys',
       'getSpendKeys works',
       'getSpendKeys doesn\'t work!');

    await tester.test(async () => {
        let address;
        try {
        address = await createIntegratedAddress(
            'TRTLv2Fyavy8CXG8BPEbNeCHFZ1fuDCYCZ3vW5H5LXN4K2M2MHUpTENip9bbavpHvvPwb4NDkBWrNgURAd5DB38FHXWZyoBh4wW',
            'b23df6e84c1dd619d3601a28e5948d92a0d096aea1621969c591a90e986794a0',
        );
        } catch (err) {
            console.log(JSON.stringify(err));
        }

        const test1: boolean = address === 'TRTLuyzDT8wJ6bAmnmBLyRHmBNrRrafuR9G3bJTNzPiTAS4xKDQKHd9Aa2sF2q22DF9EXi5HNpZGcHGBwqgVAqc2AZxUBMMSegm8CXG8BPEbNeCHFZ1fuDCYCZ3vW5H5LXN4K2M2MHUpTENip9bbavpHvvPwb4NDkBWrNgURAd5DB38FHXWZyhJk2yR';

        let test2: boolean = false;

        try {
            await createIntegratedAddress('TRTLv2Fyavy8CXG8BPEbNeCHFZ1fuDCYCZ3vW5H5LXN4K2M2MHUpTENip9bbavpHvvPwb4NDkBWrNgURAd5DB38FHXWZyoBh4wW', '');
        } catch (err) {
            test2 = true;
        }

        let test3: boolean = false;

        try {
            await createIntegratedAddress('', 'b23df6e84c1dd619d3601a28e5948d92a0d096aea1621969c591a90e986794a0');
        } catch (err) {
            test3 = true;
        }

        return (test1 && test2 && test3) ? TestStatus.PASS : TestStatus.FAIL;

    }, 'Testing createIntegratedAddress',
       'createIntegratedAddress works',
       'createIntegratedAddress doesn\'t work!');

    await tester.test(async () => {
        const [keyWallet, ] = await WalletBackend.importWalletFromKeys(
            daemon, 0,
            '1f3f6c220dd9f97619dbf44d967f79f3041b9b1c63da2c895f980f1411d5d704',
            '55e0aa4ca65c0ae016c7364eec313f56fc162901ead0e38a9f846686ac78560f', {
                addressPrefix: 8411,
            },
        );

        const address: string = (keyWallet as WalletBackend).getPrimaryAddress();

        return (address === 'dg5NZstxyAegrTA1Z771tPZaf13V6YHAjUjAieQfjwCb6P1eYHuMmwRcDcQ1eAs41sQrh98FjBXn257HZzh2CCwE2spKE2gmA') ?
            TestStatus.PASS : TestStatus.FAIL;

    }, 'Testing supplied config is applied',
       'Supplied config applied correctly',
       'Supplied config not applied!');

    await tester.test(async () => {
        const test1: boolean = !isValidMnemonicWord('aaaaa');
        const test2: boolean = isValidMnemonicWord('abbey');
        const test3: boolean = (await isValidMnemonic('nugget lazy gang sonic vulture exit veteran poverty affair ringing opus soapy sonic afield dating lectures worry tuxedo ruffled rated locker bested aunt bifocals opus'))[0];
        const test4: boolean = !(await isValidMnemonic(''))[0];
        const test5: boolean = !(await isValidMnemonic('nugget lazy gang sonic vulture exit veteran poverty affair ringing opus soapy sonic afield dating lectures worry tuxedo ruffled rated locker bested aunt bifocals soapy'))[0];
        const test6: boolean = !(await isValidMnemonic('a lazy gang sonic vulture exit veteran poverty affair ringing opus soapy sonic afield dating lectures worry tuxedo ruffled rated locker bested aunt bifocals opus'))[0];

        return (test1 && test2 && test3 && test4 && test5 && test6) ? TestStatus.PASS : TestStatus.FAIL;

    }, 'Testing isValidMnemonic',
       'isValidMnemonic works',
       'isValidMnemonic doesn\'t work!');

    await tester.test(async () => {
        const daemon2: Daemon = new Daemon('127.0.0.1', 11898);

        const wallet = await WalletBackend.createWallet(daemon2);

        await wallet.start();

        const daemon3: Daemon = new Daemon(daemonAddress, daemonPort);

        await wallet.swapNode(daemon3);

        const info = wallet.getDaemonConnectionInfo();

        await wallet.stop();

        return info.host === daemonAddress && info.port === daemonPort && info.sslDetermined
            ? TestStatus.PASS
            : TestStatus.FAIL;
    }, 'Testing swapNode',
       'swapNode works',
       'swapNode doesn\'t work!');

    await tester.test(async () => {
        const daemon2: Daemon = new Daemon('this is not a valid host', 7777);

        let success: boolean = false;

        daemon2.on('disconnect', () => {
            success = true;
        });

        await daemon2.init();

        const daemon3: Daemon = new Daemon(daemonAddress, daemonPort);

        daemon3.on('disconnect', () => {
            success = false;
        });

        await daemon3.init();

        return (success) ? TestStatus.PASS : TestStatus.FAIL;

    }, 'Testing daemon events',
       'Daemon events work',
       'Daemon events don\'t work!');

    await tester.test(async () => {
        /* Load a test file to check compatibility with C++ wallet backend */
        const [testWallet, ] = await WalletBackend.openWalletFromFile(
            daemon, './tests/test.wallet', 'password',
        );

        const wallet = testWallet as WalletBackend;

        const a = await wallet.getNumTransactions() === 3;

        let [ unlockedBalance, lockedBalance ] = await wallet.getBalance();

        const c = unlockedBalance === 246 && lockedBalance === 167;

        await wallet.rewind(1026200);

        const b = await wallet.getNumTransactions() === 1;

        [ unlockedBalance, lockedBalance ] = await wallet.getBalance();

        const d = unlockedBalance === 1234 && lockedBalance === 0;

        return (a && b && c && d) ? TestStatus.PASS : TestStatus.FAIL;

    }, 'Testing rewind',
       'Rewind succeeded',
       'Rewind failed');

    await tester.test(async () => {
        const [keyWallet, ] = await WalletBackend.importWalletFromKeys(
            daemon, 0,
            '1f3f6c220dd9f97619dbf44d967f79f3041b9b1c63da2c895f980f1411d5d704',
            '55e0aa4ca65c0ae016c7364eec313f56fc162901ead0e38a9f846686ac78560f',
        );

        const wallet = keyWallet as WalletBackend;

        const [address1, ] = await wallet.importSubWallet('c93d9e2e71ea018e7b0cec89c260f2d00d3f88ede16b3532f4ae04596ab38001');

        const a = address1 === 'TRTLuxZPMVRHTq27oJFmwzd85wVr2ddhM2gqXcDAp1NiDKjCMwBT98BEaCRGvRc8uXEeoz5PaR5EgDZd1FTbCeVeYFqjbp6Wx2H';

        const b = wallet.getPrimaryAddress() === 'TRTLv41arQbNqvP1x4MuTVFxqVydgF2PBatbBKdER2LP6uH56q3s4EbEaCRGvRc8uXEeoz5PaR5EgDZd1FTbCeVeYFqjbj5LyQQ';

        const [, error2] = await wallet.importSubWallet('c93d9e2e71ea018e7b0cec89c260f2d00d3f88ede16b3532f4ae04596ab38001');

        const c = (error2 as WalletError).errorCode === WalletErrorCode.SUBWALLET_ALREADY_EXISTS;

        return (a && b && c) ? TestStatus.PASS : TestStatus.FAIL;

    }, 'Testing subwallets',
       'Subwallets work',
       'Subwallet tests don\'t work!');

    await tester.test(async () => {
        const wallet = await WalletBackend.createWallet(daemon);

        let success = true;

        for (let i = 2; i < 10; i++) {
            await wallet.addSubWallet();

            if (wallet.getWalletCount() !== i) {
                success = false;
            }
        }

        return (success) ? TestStatus.PASS : TestStatus.FAIL;

    }, 'Testing getWalletCount',
       'getWalletCount works',
       'getWalletCount doesn\'t work!');

    if (doPerformanceTests) {
        await tester.test(async () => {
            /* Reinit daemon so it has no leftover state */
            const daemon2: Daemon = new Daemon(daemonAddress, daemonPort);

            const wallet = await WalletBackend.createWallet(daemon2);

            /* Not started sync, all should be zero */
            const [a, b, c] = wallet.getSyncStatus();

            const test1: boolean = a === 0 && b === 0 && c === 0;

            await wallet.start();

            /* Wait 5 seconds */
            await delay(1000 * 5);

            await wallet.stop();

            /* Started sync, some should be non zero */
            const [d, e, f] = wallet.getSyncStatus();

            const test2: boolean = d !== 0 || e !== 0 || f !== 0;

            return (test1 && test2) ? TestStatus.PASS : TestStatus.FAIL;

        }, 'Testing getSyncStatus (5 second test)',
           'getSyncStatus works',
           'getSyncStatus doesn\'t work! (Is the blockchain cache down?)');

        await tester.test(async () => {

            /* Just random public + private keys */
            const derivation: string = await generateKeyDerivation(
                'f235acd76ee38ec4f7d95123436200f9ed74f9eb291b1454fbc30742481be1ab',
                '89df8c4d34af41a51cfae0267e8254cadd2298f9256439fa1cfa7e25ee606606',
                new Config(),
            );

            const loopIterations: number = 1000;

            const startTime = new Date().getTime();

            for (let i = 0; i < loopIterations; i++) {
                underivePublicKey(
                    derivation,
                    i,
                    '14897efad619205256d9170192e50e2fbd7959633e274d1b6f94b1087d680451',
                    new Config(),
                );
            }

            const endTime = new Date().getTime();

            const executionTime: number = endTime - startTime;

            const timePerDerivation: string = (executionTime / loopIterations).toFixed(3);

            console.log(colors.green(' ✔️  ') + `Time to perform underivePublicKey: ${timePerDerivation} ms`);

            return TestStatus.PASS;

        }, 'Testing underivePublicKey performance',
           'underivePublicKey performance test complete',
           'underivePublicKey performance test failed!');

        await tester.test(async () => {
            const loopIterations: number = 1000;

            const startTime = new Date().getTime();

            for (let i = 0; i < loopIterations; i++) {
                await generateKeyDerivation(
                    'f235acd76ee38ec4f7d95123436200f9ed74f9eb291b1454fbc30742481be1ab',
                    '89df8c4d34af41a51cfae0267e8254cadd2298f9256439fa1cfa7e25ee606606',
                    new Config(),
                );
            }

            const endTime = new Date().getTime();

            const executionTime: number = endTime - startTime;

            const timePerDerivation: string = (executionTime / loopIterations).toFixed(3);

            console.log(colors.green(' ✔️  ') + `Time to perform generateKeyDerivation: ${timePerDerivation} ms`);

            return TestStatus.PASS;

        }, 'Testing generateKeyDerivation performance',
           'generateKeyDerivation performance test complete',
           'generateKeyDerivation performance test failed!');

        await tester.test(async () => {
            const [walletTmp, ] = await WalletBackend.importWalletFromSeed(
                daemon, 0,
                'skulls woozy ouch summon gifts huts waffle ourselves obtains hexagon ' +
                'tadpoles hacksaw dormant hence abort listen history atom cadets stylishly ' +
                'snout vegan girth guest history',
            );

            const wallet = walletTmp as WalletBackend;

            const startTime = new Date().getTime();

            await wallet.start();

            /* Wait for 60 seconds */
            await delay(1000 * 60);

            wallet.stop();

            const endTime = new Date().getTime();

            const [walletBlockCount] = wallet.getSyncStatus();

            if (walletBlockCount === 0) {
                console.log(colors.red(' ❌ ') +
                    'Failed to sync with blockchain cache...');
                return TestStatus.FAIL;
            }

            const executionTime: number = endTime - startTime;

            const timePerBlock: string = (executionTime / walletBlockCount).toFixed(2);

            console.log(colors.green(' ✔️  ') + `Time to process one block: ${timePerBlock} ms`);

            return TestStatus.PASS;

        }, 'Testing wallet syncing performance (60 second test)',
           'Wallet syncing performance test complete',
           'Wallet syncing performance test failed!');
    }

    if (TurtleCoinCrypto.type === CryptoType.NODEADDON) {
        let skipLedgerTests = false;
        let TransportNodeHID: any;
        let wallet: WalletBackend;
        let transport: LedgerTransport;

        try {
            TransportNodeHID = (await import('@ledgerhq/hw-transport-node-hid')).default;

            const devices = await TransportNodeHID.list();

            if (devices.length === 0) {
                skipLedgerTests = true;
            }
        } catch (e) {
            skipLedgerTests = true;
        }

        await tester.test(async () => {
            if (skipLedgerTests) {
                return TestStatus.SKIP;
            }

            try {
                transport = await TransportNodeHID.create(1000);

                wallet = await WalletBackend.createWallet(daemon, {
                    ledgerTransport: transport
                })

                return TestStatus.PASS;
            } catch (e) {
                skipLedgerTests = true;

                return TestStatus.FAIL;
            }
        },
            'Create Wallet from Ledger',
            'Wallet Created',
            'Failed to connect to available Ledger',
            'Ledger tests skipped');

        await tester.test(async () => {
            if (skipLedgerTests) {
                return TestStatus.SKIP;
            }

            try {
                await Address.fromAddress(await wallet.getPrimaryAddress());

                return TestStatus.PASS;
            } catch (e) {
                skipLedgerTests = true;

                return TestStatus.FAIL;
            }
        },
            'Get Wallet Address',
            'Retrieved wallet address',
            'Failed to retrieve wallet address',
            'Ledger tests skipped');

        await tester.test(async () => {
            if (skipLedgerTests) {
                return TestStatus.SKIP;
            }

            if (!wallet.saveWalletToFile('tmp.wallet', 'password')) {
                skipLedgerTests = true;

                return TestStatus.FAIL
            }

            return TestStatus.PASS;
        },
            'Save Ledger Wallet',
            'Saved wallet successfully',
            'Failed to save wallet to file',
            'Ledger tests skipped');

        await tester.test(async () => {
            if (skipLedgerTests) {
                return TestStatus.SKIP;
            }

            const [, error] = await WalletBackend.openWalletFromFile(daemon, 'tmp.wallet', 'password');

            if (error) {
                return TestStatus.PASS;
            }

            return TestStatus.FAIL;
        },
            'Fail to open Ledger wallet without Ledger transport',
            'Test passed',
            'Test failed',
            'Ledger tests skipped');

        await tester.test(async () => {
            if (skipLedgerTests) {
                return TestStatus.SKIP;
            }

            const [openedWallet, error] = await WalletBackend.openWalletFromFile(daemon, 'tmp.wallet',
                'password', { ledgerTransport: transport });

            /* Remove file */
            fs.unlinkSync('tmp.wallet');

            if (error || !openedWallet) {
                return TestStatus.FAIL;
            }

            wallet = openedWallet;

            return TestStatus.PASS;
        },
            'Open Ledger wallet',
            'Test passed',
            'Test failed',
            'Ledger tests skipped');

        await tester.test(async () => {
            if (skipLedgerTests) {
                return TestStatus.SKIP;
            }

            const [, error] = await wallet.addSubWallet();

            if (error) {
                return TestStatus.PASS;
            }

            return TestStatus.FAIL;
        },
            'Fail to create subwallet for Ledger based wallet',
            'Test passed',
            'Test failed',
            'Ledger tests skipped')

        await tester.test(async () => {
            if (skipLedgerTests) {
                return TestStatus.SKIP;
            }

            const [, error] = await WalletBackend.importWalletFromLedger(
                daemon, 2000000, {
                ledgerTransport: transport});

            if (error) {
                return TestStatus.FAIL;
            }

            return TestStatus.PASS;
        },
            'Import wallet from Ledger',
            'Test passed',
            'Test failed',
            'Ledger tests skipped')
    }

    /* Print a summary of passed/failed tests */
    tester.summary();

    /* Set exit code based on if we failed any tests */
    tester.setExitCode();
})();
