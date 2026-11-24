// create-hash replacement for the browser (liquidjs-lib): sha256, sha1, sha512, ripemd160.
import { Buffer } from 'buffer';
import { sha1, ripemd160 } from '@noble/hashes/legacy.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';

type Algo = 'sha256' | 'sha1' | 'sha512' | 'ripemd160' | 'rmd160';
const ALGOS: Record<Algo, { create(): { update(b: Uint8Array): unknown; digest(): Uint8Array } }> = {
  sha256,
  sha1,
  sha512,
  ripemd160,
  rmd160: ripemd160,
};

export default function createHash(name: string) {
  const algo = ALGOS[name.toLowerCase() as Algo];
  if (!algo) throw new Error(`create-hash shim: unsupported ${name}`);
  const h = algo.create();
  const api = {
    update(data: Uint8Array | string, enc?: BufferEncoding) {
      h.update(typeof data === 'string' ? Buffer.from(data, enc ?? 'utf8') : data);
      return api;
    },
    digest(enc?: BufferEncoding) {
      const out = Buffer.from(h.digest());
      return enc ? out.toString(enc) : out;
    },
  };
  return api;
}
