// Copyright (c) 2018, Zpalmtree 
// 
// Please see the included LICENSE file for more information.

/* What version of the file format are we on (to make it easier to
   upgrade the wallet format in the future) */
export const WALLET_FILE_FORMAT_VERSION: number = 0;

/* The number of iterations of PBKDF2 to perform on the wallet
   password. */
export const PBKDF2_ITERATIONS: number = 500000;

/* We use this to check that the file is a wallet file, this bit does
   not get encrypted, and we can check if it exists before decrypting.
   If it isn't, it's not a wallet file. */
export const IS_A_WALLET_IDENTIFIER: Buffer = Buffer.from([
    0x49, 0x66, 0x20, 0x49, 0x20, 0x70, 0x75, 0x6c, 0x6c, 0x20, 0x74,
    0x68, 0x61, 0x74, 0x20, 0x6f, 0x66, 0x66, 0x2c, 0x20, 0x77, 0x69,
    0x6c, 0x6c, 0x20, 0x79, 0x6f, 0x75, 0x20, 0x64, 0x69, 0x65, 0x3f,
    0x0a, 0x49, 0x74, 0x20, 0x77, 0x6f, 0x75, 0x6c, 0x64, 0x20, 0x62,
    0x65, 0x20, 0x65, 0x78, 0x74, 0x72, 0x65, 0x6d, 0x65, 0x6c, 0x79,
    0x20, 0x70, 0x61, 0x69, 0x6e, 0x66, 0x75, 0x6c, 0x2e
]);

/* We use this to check if the file has been correctly decoded, i.e.
   is the password correct. This gets encrypted into the file, and
   then when unencrypted the file should start with this - if it
   doesn't, the password is wrong */
export const IS_CORRECT_PASSWORD_IDENTIFIER: Buffer = Buffer.from([
    0x59, 0x6f, 0x75, 0x27, 0x72, 0x65, 0x20, 0x61, 0x20, 0x62, 0x69,
    0x67, 0x20, 0x67, 0x75, 0x79, 0x2e, 0x0a, 0x46, 0x6f, 0x72, 0x20,
    0x79, 0x6f, 0x75, 0x2e
]);

/* How large should the lastKnownBlockHashes container be */
export const LAST_KNOWN_BLOCK_HASHES_SIZE = 100;

/* Save a block hash checkpoint every BLOCK_HASH_CHECKPOINTS_INTERVAL
   blocks */
export const BLOCK_HASH_CHECKPOINTS_INTERVAL = 5000;

/* When we get the global indexes, we pass in a range of blocks, to obscure
   which transactions we are interested in - the ones that belong to us.
   To do this, we get the global indexes for all transactions in a range.
   For example, if we want the global indexes for a transaction in block
   17, we get all the indexes from block 10 to block 20.
       
   This value determines how many blocks to take from. */
export const GLOBAL_INDEXES_OBSCURITY = 10;

/* The maximum amount of blocks we can have waiting to be processed in
   the queue. If we exceed this, we will wait till it drops below this
   amount. */
export const MAXIMUM_SYNC_QUEUE_SIZE = 1000;
