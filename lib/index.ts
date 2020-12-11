// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.

export { WalletError, WalletErrorCode, SUCCESS } from './WalletError';
export { WalletBackend } from './WalletBackend';
export { Daemon } from './Daemon';
export { IDaemon } from './IDaemon';

export {
    prettyPrintAmount, isHex64, isValidMnemonic, isValidMnemonicWord,
    createIntegratedAddress,
} from './Utilities';

export { LogLevel, LogCategory } from './Logger';
export { validateAddress, validateAddresses, validatePaymentID } from './ValidateParameters';
export { TransactionInput, DaemonType, DaemonConnection } from './Types';
export { MixinLimit, MixinLimits } from './MixinLimits';
export { Config } from './Config';

// this is to keep pesky timeout errors away
// see https://stackoverflow.com/questions/24320578/node-js-get-request-etimedout-esockettimedout/37946324#37946324
process.env.UV_THREADPOOL_SIZE = '256';
