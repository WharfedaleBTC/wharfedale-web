// Faucet: pays a fixed amount of the fee asset, rate-limited per address and per client.
// Payouts are serialized (no two pick the same coin), and the faucet keeps `minCoins` explicit
// coins so it can serve many requests per block (the mempool spends confirmed coins only).
import { Client, Key, Wallet, destination, select, unsignedTx, addOutputs, signKeyPath, type OutputSpec } from '@wharfedale/sdk';
import type { Config } from './config.js';

export class FaucetError extends Error {
  constructor(message: string, readonly status: 400 | 429 | 503) {
    super(message);
  }
}

export class Faucet {
  readonly #wallet: Wallet;
  readonly #recent = new Map<string, number>();
  #queue: Promise<unknown> = Promise.resolve();
  #splitting = false;

  constructor(client: Client, readonly settings: NonNullable<Config['faucet']>) {
    this.#wallet = new Wallet(client, Key.load(settings.keyFile));
  }

  async status(): Promise<{ balance: number; amount: number; cooldownMinutes: number; coins: number }> {
    const info = await this.#wallet.client.chainInfo();
    const coins = (await this.#wallet.coins()).filter((c) => c.asset === info.feeAsset);
    return {
      balance: coins.reduce((s, c) => s + c.value, 0),
      amount: this.settings.amount,
      cooldownMinutes: this.settings.cooldownMinutes,
      coins: coins.length,
    };
  }

  /** Pays `amount` to `address`; `client` identifies the requester (IP). */
  pay(address: string, client: string): Promise<string> {
    // Addresses only (a hex script could be anything, e.g. a burn), and the limit is per output
    // script: `wfc1…`, `wf1…` and upper case are the same recipient.
    let script: string;
    try {
      if (!/^wfc?1/i.test(address)) throw new Error();
      script = destination(address).script.toString('hex');
    } catch {
      return Promise.reject(new FaucetError('not a Wharfedale address', 400));
    }
    const now = Date.now();
    const window = this.settings.cooldownMinutes * 60_000;
    for (const [key, last] of this.#recent) if (now - last >= window) this.#recent.delete(key);
    const keys = [`a:${script}`, `c:${client}`];
    for (const key of keys) {
      const last = this.#recent.get(key);
      if (last !== undefined) {
        const minutes = Math.ceil((window - (now - last)) / 60_000);
        return Promise.reject(new FaucetError(`already paid recently; try again in ${minutes} min`, 429));
      }
    }
    // Reserve before paying: concurrent requests from one client or for one address must not
    // all pass the check while the first payout is queued.
    for (const key of keys) this.#recent.set(key, now);
    const run = this.#queue.then(async () => {
      try {
        return await this.#wallet.send(address, this.settings.amount);
      } catch (e) {
        for (const key of keys) this.#recent.delete(key);
        throw new FaucetError(`faucet unavailable: ${(e as Error).message}`, 503);
      }
    });
    this.#queue = run.catch(() => undefined);
    return run;
  }

  /** Splits the largest coin when fewer than `minCoins` coins are spendable. */
  async keepCoins(): Promise<void> {
    if (this.#splitting) return;
    this.#splitting = true;
    try {
      await (this.#queue = this.#queue.then(async () => {
        const client = this.#wallet.client;
        const info = await client.chainInfo();
        const coins = (await this.#wallet.coins()).filter((c) => c.asset === info.feeAsset);
        if (coins.length >= this.settings.minCoins) return;
        const chunk = this.settings.amount * 10;
        const count = this.settings.minCoins * 2;
        const fee = 5_000;
        const pool = [...coins];
        const { taken, total } = select(pool, info.feeAsset, chunk * count + fee + 1);
        const key = this.#wallet.key;
        const specs: OutputSpec[] = Array.from({ length: count }, () => ({ script: key.scriptPubkey(), asset: info.feeAsset, value: chunk }));
        const confidential = taken.some((c) => c.confidential);
        specs.push({ script: key.scriptPubkey(), asset: info.feeAsset, value: total - chunk * count - fee, blindingKey: confidential ? key.blindingPublicKey() : undefined });
        specs.push({ script: Buffer.alloc(0), asset: info.feeAsset, value: fee });
        const tx = unsignedTx(taken);
        await addOutputs(tx, specs, taken.map((c) => ({ asset: c.asset, value: c.value, assetBlinder: c.assetBlinder, valueBlinder: c.valueBlinder })));
        signKeyPath(tx, taken.map((c) => c.output), key, info.genesisHash);
        const txid = await client.sendTransaction(tx);
        console.log(`faucet: split into ${count} coins (${txid})`);
      }).catch((e) => console.warn(`faucet: split failed: ${(e as Error).message}`)));
    } finally {
      this.#splitting = false;
    }
  }
}
