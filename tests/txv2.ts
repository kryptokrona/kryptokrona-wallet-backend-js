// Copyright (c) 2026, The Kryptokrona Developers
//
// Please see the included LICENSE file for more information.

/*
 * Transaction version 2 (fork 14) tests: view tags, the view-tag scan, the
 * daemon's tx_versions, the version choice, mixin limits and version 2 sends.
 *
 * Runs offline: the daemon is mocked with the recorded answers of
 * tests/vectors/tx-v2-walletsync.json (see tests/vectors/README.md).
 *
 * Run with `npm run test-v2` (builds, then `node dist/tests/txv2.js`).
 */

import * as _ from 'lodash';
import * as colors from 'colors';
import * as fs from 'fs';
import * as path from 'path';

import {
    Daemon, WalletBackend, WalletErrorCode, Config, FeeType,
    MixinLimit, MixinLimits, chooseTransactionVersion, parseTransactionVersions,
} from '../lib/index';

import {
    generateKeyDerivation, underivePublicKey, deriveViewTag, computeViewTag,
} from '../lib/CryptoWrapper';

import { validateMixin } from '../lib/ValidateParameters';
import { estimateTransactionSize } from '../lib/Utilities';
import { KeyOutput } from '../lib/Types';

import {
    Crypto, Transaction as UtilsTransaction, TransactionOutputs, TransactionInputs,
    hasClsagSupport,
} from 'kryptokrona-utils';

class Tester {

    public totalTests: number = 0;
    public testsFailed: number = 0;
    public testsPassed: number = 0;

    constructor() {
        console.log(colors.yellow('=== Started transaction version 2 tests ===\n'));
    }

    public async test(
        testFunc: () => Promise<boolean>,
        testDescription: string,
        successMsg: string,
        failMsg: string) {

        console.log(colors.yellow(`=== ${testDescription} ===`));

        let success = false;

        try {
            success = await testFunc();
        } catch (err) {
            console.log(`Error executing test: ${err && err.stack ? err.stack : err}`);
        }

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

/* Prints a failed check and returns false, so a test can `return check(...) && ...` */
function check(condition: boolean, message: string): boolean {
    if (!condition) {
        console.log(colors.red('    check failed: ') + message);
    }

    return condition;
}

function loadVector(name: string): any {
    /* dist/tests/txv2.js -> tests/vectors, or tests/txv2.ts -> tests/vectors */
    const candidates: string[] = [
        path.join(__dirname, '..', '..', 'tests', 'vectors', name),
        path.join(__dirname, 'vectors', name),
        path.join(process.cwd(), 'tests', 'vectors', name),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return JSON.parse(fs.readFileSync(candidate, 'utf8'));
        }
    }

    throw new Error(`Test vector ${name} not found (looked in ${candidates.join(', ')})`);
}

const syncVector: any = loadVector('tx-v2-walletsync.json');
const viewTagVector: any = loadVector('tx-v2-view-tags.json');

const primaryKeys: any = syncVector.subwallets.find((w: any) => w.name === 'primary');
const subWalletKeys: any = syncVector.subwallets.find((w: any) => w.name === 'subwallet');

/* A foreign wallet to send to (view and spend secrets known, so the test can scan its outputs) */
const destinationKeys: any = viewTagVector.wallets.find((w: any) => w.name === 'wallet_1');

const spendKeyOfSubwallet: Map<string, string> = new Map([
    ['primary', primaryKeys.spend_public],
    ['subwallet', subWalletKeys.spend_public],
]);

const syncItems: any[] = syncVector.getwalletsyncdata.response.items;
const lastHeight: number = _.max(syncItems.map((item: any) => item.blockHeight)) as number;

const heightOfBlockHash: Map<string, number> = new Map(
    syncItems.map((item: any) => [item.blockHash, item.blockHeight] as [string, number]),
);

/* Output keys of the recorded chain that do not belong to the test wallet,
   used as ring members (decoys) by the mocked /getrandom_outs */
const ownKeys: Set<string> = new Set(syncVector.expected.outputs.map((o: any) => o.key));

const foreignKeys: string[] = _.uniq(_.flatten(syncItems.map((item: any) => {
    const transactions = [item.coinbaseTX].concat(item.transactions);
    return _.flatten(transactions.map((tx: any) => tx.outputs.map((o: any) => o.key)));
}))).filter((key: string) => !ownKeys.has(key)) as string[];

interface MockState {
    /* The /info answer */
    info: any;

    /* Serve blocks up to and including this height */
    maxHeight: number;

    /* Remove view_tag from every output of the sync data */
    stripViewTags: boolean;

    /* Answer of /sendrawtransaction, { status: 'OK' } if undefined */
    sendResult?: any;

    /* Transactions given to /sendrawtransaction */
    sent: string[];

    /* Endpoints called */
    requests: string[];
}

function newMockState(infoIndex: number, overrides: Partial<MockState> = {}): MockState {
    return {
        info: _.cloneDeep(syncVector.getinfo[infoIndex].response),
        maxHeight: lastHeight,
        stripViewTags: false,
        sent: [],
        requests: [],
        ...overrides,
    };
}

/* A /info answer for a daemon whose top block is `topHeight`, with the given tx_versions */
function infoAt(topHeight: number, txVersions?: number[]): any {
    const info = _.cloneDeep(syncVector.getinfo[2].response);

    info.height = topHeight + 1;
    info.network_height = topHeight + 1;
    info.last_known_block_index = topHeight;

    if (txVersions === undefined) {
        delete info.tx_versions;
    } else {
        info.tx_versions = txVersions;
    }

    return info;
}

function mockAnswer(state: MockState, endpoint: string, body: any): any {
    switch (endpoint) {
        case '/info':
        case '/getinfo': {
            return state.info;
        }
        case '/fee': {
            return { address: '', amount: 0, status: 'OK' };
        }
        case '/getwalletsyncdata': {
            const checkpoints: string[] = (body && body.blockHashCheckpoints) || [];

            let from: number = (body && body.startHeight) || 0;

            for (const hash of checkpoints) {
                const height = heightOfBlockHash.get(hash);

                if (height !== undefined) {
                    from = Math.max(from, height + 1);
                }
            }

            const items = _.cloneDeep(syncItems.filter((item: any) => {
                return item.blockHeight >= from && item.blockHeight <= state.maxHeight;
            }));

            if (state.stripViewTags) {
                for (const item of items) {
                    for (const tx of [item.coinbaseTX].concat(item.transactions)) {
                        for (const output of tx.outputs) {
                            delete output.view_tag;
                        }
                    }
                }
            }

            return { items, status: 'OK' };
        }
        case '/get_global_indexes_for_range': {
            return syncVector.get_global_indexes_for_range.response;
        }
        case '/get_pool_changes_lite': {
            return syncVector.get_pool_changes_lite.response;
        }
        case '/get_transactions_status': {
            return { transactionsInBlock: [], transactionsInPool: [], transactionsUnknown: [], status: 'OK' };
        }
        case '/getrandom_outs': {
            const amounts: number[] = body.amounts;
            const count: number = body.outs_count;

            return {
                outs: amounts.map((amount: number, i: number) => {
                    const outs = [];

                    for (let k = 0; k < count; k++) {
                        outs.push({
                            /* Global indexes far from the real ones (0 and 1) */
                            global_amount_index: 100 + k,
                            out_key: foreignKeys[(i * count + k) % foreignKeys.length],
                        });
                    }

                    return { amount, outs };
                }),
                status: 'OK',
            };
        }
        case '/sendrawtransaction': {
            state.sent.push(body.tx_as_hex);

            return state.sendResult || { status: 'OK' };
        }
        default: {
            throw new Error(`Mock daemon: unexpected request ${endpoint}`);
        }
    }
}

function mockDaemon(state: MockState): Daemon {
    const daemon = new Daemon('127.0.0.1', 11898, false, false);

    /* Replace the HTTP layer: every request is answered from the recorded data */
    (daemon as any).makeRequest = async (endpoint: string, method: string, body?: any) => {
        state.requests.push(endpoint);

        return _.cloneDeep(mockAnswer(state, endpoint, body));
    };

    return daemon;
}

/* Imports the vector's wallet (primary + subwallet) and syncs it from the mocked daemon */
async function syncedWallet(state: MockState, config: any = {}): Promise<[WalletBackend, Daemon]> {
    const daemon = mockDaemon(state);

    const [wallet, error] = await WalletBackend.importWalletFromKeys(
        daemon, 1, primaryKeys.view_secret, primaryKeys.spend_secret,
        { scanCoinbaseTransactions: true, ...config },
    );

    if (error || !wallet) {
        throw new Error(`importWalletFromKeys failed: ${error}`);
    }

    const [, subError] = await wallet.importSubWallet(subWalletKeys.spend_secret, 1);

    if (subError) {
        throw new Error(`importSubWallet failed: ${subError}`);
    }

    await daemon.init();

    /* Drive the block processing directly instead of starting the timers */
    for (let i = 0; i < 20 && wallet.getSyncStatus()[0] < state.maxHeight; i++) {
        await (wallet as any).processBlocks(false);
    }

    if (wallet.getSyncStatus()[0] !== state.maxHeight) {
        throw new Error(`Wallet synced to ${wallet.getSyncStatus()[0]}, expected ${state.maxHeight}`);
    }

    return [wallet, daemon];
}

/* The SubWallet object (internal) owning the given public spend key */
function subWalletOf(wallet: WalletBackend, publicSpendKey: string): any {
    return (wallet as any).subWallets.subWallets.get(publicSpendKey);
}

function allInputs(wallet: WalletBackend): any[] {
    const result: any[] = [];

    for (const subWallet of (wallet as any).subWallets.subWallets.values()) {
        result.push(...subWallet.unspentInputs, ...subWallet.lockedInputs, ...subWallet.spentInputs);
    }

    return result;
}

/* Checks the wallet found exactly the vector's outputs, with the right key images and spends */
function checkFoundOutputs(wallet: WalletBackend): boolean {
    let ok = true;

    const inputs = allInputs(wallet);

    ok = check(inputs.length === syncVector.expected.outputs.length,
        `found ${inputs.length} outputs, expected ${syncVector.expected.outputs.length}`) && ok;

    for (const expected of syncVector.expected.outputs) {
        const owner = spendKeyOfSubwallet.get(expected.subwallet) as string;
        const subWallet = subWalletOf(wallet, owner);

        const input = [...subWallet.unspentInputs, ...subWallet.lockedInputs, ...subWallet.spentInputs]
            .find((i: any) => i.key === expected.key);

        if (!check(input !== undefined, `output ${expected.tx_hash}:${expected.index} not found in ${expected.subwallet}`)) {
            ok = false;
            continue;
        }

        ok = check(input.amount === expected.amount, `amount of ${expected.key}`) && ok;
        ok = check(input.keyImage === expected.key_image, `key image of ${expected.key}`) && ok;
        ok = check(input.transactionIndex === expected.index, `index of ${expected.key}`) && ok;
        ok = check(input.globalOutputIndex === expected.global_index, `global index of ${expected.key}`) && ok;
        ok = check(input.blockHeight === expected.height, `height of ${expected.key}`) && ok;
        ok = check(input.parentTransactionHash === expected.tx_hash, `transaction of ${expected.key}`) && ok;
    }

    for (const spent of syncVector.expected.spent) {
        const input = inputs.find((i: any) => i.keyImage === spent.key_image);

        ok = check(input !== undefined && input.spendHeight === spent.height,
            `key image ${spent.key_image} spent at ${spent.height}`) && ok;
    }

    const spentImages: string[] = syncVector.expected.spent.map((s: any) => s.key_image);

    for (const input of inputs) {
        if (!spentImages.includes(input.keyImage)) {
            ok = check(input.spendHeight === 0, `key image ${input.keyImage} must be unspent`) && ok;
        }
    }

    return ok;
}

function expectedScanStats(): any {
    const stats = syncVector.expected.scan_stats;

    return {
        outputs: stats.outputs,
        tagged: stats.tagged,
        skippedByTag: stats.skipped_by_tag,
        fullChecks: stats.full_checks,
    };
}

/* Which wallet owns output `index` of `tx` (by view tag and key), or undefined */
async function outputOwner(
    tx: UtilsTransaction,
    index: number,
    wallets: Array<{ name: string, viewSecret: string, spendPublic: string }>): Promise<string | undefined> {

    const output = tx.outputs[index] as TransactionOutputs.KeyOutput;
    const config = new Config();

    for (const w of wallets) {
        const derivation = await generateKeyDerivation(tx.publicKey as string, w.viewSecret, config);

        if (output.viewTag !== undefined && output.viewTag !== await deriveViewTag(derivation, index, config)) {
            continue;
        }

        if (await underivePublicKey(derivation, index, output.key, config) === w.spendPublic) {
            return w.name;
        }
    }

    return undefined;
}

const transferWallets = [
    { name: 'change', viewSecret: primaryKeys.view_secret, spendPublic: primaryKeys.spend_public },
    { name: 'destination', viewSecret: destinationKeys.view_secret, spendPublic: destinationKeys.spend_public },
];

/* Checks a built transaction: version, output kinds and view tags, signatures, owners and amounts */
async function checkBuiltTransaction(
    blob: string,
    expectedVersion: number,
    amount: number,
    fee: number): Promise<boolean> {

    const tx = await UtilsTransaction.from(blob);

    let ok = check(tx.version === expectedVersion, `transaction version ${tx.version}, expected ${expectedVersion}`);

    ok = check(tx.fee === fee, `fee ${tx.fee}, expected ${fee}`) && ok;

    let toDestination = 0;
    let toChange = 0;

    for (const [index, o] of tx.outputs.entries()) {
        const output = o as TransactionOutputs.KeyOutput;

        if (expectedVersion >= 2) {
            ok = check(output.type === TransactionOutputs.OutputType.TAGGED_KEY && output.viewTag !== undefined,
                `output ${index} must be tagged`) && ok;
        } else {
            ok = check(output.type === TransactionOutputs.OutputType.KEY && output.viewTag === undefined,
                `output ${index} must be untagged`) && ok;
        }

        const owner = await outputOwner(tx, index, transferWallets);

        ok = check(owner !== undefined, `output ${index} belongs to neither the destination nor the change`) && ok;

        if (owner === 'destination') {
            toDestination += output.amount.toJSNumber();
        } else if (owner === 'change') {
            toChange += output.amount.toJSNumber();
        }
    }

    const inputTotal = _.sumBy(tx.inputs, (i) => (i as TransactionInputs.KeyInput).amount.toJSNumber());

    ok = check(toDestination === amount, `destination got ${toDestination}, expected ${amount}`) && ok;
    ok = check(toChange === inputTotal - amount - fee, `change ${toChange}, expected ${inputTotal - amount - fee}`) && ok;

    if (expectedVersion >= 2) {
        ok = check(tx.clsagSignatures.length === tx.inputs.length, 'one CLSAG per input') && ok;
        ok = check(tx.signatures.length === 0, 'no ring signatures in version 2') && ok;

        for (const [i, input] of tx.inputs.entries()) {
            const ringSize = (input as TransactionInputs.KeyInput).keyOffsets.length;

            ok = check(tx.clsagSignatures[i].s.length === ringSize, `CLSAG ${i} has one response per ring member`) && ok;
        }
    } else {
        ok = check(tx.signatures.length === tx.inputs.length, 'one ring signature per input') && ok;
        ok = check((tx.clsagSignatures || []).length === 0, 'no CLSAG in version 1') && ok;
    }

    /* Transaction ids are cn_fast_hash(blob) for every version */
    const hash = await new Crypto().cn_fast_hash(blob);

    ok = check(await tx.hash() === hash, 'transaction hash is cn_fast_hash(blob)') && ok;

    return ok;
}

(async () => {
    const tester: Tester = new Tester();

    if (!hasClsagSupport()) {
        console.log(colors.red('The loaded kryptokrona-crypto has no CLSAG support (needs 1.1.0 or ' +
                               'later): the version 2 send tests will fail.\n'));
    }

    await tester.test(async () => {
        const config = new Config();

        let ok = true;

        for (const v of viewTagVector.monero) {
            const tag = await deriveViewTag(v.derivation, v.index, config);
            const fallback = await computeViewTag(v.derivation, v.index, config);

            ok = check(tag === v.view_tag, `view_tag(${v.derivation}, ${v.index}) = ${tag}, expected ${v.view_tag}`) && ok;
            ok = check(fallback === v.view_tag, `cn_fast_hash view tag of index ${v.index} = ${fallback}`) && ok;
        }

        for (const t of viewTagVector.transactions) {
            const w = viewTagVector.wallets.find((x: any) => x.name === t.wallet);

            /* Recipient side: the derivation from R and the view secret equals the sender's */
            const derivation = await generateKeyDerivation(t.tx_public_key, w.view_secret, config);

            ok = check(derivation === t.derivation, `derivation of ${t.tx_public_key}`) && ok;

            for (const tag of t.tags) {
                ok = check(await deriveViewTag(t.derivation, tag.index, config) === tag.view_tag,
                    `view tag of index ${tag.index}`) && ok;
                ok = check(await computeViewTag(t.derivation, tag.index, config) === tag.view_tag,
                    `cn_fast_hash view tag of index ${tag.index} (varint ${tag.index_varint})`) && ok;
            }
        }

        return ok;

    }, 'Checking view tags against the vectors',
       'View tags match the Rust and Monero vectors',
       'View tags do not match the vectors!');

    await tester.test(async () => {
        const tagged = KeyOutput.fromJSON({ amount: 200000, key: 'aa'.repeat(32), view_tag: '5E' });
        const untagged = KeyOutput.fromJSON({ amount: 200000, key: 'aa'.repeat(32) });
        const malformed = KeyOutput.fromJSON({ amount: 200000, key: 'aa'.repeat(32), view_tag: '5' });
        const constructed = new KeyOutput('aa'.repeat(32), 1, 'F0');

        return check(tagged.viewTag === '5e', 'view_tag is read and lower-cased')
            && check(untagged.viewTag === undefined && !untagged.hasOwnProperty('viewTag'), 'no view tag')
            && check(malformed.viewTag === undefined, 'a malformed view tag is ignored')
            && check(constructed.viewTag === 'f0', 'constructor view tag');

    }, 'Checking view_tag parsing of /getwalletsyncdata outputs',
       'view_tag is parsed into KeyOutput',
       'view_tag parsing does not work!');

    await tester.test(async () => {
        const state = newMockState(2, { info: infoAt(lastHeight, [2]) });
        const [wallet] = await syncedWallet(state);

        let ok = check(wallet.getPrimaryAddress() === primaryKeys.address, 'primary address');

        ok = check(wallet.getAddresses().includes(subWalletKeys.address), 'subwallet address') && ok;

        ok = checkFoundOutputs(wallet) && ok;

        const [unlocked, locked] = await wallet.getBalance();

        ok = check(unlocked + locked === syncVector.expected.unspent_balance,
            `balance ${unlocked} + ${locked}, expected ${syncVector.expected.unspent_balance}`) && ok;

        ok = check(await wallet.getNumTransactions() === 6, `${await wallet.getNumTransactions()} transactions, expected 6`) && ok;

        const stats = wallet.getScanStats();

        console.log(`    scan: ${JSON.stringify(stats)}`);

        ok = check(_.isEqual(stats, expectedScanStats()),
            `scan stats ${JSON.stringify(stats)}, expected ${JSON.stringify(expectedScanStats())}`) && ok;

        return ok;

    }, 'Replaying the recorded fork 14 sync data (view-tag scan)',
       'Found outputs, key images, spends, balance and scan counts match the vector',
       'The view-tag scan does not match the vector!');

    await tester.test(async () => {
        const state = newMockState(2, { info: infoAt(lastHeight, [2]), stripViewTags: true });
        const [wallet] = await syncedWallet(state);

        const stats = wallet.getScanStats();
        const total = syncVector.expected.scan_stats.outputs;

        return checkFoundOutputs(wallet)
            && check(_.isEqual(stats, { outputs: total, tagged: 0, skippedByTag: 0, fullChecks: total }),
                `scan stats without view tags ${JSON.stringify(stats)}`);

    }, 'Replaying the sync data without view tags',
       'The untagged scan finds the same outputs with one derivation per output',
       'The untagged scan differs from the view-tag scan!');

    await tester.test(async () => {
        /* Synced to height 7: the pool transaction (mined at height 8 in the
           recorded chain) is still unconfirmed */
        const state = newMockState(2, { info: infoAt(lastHeight - 1, [2]), maxHeight: lastHeight - 1 });
        const [wallet] = await syncedWallet(state);

        const synchronizer = (wallet as any).walletSynchronizer;
        const added = syncVector.get_pool_changes_lite.response.addedTxs[0];
        const prefix = added['transactionPrefixInfo.txPrefix'];
        const hash = added['transactionPrefixInfo.txHash'];

        const found = await synchronizer.getPoolTransactionOutputs(
            prefix, hash, (wallet as any).subWallets.getPublicSpendKeys(),
        );

        const expected = syncVector.expected.pool_outputs;

        let ok = check(found.length === expected.length, `${found.length} pool outputs, expected ${expected.length}`);

        for (const e of expected) {
            const f = found.find((x: any) => x.key === e.key);

            ok = check(f !== undefined
                && f.index === e.index
                && f.amount === e.amount
                && f.keyImage === e.key_image
                && f.thisHash === e.tx_hash
                && f.ownerSpendKey === spendKeyOfSubwallet.get(e.subwallet),
                `pool output ${e.index}: ${JSON.stringify(f)}`) && ok;
        }

        /* Through the daemon: /get_pool_changes_lite -> unconfirmed incoming amounts */
        let emitted = 0;

        synchronizer.on('unconfirmedtx', (amount: number) => { emitted += amount; });

        await wallet.checkPoolTransactions();

        const primary = subWalletOf(wallet, primaryKeys.spend_public);
        const poolTotal = _.sumBy(expected, 'amount');

        ok = check(_.sumBy(primary.unconfirmedIncomingAmounts, 'amount') === poolTotal,
            'unconfirmed incoming amount') && ok;
        ok = check(emitted === poolTotal, `unconfirmedtx event amount ${emitted}`) && ok;
        ok = check(primary.lockedInputs.length === 0, 'no confirmed input is locked by the pool scan') && ok;

        return ok;

    }, 'Scanning the recorded pool transaction (version 2, tagged outputs)',
       'Pool outputs, indexes and key images match the vector',
       'Pool scan does not match the vector!');

    await tester.test(async () => {
        let ok = true;

        for (const [i, record] of syncVector.getinfo.entries()) {
            const expected: number[] = syncVector.expected.tx_versions[i];
            const daemon = mockDaemon(newMockState(i));

            await daemon.init();

            ok = check(_.isEqual(daemon.getTransactionVersions(), expected),
                `getinfo ${i}: ${JSON.stringify(daemon.getTransactionVersions())}, expected ${JSON.stringify(expected)}`) && ok;
            ok = check(daemon.getMajorVersion() === record.response.major_version, `getinfo ${i}: major version`) && ok;
            ok = check(_.isEqual(parseTransactionVersions(record.response), expected), `parse getinfo ${i}`) && ok;
        }

        /* Daemons without tx_versions: version 2 only from block major version 7 */
        const withoutField = (i: number) => _.omit(syncVector.getinfo[i].response, 'tx_versions');

        ok = check(_.isEqual(parseTransactionVersions(withoutField(0)), [1]), 'major 6 without tx_versions') && ok;
        ok = check(_.isEqual(parseTransactionVersions(withoutField(2)), [1, 2]), 'major 7 without tx_versions') && ok;
        ok = check(_.isEqual(parseTransactionVersions({}), [1]), 'empty info') && ok;
        ok = check(_.isEqual(parseTransactionVersions({ tx_versions: [], major_version: 7 }), []), 'empty list') && ok;

        const daemon = mockDaemon(newMockState(2, { info: withoutField(2) }));

        ok = check(_.isEqual(daemon.getTransactionVersions(), [1]), 'default before the first /info') && ok;

        await daemon.init();

        ok = check(_.isEqual(daemon.getTransactionVersions(), [1, 2]), 'daemon without tx_versions, major 7') && ok;

        return ok;

    }, 'Checking tx_versions from /info',
       'tx_versions parsing and fallbacks work',
       'tx_versions parsing does not work!');

    await tester.test(async () => {
        const cases: Array<[number[], boolean, number | undefined, number | undefined]> = [
            /* allowed, CLSAG support, override, expected */
            [[1], true, undefined, 1],
            [[1, 2], true, undefined, 2],
            [[2], true, undefined, 2],
            [[1, 2], false, undefined, 1],
            [[2], false, undefined, undefined],
            [[], true, undefined, undefined],
            [[1, 2, 3], true, undefined, 2],
            [[1, 2], true, 1, 1],
            [[1], true, 2, 2],
            [[2], true, 1, 1],
            [[1, 2], false, 2, undefined],
            [[1, 2], true, 3, undefined],
        ];

        let ok = true;

        for (const [allowed, clsag, override, expected] of cases) {
            const chosen = chooseTransactionVersion(allowed, clsag, override);

            ok = check(chosen === expected,
                `choose(${JSON.stringify(allowed)}, ${clsag}, ${override}) = ${chosen}, expected ${expected}`) && ok;
        }

        return ok;

    }, 'Checking the transaction version choice',
       'The highest buildable allowed version is chosen',
       'The transaction version choice is wrong!');

    await tester.test(async () => {
        const limits = new Config().mixinLimits;

        const cases: Array<[number, number, number, number]> = [
            /* height, min, max, default */
            [0, 0, 2 ** 64, 3],
            [439999, 0, 2 ** 64, 3],
            [440000, 0, 100, 3],
            [619999, 0, 100, 3],
            [620000, 7, 7, 7],
            [799999, 7, 7, 7],
            [800000, 3, 3, 3],
            [1249999, 3, 3, 3],
            [1250000, 1, 5, 5],
            [3000000, 1, 5, 5],
        ];

        let ok = true;

        for (const [height, min, max, def] of cases) {
            const [minMixin, maxMixin] = limits.getMixinLimitsByHeight(height);

            ok = check(minMixin === min && maxMixin === max,
                `limits at ${height}: [${minMixin}, ${maxMixin}], expected [${min}, ${max}]`) && ok;
            ok = check(limits.getDefaultMixinByHeight(height) === def,
                `default at ${height}: ${limits.getDefaultMixinByHeight(height)}, expected ${def}`) && ok;
        }

        ok = check(validateMixin(0, 3000000).errorCode === WalletErrorCode.MIXIN_TOO_SMALL, 'mixin 0 too small') && ok;
        ok = check(validateMixin(6, 3000000).errorCode === WalletErrorCode.MIXIN_TOO_BIG, 'mixin 6 too big') && ok;
        ok = check(validateMixin(3, 3000000).errorCode === WalletErrorCode.SUCCESS, 'mixin 3 valid') && ok;
        ok = check(validateMixin(5, 3000000).errorCode === WalletErrorCode.SUCCESS, 'mixin 5 valid') && ok;

        /* Order of the limits given does not matter */
        const unordered = new MixinLimits([
            new MixinLimit(800000, 3),
            new MixinLimit(440000, 0, 100, 3),
            new MixinLimit(1250000, 1, 5, 5),
        ], 3);

        ok = check(_.isEqual(unordered.getMixinLimitsByHeight(900000), [3, 3]), 'unordered limits') && ok;
        ok = check(_.isEqual(new MixinLimits([], 4).getMixinLimitsByHeight(10), [0, 2 ** 64]), 'no limits') && ok;
        ok = check(new MixinLimits([], 4).getDefaultMixinByHeight(10) === 4, 'no limits default') && ok;

        return ok;

    }, 'Checking the mixin limits table',
       'Mixin limits apply from their activation height, newest first',
       'Mixin limits are wrong!');

    await tester.test(async () => {
        const v1 = estimateTransactionSize(3, 2, 5, false, 0);
        const v1Explicit = estimateTransactionSize(3, 2, 5, false, 0, 1);
        const v2 = estimateTransactionSize(3, 2, 5, false, 0, 2);

        /* Per input: 64 * 4 bytes (version 1) vs 32 * 4 + 32 (version 2); per output one view tag byte */
        return check(v1 === 867 && v1Explicit === 867, `version 1 estimate ${v1}`)
            && check(v2 === 680, `version 2 estimate ${v2}`);

    }, 'Checking the transaction size estimate',
       'Size estimate accounts for CLSAG and view tags',
       'Size estimate is wrong!');

    await tester.test(async () => {
        const state = newMockState(2, { info: infoAt(lastHeight, [2]) });
        const [wallet] = await syncedWallet(state);

        const amount = 1000;
        const fee = 10;

        const result = await wallet.sendTransactionAdvanced(
            [[destinationKeys.address, amount]], 2, FeeType.FixedFee(fee),
        );

        if (!check(result.success, `send failed: ${result.error ? result.error.toString() : ''}`)) {
            return false;
        }

        let ok = check(state.sent.length === 1, `${state.sent.length} transactions relayed`);

        ok = await checkBuiltTransaction(state.sent[0], 2, amount, fee) && ok;

        const tx = await UtilsTransaction.from(state.sent[0]);

        ok = check(result.transactionHash === await tx.hash(), 'returned transaction hash') && ok;
        ok = check(result.fee === fee, `returned fee ${result.fee}`) && ok;

        /* Rings of mixin + 1 members */
        for (const input of tx.inputs) {
            ok = check((input as TransactionInputs.KeyInput).keyOffsets.length === 3, 'ring size 3') && ok;
        }

        /* The change (tagged outputs) was recognised and stored as unconfirmed incoming */
        const primary = subWalletOf(wallet, primaryKeys.spend_public);
        const inputTotal = _.sumBy(tx.inputs, (i) => (i as TransactionInputs.KeyInput).amount.toJSNumber());

        ok = check(_.sumBy(primary.unconfirmedIncomingAmounts, 'amount') === inputTotal - amount - fee,
            'change stored as unconfirmed incoming') && ok;

        return ok;

    }, 'Sending version 2 (daemon allows [2])',
       'Built a version 2 transaction with tagged outputs and CLSAG signatures',
       'Version 2 send does not work!');

    await tester.test(async () => {
        const state = newMockState(2, { info: infoAt(lastHeight, [1, 2]) });
        const [wallet] = await syncedWallet(state);

        const result = await wallet.sendTransactionAdvanced(
            [[destinationKeys.address, 1000]], 2, FeeType.FixedFee(10),
        );

        if (!check(result.success, `send failed: ${result.error ? result.error.toString() : ''}`)) {
            return false;
        }

        /* The highest allowed version this library can build */
        const expectedVersion = hasClsagSupport() ? 2 : 1;

        return checkBuiltTransaction(state.sent[0], expectedVersion, 1000, 10);

    }, 'Sending in the grace period (daemon allows [1, 2])',
       'Built the highest allowed version',
       'Grace period send does not work!');

    await tester.test(async () => {
        const state = newMockState(2, { info: infoAt(lastHeight, [1, 2]) });
        const [wallet] = await syncedWallet(state, { transactionVersion: 1 });

        const result = await wallet.sendTransactionAdvanced(
            [[destinationKeys.address, 1000]], 2, FeeType.FixedFee(10),
        );

        if (!check(result.success, `send failed: ${result.error ? result.error.toString() : ''}`)) {
            return false;
        }

        return checkBuiltTransaction(state.sent[0], 1, 1000, 10);

    }, 'Sending version 1 with Config.transactionVersion = 1',
       'Built a version 1 transaction with untagged outputs and ring signatures',
       'Version 1 send does not work!');

    await tester.test(async () => {
        const state = newMockState(2, { info: infoAt(lastHeight, [1]) });
        const [wallet, daemon] = await syncedWallet(state);

        /* Prepared while the daemon accepts only version 1 */
        const first = await wallet.sendTransactionAdvanced(
            [[destinationKeys.address, 1000]], 2, FeeType.FixedFee(10),
            undefined, undefined, undefined, false,
        );

        let ok = check(first.success && first.preparedTransaction !== undefined
            && first.preparedTransaction.rawTransaction.version === 1, 'prepared a version 1 transaction');

        /* The daemon moves past the grace period */
        state.info.tx_versions = [2];
        await daemon.updateDaemonInfo();

        const refused = await wallet.sendPreparedTransaction(first.transactionHash as string);

        ok = check(!refused.success && refused.error.errorCode === WalletErrorCode.TRANSACTION_VERSION_NOT_ALLOWED,
            `stale version 1 prepared transaction refused: ${refused.error ? refused.error.toString() : ''}`) && ok;
        ok = check(state.sent.length === 0, 'nothing relayed') && ok;

        /* A new prepared transaction is version 2 and relays */
        const second = await wallet.sendTransactionAdvanced(
            [[destinationKeys.address, 1000]], 2, FeeType.FixedFee(10),
            undefined, undefined, undefined, false,
        );

        ok = check(second.success && second.preparedTransaction !== undefined
            && second.preparedTransaction.rawTransaction.version === 2, 'prepared a version 2 transaction') && ok;

        const sent = await wallet.sendPreparedTransaction(second.transactionHash as string);

        ok = check(sent.success, `prepared version 2 relayed: ${sent.error ? sent.error.toString() : ''}`) && ok;
        ok = check(state.sent.length === 1, 'one transaction relayed') && ok;

        if (state.sent.length === 1) {
            ok = await checkBuiltTransaction(state.sent[0], 2, 1000, 10) && ok;
        }

        return ok;

    }, 'Prepared transactions across the version change',
       'Stale prepared transactions are refused, version 2 prepared transactions relay',
       'Prepared transaction version handling does not work!');

    await tester.test(async () => {
        const state = newMockState(2, {
            info: infoAt(lastHeight, [2]),
            sendResult: {
                error: 'invalid transaction: transaction version not allowed at this height',
                status: 'Failed',
            },
        });

        const [wallet] = await syncedWallet(state, { transactionVersion: 1 });

        const result = await wallet.sendTransactionAdvanced(
            [[destinationKeys.address, 1000]], 2, FeeType.FixedFee(10),
        );

        return check(!result.success && result.error.errorCode === WalletErrorCode.TRANSACTION_VERSION_NOT_ALLOWED,
            `daemon refusal mapped: ${result.error ? result.error.toString() : ''}`);

    }, 'Mapping the daemon\'s "transaction version not allowed" answer',
       'Mapped to TRANSACTION_VERSION_NOT_ALLOWED',
       'Daemon version refusal is not mapped!');

    tester.summary();

    tester.setExitCode();
})();
