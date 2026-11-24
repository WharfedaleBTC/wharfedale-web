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
    try {
      destination(address);
    } catch {
      return Promise.reject(new FaucetError('not a Wharfedale address', 400));
    }
    const now = Date.now();
    const window = this.settings.cooldownMinutes * 60_000;
    for (const key of [`a:${address}`, `c:${client}`]) {
      const last = this.#recent.get(key);
      if (last !== undefined && now - last < window) {
        const minutes = Math.ceil((window - (now - last)) / 60_000);
        return Promise.reject(new FaucetError(`already paid recently; try again in ${minutes} min`, 429));
      }
    }
    const run = this.#queue.then(async () => {
      try {
        const txid = await this.#wallet.send(address, this.settings.amount);
        this.#recent.set(`a:${address}`, now);
        this.#recent.set(`c:${client}`, now);
        return txid;
      } catch (e) {
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
