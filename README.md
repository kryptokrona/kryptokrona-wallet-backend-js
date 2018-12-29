# turtlecoin-wallet-backend

Provides an interface to the TurtleCoin network, allowing wallet applications to be built.

* Downloads blocks from the network, either through a traditional daemon, or a blockchain cache for increased speed
* Processes blocks, decrypting transactions that belong to the user
* Sends and receives transactions

### Building

`git clone https://github.com/zpalmtree/turtlecoin-wallet-backend.git`

`cd turtlecoin-wallet-backend`

`npm i`

`npm run build`

Generated javascript files will be written to the dist/ folder.
