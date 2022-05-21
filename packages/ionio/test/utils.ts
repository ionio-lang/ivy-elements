import axios from 'axios';
import { Transaction } from 'liquidjs-lib';
const APIURL = process.env.APIURL || 'http://localhost:3001';

export function sleep(ms: number): Promise<any> {
  return new Promise((res: any): any => setTimeout(res, ms));
}

export async function faucetComplex(address: string, amountFractional: number) {
  const utxo = await faucet(address, amountFractional);
  const txhex = await fetchTx(utxo.txid);
  const prevout = Transaction.fromHex(txhex).outs[utxo.vout];
  return {
    utxo,
    prevout,
  };
}

export async function faucet(address: string, amount: number): Promise<any> {
  try {
    const resp = await axios.post(`${APIURL}/faucet`, { address, amount });
    if (resp.status !== 200) {
      throw new Error('Invalid address');
    }
    const { txId } = resp.data;

    sleep(1000);
    let rr = { data: [] };
    const filter = (): any => rr.data.filter((x: any) => x.txid === txId);
    while (!rr.data.length || !filter().length) {
      sleep(1000);
      rr = await axios.get(`${APIURL}/address/${address}/utxo`);
    }

    return filter()[0];
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export async function fetchTx(txId: string): Promise<string> {
  const resp = await axios.get(`${APIURL}/tx/${txId}/hex`);
  return resp.data;
}

export async function fetchUtxo(txId: string): Promise<any> {
  const txHex = await fetchTx(txId);
  const resp = await axios.get(`${APIURL}/tx/${txId}`);
  return { txHex, ...resp.data };
}

export async function broadcast(
  txHex: string,
  verbose = true,
  api: string = APIURL
): Promise<string> {
  try {
    const resp = await axios.get(`${api}/broadcast?tx=${txHex}`);
    return resp.data;
  } catch (e) {
    if (verbose) console.error(e);
    throw e;
  }
}