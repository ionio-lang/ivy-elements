import { Transaction } from './Transaction';
import { Argument, encodeArgument } from './Argument';
import { Artifact, Function } from './Artifact';
import { Network } from 'liquidjs-lib/src/networks';
import {
  toHashTree,
  BIP341Factory,
  HashTree,
  TinySecp256k1Interface,
  TaprootLeaf,
} from 'liquidjs-lib/src/bip341';
import { address, script, TxOutput } from 'liquidjs-lib';
import { H_POINT } from './constants';
import { Utxo } from './interfaces';
import { tweakPublicKey } from './utils/taproot';
import { replaceTemplateWithConstructorArg } from './utils/template';
import { isSigner } from './Signer';

export interface ContractInterface {
  name: string;
  address: string;
  fundingUtxo: Utxo | undefined;
  bytesize: number;
  functions: {
    [name: string]: ContractFunction;
  };
  leaves: { scriptHex: string }[];
  scriptPubKey: Buffer;
  from(txid: string, vout: number, prevout: TxOutput): ContractInterface;
  getTaprootTree(): HashTree;
}

export class Contract implements ContractInterface {
  name: string;
  address: string;
  fundingUtxo: Utxo | undefined;
  // TODO add bytesize calculation
  bytesize: number = 0;

  functions: {
    [name: string]: ContractFunction;
  };

  leaves: TaprootLeaf[];
  scriptPubKey: Buffer;
  private parity: number;

  constructor(
    private artifact: Artifact,
    private constructorArgs: Argument[],
    private network: Network,
    private ecclib: TinySecp256k1Interface
  ) {
    const expectedProperties = [
      'contractName',
      'functions',
      'constructorInputs',
    ];
    if (!expectedProperties.every(property => property in artifact)) {
      throw new Error('Invalid or incomplete artifact provided');
    }

    if (artifact.constructorInputs.length !== constructorArgs.length) {
      throw new Error(
        `Incorrect number of arguments passed to ${artifact.contractName} constructor`
      );
    }

    // Encode arguments (this performs type checking)
    constructorArgs.forEach((arg, i) =>
      encodeArgument(arg, artifact.constructorInputs[i].type)
    );

    this.leaves = [];
    this.functions = {};
    // Populate the functions object with the contract's functions
    // (with a special case for single function, which has no "function selector")
    this.artifact.functions.forEach((f, i) => {
      const expectedProperties = ['name', 'functionInputs', 'require', 'asm'];
      if (!expectedProperties.every(property => property in f)) {
        throw new Error(
          `Invalid or incomplete function provided at index ${i}`
        );
      }
      this.functions[f.name] = this.createFunction(f, i);

      // check for constructor inputs to replace template strings starting with $ or strip 0x from hex encoded strings
      const asm = f.asm.map(op =>
        replaceTemplateWithConstructorArg(
          op,
          artifact.constructorInputs,
          constructorArgs
        )
      );

      this.leaves.push({
        scriptHex: script.fromASM(asm.join(' ')).toString('hex'),
      });
    });

    // name
    this.name = artifact.contractName;

    const bip341 = BIP341Factory(this.ecclib);
    const hashTree = toHashTree(this.leaves);

    // scriptPubKey & addressl
    this.scriptPubKey = bip341.taprootOutputScript(H_POINT, hashTree);
    this.address = address.fromOutputScript(this.scriptPubKey, this.network);

    // parity bit
    const { parity } = tweakPublicKey(H_POINT, hashTree.hash, this.ecclib);
    this.parity = parity;
    // TODO add bytesize calculation
    //this.bytesize = calculateBytesize(this.leaves);
  }

  getTaprootTree(): HashTree {
    return toHashTree(this.leaves, true);
  }

  from(txid: string, vout: number, prevout: TxOutput): this {
    // check we are using an actual funding outpoint for the script of the contract
    if (!prevout.script.equals(this.scriptPubKey))
      throw new Error(
        'given prevout script does not match contract scriptPubKey'
      );

    this.fundingUtxo = {
      txid,
      vout,
      prevout,
    };

    return this;
  }

  private createFunction(
    artifactFunction: Function,
    selector: number
  ): ContractFunction {
    return (...functionArgs: Argument[]) => {
      if (artifactFunction.functionInputs.length !== functionArgs.length) {
        throw new Error(
          `Incorrect number of arguments passed to function ${artifactFunction.name}`
        );
      }

      // Encode passed args (this also performs type checking)
      functionArgs.forEach((arg, index) => {
        if (isSigner(arg)) return;
        return encodeArgument(arg, artifactFunction.functionInputs[index].type);
      });

      return new Transaction(
        this.artifact.constructorInputs,
        this.constructorArgs,
        artifactFunction,
        functionArgs,
        selector,
        this.fundingUtxo,
        {
          leaves: this.leaves,
          parity: this.parity,
        },
        this.network
      );
    };
  }
}

export type ContractFunction = (...args: Argument[]) => Transaction;
