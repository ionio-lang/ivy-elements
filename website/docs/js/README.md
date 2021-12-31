# JavaScript SDK

Ivy is also available as a (very unstable and early-stage) [JavaScript SDK](https://www.npmjs.com/package/ivy-bitcoin).

```
npm install ivy-bitcoin
```

This library allows you to write and compile contract templates, instantiate them with arguments (to create Bitcoin addresses), create dummy contracts (with fake value), and unlock them with arguments. 

It does not support creating real transactions (on either the testnet or mainnet). Do not try to send BTC to addresses created by this library.

```js
import {
  compile,
  fulfill,
  instantiate,
  spend,
  toSighash,
  createSignature,
  crypto
} from "ivy-bitcoin"

const source = `contract LockWithPublicKey(publicKey: PublicKey, val: Value) {
  clause spend(sig: Signature) {
    verify checkSig(publicKey, sig)
    unlock val
  }
}`
const privateKey = "Kyw8s2qf2TxNnJMwfrKYhAsZ6eAmMMhAv4Ej4VVE8KpVsDvXurJK"
const publicKey = crypto.KeyRing.fromSecret(privateKey).getPublicKey("hex")
const destinationAddress = ""
const amount = 0
const locktime = 0
const sequenceNumber = { sequence: 0, seconds: false }

// compile the template
const template = compile(source)

// instantiate it
const instantiated = instantiate(template, [publicKey, amount])

// get the testnet and mainnet addresses corresponding to the contract
// note: any BTC sent to these addresses may not be recoverable!
console.log(instantiated.testnetAddress)
console.log(instantiated.mainnetAddress)

// create the spending transaction
const spendTransaction = spend(
  instantiated.fundingTransaction,
  destinationAddress,
  amount,
  locktime,
  sequenceNumber
)

// sign it
const sighash = toSighash(instantiated, spendTransaction)
const sig = createSignature(sighash, privateKey)

// add the signature so the script succeeds
const fulfilledTransaction = fulfill(instantiated, spendTransaction, [sig], "spend")

// throw an error if transaction is invalid
fulfilledTransaction.check()
```

For more examples of how to use the library, see the [tests](https://github.com/ivy-lang/ivy-bitcoin/blob/main/ivy-bitcoin/src/test/test.ts).
