// create-hmac replacement for the browser.
import { Buffer } from 'buffer';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';

export default function createHmac(name: string, key: Uint8Array | string) {
  const hash = name.toLowerCase() === 'sha512' ? sha512 : name.toLowerCase() === 'sha256' ? sha256 : null;
  if (!hash) throw new Error(`create-hmac shim: unsupported ${name}`);
  const h = hmac.create(hash, typeof key === 'string' ? Buffer.from(key) : key);
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
