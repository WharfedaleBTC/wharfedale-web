// Before anything else: liquidjs-lib and the SDK expect Node's Buffer and a `process` object.
import { Buffer } from 'buffer';

const g = globalThis as unknown as { Buffer?: typeof Buffer; process?: unknown };
g.Buffer ??= Buffer;
g.process ??= { env: {}, browser: true, versions: {}, nextTick: (fn: (...a: unknown[]) => void, ...a: unknown[]) => queueMicrotask(() => fn(...a)) };
