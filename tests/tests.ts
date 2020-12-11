import * as _ from 'lodash';
import * as colors from 'colors';
import * as fs from 'fs';

import {
    IDaemon, Daemon, prettyPrintAmount, SUCCESS, validateAddresses,
    WalletBackend, WalletError, WalletErrorCode, LogLevel,
    isValidMnemonic, isValidMnemonicWord, createIntegratedAddress, Config,
    DaemonType,
} from '../lib/index';

import { CryptoUtils } from '../lib/CnUtils';

const doPerformanceTests: boolean = process.argv.includes('--do-performance-tests');

const daemonAddress = 'blockapi.turtlepay.io';
const daemonPort = 443;

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

        console.log(colors.white(' 📰  ')
                  + colors.white('Total tests:  ')
                  + colors.white(this.totalTests.toString()));

        console.log(colors.green(' ✔️  ')
                  + colors.white('Tests passed: ')
                  + colors.green(this.testsPassed.toString()));

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

function encryptDecryptWallet(
    wallet: WalletBackend,
    daemon: IDaemon,
    password: string): boolean {
        const encryptedString = wallet.encryptWalletToString(password);
        const [newWallet, error] = WalletBackend.openWalletFromEncryptedString(daemon, encryptedString, password);

        if (error) {
            return false;
        }

        return true;
    }

function roundTrip(
    wallet: WalletBackend,
    daemon: IDaemon,
    password: string): boolean {

    /* Save wallet to file */
    if (!wallet.saveWalletToFile('tmp.wallet', password)) {
        return false;
    }

    /* Check we can re-open saved file */
    const [loadedWallet, error] = WalletBackend.openWalletFromFile(
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
    const daemon: IDaemon = new Daemon(daemonAddress, daemonPort);

    /* Begin testing */
    await tester.test(async () => {
        /* Create a new wallet */
        const wallet = WalletBackend.createWallet(daemon);

        /* Convert the wallet to JSON */
        const initialJSON = JSON.stringify(wallet, null, 4);

        /* Load a new wallet from the dumped JSON */
        const [loadedWallet, error] = WalletBackend.loadWalletFromJSON(daemon, initialJSON);

        /* Re-dump to JSON  */
        const finalJSON = JSON.stringify(loadedWallet, null, 4);

        return initialJSON === finalJSON;

    }, 'Checking wallet JSON serialization',
       'Wallet serialization was successful',
       'Initial JSON is not equal to final json!');

    await tester.test(async () => {
        /* Load a test file to check compatibility with C++ wallet backend */
        const [testWallet, error] = WalletBackend.openWalletFromFile(
            daemon, './tests/test.wallet', 'password',
        );

        return error === undefined;

    }, 'Loading test wallet file',
       'Wallet loading succeeded',
       'Wallet loading failed');

    await tester.test(async () => {
        try {
            const wallet = WalletBackend.createWallet(daemon);

            if (!roundTrip(wallet, daemon, 'password')) {
                return false;
            }

            /* Verify loaded wallet runs */
            await wallet.start();

            await delay(1000 * 2);

            await wallet.stop();

        } catch (err) {
            return false;
        }

        return true;

    }, 'Checking can open saved file',
       'Can open saved file',
       'Can\'t open saved file!');

    await tester.test(async () => {
        const wallet = WalletBackend.createWallet(daemon);

        /* Blank password */
        const test1: boolean = roundTrip(
            wallet, daemon, '',
        );

        /* Nipponese */
        const test2: boolean = roundTrip(
            wallet, daemon, 'お前はもう死んでいる',
        );

        /* A variety of unicode symbols, suggested by VMware */
        const test3: boolean = roundTrip(
            wallet, daemon, '表ポあA鷗ŒéＢ逍Üßªąñ丂㐀𠀀',
        );

        /* Emojis */
        const test4: boolean = roundTrip(
            wallet, daemon, '❤️ 💔 💌 💕 💞 💓 💗 💖 💘 💝 💟 💜 💛 💚 💙',
        );

        /* Right to left test */
        const test5: boolean = roundTrip(
            wallet, daemon, 'בְּרֵאשִׁית, בָּרָא אֱלֹהִים, אֵת הַשָּׁמַיִם, וְאֵת הָאָרֶץ',
        );

        /* Cyrillic */
        const test6: boolean = roundTrip(
            wallet, daemon, 'Дайте советов чтоли!',
        );

        return test1 && test2 && test3 && test4 && test5 && test6;

    }, 'Verifying special passwords work as expected',
       'Special passwords work as expected',
       'Special passwords do not work as expected!');

    await tester.test(async () => {
        const wallet = WalletBackend.createWallet(daemon);

        return encryptDecryptWallet(wallet, daemon, 'password');
    },  'Verifying wallet encryption and decryption work as expected',
        'Encrypt/Decrypt wallet works as expected',
        'Encrypt/Decrypt wallet does not work as expected!');

    await tester.test(async () => {
        const [seedWallet, error] = WalletBackend.importWalletFromSeed(
            daemon, 0,
            'skulls woozy ouch summon gifts huts waffle ourselves obtains hexagon ' +
            'tadpoles hacksaw dormant hence abort listen history atom cadets stylishly ' +
            'snout vegan girth guest history',
        );

        const [privateSpendKey, privateViewKey]
            = (seedWallet as WalletBackend).getPrimaryAddressPrivateKeys();

        return privateSpendKey === 'd61a57a59318d70ff77cc7f8ad7f62887c828da1d5d3f3b0d2f7d3fa596c2904'
            && privateViewKey === '688e5229df6463ec4c27f6ee11c3f1d3d4b4d2480c0aabe64fb807182cfdc801';

    }, 'Verifying seed restore works correctly',
       'Mnemonic seed wallet has correct keys',
       'Mnemonic seed wallet has incorrect keys!');

    await tester.test(async () => {
        const [keyWallet, error] = WalletBackend.importWalletFromKeys(
            daemon, 0,
            '688e5229df6463ec4c27f6ee11c3f1d3d4b4d2480c0aabe64fb807182cfdc801',
            'd61a57a59318d70ff77cc7f8ad7f62887c828da1d5d3f3b0d2f7d3fa596c2904',
        );

        const [seed, error2] = (keyWallet as WalletBackend).getMnemonicSeed();

        return seed === 'skulls woozy ouch summon gifts huts waffle ourselves obtains ' +
                        'hexagon tadpoles hacksaw dormant hence abort listen history ' +
                        'atom cadets stylishly snout vegan girth guest history';

    }, 'Verifying key restore works correctly',
       'Deterministic key wallet has correct seed',
       'Deterministic key wallet has incorrect seed!');

    await tester.test(async () => {
        const [keyWallet, error] = WalletBackend.importWalletFromKeys(
            daemon, 0,
            '1f3f6c220dd9f97619dbf44d967f79f3041b9b1c63da2c895f980f1411d5d704',
            '55e0aa4ca65c0ae016c7364eec313f56fc162901ead0e38a9f846686ac78560f',
        );

        const [seed, err] = (keyWallet as WalletBackend).getMnemonicSeed();

        return (err as WalletError).errorCode === WalletErrorCode.KEYS_NOT_DETERMINISTIC;

    }, 'Verifying non deterministic wallet doesn\'t create seed',
       'Non deterministic wallet has no seed',
       'Non deterministic wallet has seed!');

    await tester.test(async () => {
        const [viewWallet, error] = WalletBackend.importViewWallet(
            daemon, 0,
            '3c6cfe7a29a371278abd9f5725a3d2af5eb73d88b4ed9b8d6c2ff993bbc4c20a',
            'TRTLuybJFCU8BjP18bH3VZCNAu1fZ2r3d85SsU2w3VnJAHoRfnzLKgtTK2b58nfwDu59hKxwVuSMhTN31gmUW8nN9aoAN9N8Qyb',
        );

        const [privateSpendKey, privateViewKey] = (viewWallet as WalletBackend).getPrimaryAddressPrivateKeys();

        return privateSpendKey === '0'.repeat(64);

    }, 'Verifying view wallet has null private spend key',
       'View wallet has null private spend key',
       'View wallet has private spend key!');

    await tester.test(async () => {
        const [seedWallet, error] = WalletBackend.importWalletFromSeed(
            daemon, 0,
            'skulls woozy ouch summon gifts huts waffle ourselves obtains hexagon ' +
            'tadpoles hacksaw dormant hence abort listen history atom cadets stylishly ' +
            'snout vegan girth guest history',
        );

        const address = (seedWallet as WalletBackend).getPrimaryAddress();

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

        const [seed, err1] = wallet.getMnemonicSeedForAddress('');

        /* Verify invalid address is detected */
        const test1: boolean = (err1 as WalletError).errorCode === WalletErrorCode.ADDRESS_WRONG_LENGTH;

        const [seed2, err2] = wallet.getMnemonicSeedForAddress(
            'TRTLv1s9JQeHAJFoHvcqVBPyHYom2ynKeK6dpYptbp8gQNzdzE73ZD' +
            'kNmNurqfhhcMSUXpS1ZGEJKiKJUcPCyw7vYaCc354DCN1',
        );

        /* Random address shouldn't be present in wallet */
        const test2: boolean = _.isEqual(err2, new WalletError(WalletErrorCode.ADDRESS_NOT_IN_WALLET));

        /* Should get a seed back when we supply our address */
        const test3: boolean = wallet.getMnemonicSeedForAddress(wallet.getPrimaryAddress())[0] !== undefined;

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

        return _.isEqual(err, SUCCESS);

    }, 'Testing getPrimaryAddress',
       'getPrimaryAddress works',
       'getPrimaryAddress doesn\'t work!');

    await tester.test(async () => {
        const privateViewKey: string = '3c6cfe7a29a371278abd9f5725a3d2af5eb73d88b4ed9b8d6c2ff993bbc4c20a';

        const [viewWallet, error] = WalletBackend.importViewWallet(
            daemon, 0,
            privateViewKey,
            'TRTLuybJFCU8BjP18bH3VZCNAu1fZ2r3d85SsU2w3VnJAHoRfnzLKgtTK2b58nfwDu59hKxwVuSMhTN31gmUW8nN9aoAN9N8Qyb',
        );

        return (viewWallet as WalletBackend).getPrivateViewKey() === privateViewKey;

    }, 'Testing getPrivateViewKey',
       'getPrivateViewKey works',
       'getPrivateViewKey doesn\'t work!');

    await tester.test(async () => {
        const [keyWallet, error] = WalletBackend.importWalletFromKeys(
            daemon, 0,
            '1f3f6c220dd9f97619dbf44d967f79f3041b9b1c63da2c895f980f1411d5d704',
            '55e0aa4ca65c0ae016c7364eec313f56fc162901ead0e38a9f846686ac78560f',
        );

        const wallet = keyWallet as WalletBackend;

        const [publicSpendKey, privateSpendKey, error2]
            = wallet.getSpendKeys(wallet.getPrimaryAddress());

        return publicSpendKey === 'ff9b6e048297ee435d6219005974c2c8df620a4aca9ca5c4e13f071823482029' &&
               privateSpendKey === '55e0aa4ca65c0ae016c7364eec313f56fc162901ead0e38a9f846686ac78560f';

    }, 'Testing getSpendKeys',
       'getSpendKeys works',
       'getSpendKeys doesn\'t work!');

    await tester.test(async () => {
        let address;
        try {
        address = createIntegratedAddress(
            'TRTLv2Fyavy8CXG8BPEbNeCHFZ1fuDCYCZ3vW5H5LXN4K2M2MHUpTENip9bbavpHvvPwb4NDkBWrNgURAd5DB38FHXWZyoBh4wW',
            'b23df6e84c1dd619d3601a28e5948d92a0d096aea1621969c591a90e986794a0',
        );
        } catch (err) {
            console.log(JSON.stringify(err));
        }

        const test1: boolean = address === 'TRTLuyzDT8wJ6bAmnmBLyRHmBNrRrafuR9G3bJTNzPiTAS4xKDQKHd9Aa2sF2q22DF9EXi5HNpZGcHGBwqgVAqc2AZxUBMMSegm8CXG8BPEbNeCHFZ1fuDCYCZ3vW5H5LXN4K2M2MHUpTENip9bbavpHvvPwb4NDkBWrNgURAd5DB38FHXWZyhJk2yR';

        let test2: boolean = false;

        try {
            createIntegratedAddress('TRTLv2Fyavy8CXG8BPEbNeCHFZ1fuDCYCZ3vW5H5LXN4K2M2MHUpTENip9bbavpHvvPwb4NDkBWrNgURAd5DB38FHXWZyoBh4wW', '');
        } catch (err) {
            test2 = true;
        }

        let test3: boolean = false;

        try {
            createIntegratedAddress('', 'b23df6e84c1dd619d3601a28e5948d92a0d096aea1621969c591a90e986794a0');
        } catch (err) {
            test3 = true;
        }

        return test1 && test2 && test3;

    }, 'Testing createIntegratedAddress',
       'createIntegratedAddress works',
       'createIntegratedAddress doesn\'t work!');

    await tester.test(async () => {
        const [keyWallet, error] = WalletBackend.importWalletFromKeys(
            daemon, 0,
            '1f3f6c220dd9f97619dbf44d967f79f3041b9b1c63da2c895f980f1411d5d704',
            '55e0aa4ca65c0ae016c7364eec313f56fc162901ead0e38a9f846686ac78560f', {
                addressPrefix: 8411,
            },
        );

        const address: string = (keyWallet as WalletBackend).getPrimaryAddress();

        return address === 'dg5NZstxyAegrTA1Z771tPZaf13V6YHAjUjAieQfjwCb6P1eYHuMmwRcDcQ1eAs41sQrh98FjBXn257HZzh2CCwE2spKE2gmA';

    }, 'Testing supplied config is applied',
       'Supplied config applied correctly',
       'Supplied config not applied!');

    await tester.test(async () => {
        const test1: boolean = !isValidMnemonicWord('aaaaa');
        const test2: boolean = isValidMnemonicWord('abbey');
        const test3: boolean = isValidMnemonic('nugget lazy gang sonic vulture exit veteran poverty affair ringing opus soapy sonic afield dating lectures worry tuxedo ruffled rated locker bested aunt bifocals opus')[0];
        const test4: boolean = !isValidMnemonic('')[0];
        const test5: boolean = !isValidMnemonic('nugget lazy gang sonic vulture exit veteran poverty affair ringing opus soapy sonic afield dating lectures worry tuxedo ruffled rated locker bested aunt bifocals soapy')[0];
        const test6: boolean = !isValidMnemonic('a lazy gang sonic vulture exit veteran poverty affair ringing opus soapy sonic afield dating lectures worry tuxedo ruffled rated locker bested aunt bifocals opus')[0];

        return test1 && test2 && test3 && test4 && test5 && test6;

    }, 'Testing isValidMnemonic',
       'isValidMnemonic works',
       'isValidMnemonic doesn\'t work!');

    await tester.test(async () => {
        const daemon2: IDaemon = new Daemon('127.0.0.1', 11898);

        const wallet = WalletBackend.createWallet(daemon2);

        await wallet.start();

        const daemon3: IDaemon = new Daemon(daemonAddress, daemonPort);

        await wallet.swapNode(daemon3);

        const info = wallet.getDaemonConnectionInfo();

        await wallet.stop();

        return _.isEqual(info, {
            daemonType: DaemonType.BlockchainCacheApi,
            daemonTypeDetermined: true,
            host: daemonAddress,
            port: daemonPort,
            ssl: true,
            sslDetermined: true,
        });

    }, 'Testing swapNode',
       'swapNode works',
       'swapNode doesn\'t work!');

    await tester.test(async () => {
        const daemon2: IDaemon = new Daemon('this is not a valid host', 7777);

        let success: boolean = false;

        daemon2.on('disconnect', (err) => {
            success = true;
        });

        await daemon2.init();

        const daemon3: IDaemon = new Daemon(daemonAddress, daemonPort);

        daemon3.on('disconnect', (err) => {
            success = false;
        });

        await daemon3.init();

        return success;

    }, 'Testing daemon events',
       'Daemon events work',
       'Daemon events don\'t work!');

    await tester.test(async () => {
        /* Load a test file to check compatibility with C++ wallet backend */
        const [testWallet, error] = WalletBackend.openWalletFromFile(
            daemon, './tests/test.wallet', 'password',
        );

        const wallet = testWallet as WalletBackend;

        const a = wallet.getNumTransactions() === 3;

        let [ unlockedBalance, lockedBalance ] = wallet.getBalance();

        const c = unlockedBalance === 246 && lockedBalance === 167;

        await wallet.rewind(1026200);

        const b = wallet.getNumTransactions() === 1;

        [ unlockedBalance, lockedBalance ] = wallet.getBalance();

        const d = unlockedBalance === 1234 && lockedBalance === 0;

        return a && b && c && d;

    }, 'Testing rewind',
       'Rewind succeeded',
       'Rewind failed');

    await tester.test(async () => {
        const [keyWallet, error] = WalletBackend.importWalletFromKeys(
            daemon, 0,
            '1f3f6c220dd9f97619dbf44d967f79f3041b9b1c63da2c895f980f1411d5d704',
            '55e0aa4ca65c0ae016c7364eec313f56fc162901ead0e38a9f846686ac78560f',
        );

        const wallet = keyWallet as WalletBackend;

        const [address1, error1] = await wallet.importSubWallet('c93d9e2e71ea018e7b0cec89c260f2d00d3f88ede16b3532f4ae04596ab38001');

        const a = address1 === 'TRTLuxZPMVRHTq27oJFmwzd85wVr2ddhM2gqXcDAp1NiDKjCMwBT98BEaCRGvRc8uXEeoz5PaR5EgDZd1FTbCeVeYFqjbp6Wx2H';

        const b = wallet.getPrimaryAddress() === 'TRTLv41arQbNqvP1x4MuTVFxqVydgF2PBatbBKdER2LP6uH56q3s4EbEaCRGvRc8uXEeoz5PaR5EgDZd1FTbCeVeYFqjbj5LyQQ';

        const [address2, error2] = await wallet.importSubWallet('c93d9e2e71ea018e7b0cec89c260f2d00d3f88ede16b3532f4ae04596ab38001');

        const c = (error2 as WalletError).errorCode === WalletErrorCode.SUBWALLET_ALREADY_EXISTS;

        return a && b && c;

    }, 'Testing subwallets',
       'Subwallets work',
       'Subwallet tests don\'t work!');

    await tester.test(async () => {
        const wallet = WalletBackend.createWallet(daemon);

        let success = true;

        for (let i = 2; i < 10; i++) {
            wallet.addSubWallet();

            if (wallet.getWalletCount() !== i) {
                success = false;
            }
        }

        return success;

    }, 'Testing getWalletCount',
       'getWalletCount works',
       'getWalletCount doesn\'t work!');

    if (doPerformanceTests) {
        await tester.test(async () => {
            /* Reinit daemon so it has no leftover state */
            const daemon2: IDaemon = new Daemon(daemonAddress, daemonPort);

            const wallet = WalletBackend.createWallet(daemon2);

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
           'getSyncStatus doesn\'t work! (Is the blockchain cache down?)');

        await tester.test(async () => {

            /* Just random public + private keys */
            const derivation: string = CryptoUtils(new Config()).generateKeyDerivation(
                'f235acd76ee38ec4f7d95123436200f9ed74f9eb291b1454fbc30742481be1ab',
                '89df8c4d34af41a51cfae0267e8254cadd2298f9256439fa1cfa7e25ee606606',
            );

            const loopIterations: number = 6000;

            const startTime = new Date().getTime();

            for (let i = 0; i < loopIterations; i++) {
                /* Use i as output index to prevent optimization */
                const derivedOutputKey = CryptoUtils(new Config()).underivePublicKey(
                    derivation, i,
                    '14897efad619205256d9170192e50e2fbd7959633e274d1b6f94b1087d680451',
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
                const derivation: string = CryptoUtils(new Config()).generateKeyDerivation(
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
            const [walletTmp, error] = WalletBackend.importWalletFromSeed(
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
                return false;
            }

            const executionTime: number = endTime - startTime;

            const timePerBlock: string = (executionTime / walletBlockCount).toFixed(2);

            console.log(colors.green(' ✔️  ') + `Time to process one block: ${timePerBlock} ms`);

            return true;

        }, 'Testing wallet syncing performance (60 second test)',
           'Wallet syncing performance test complete',
           'Wallet syncing performance test failed!');
    }

    /* Print a summary of passed/failed tests */
    tester.summary();

    /* Set exit code based on if we failed any tests */
    tester.setExitCode();
})();
