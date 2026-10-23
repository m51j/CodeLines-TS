export type Proto = Map<number, (number | Uint8Array)[]>;
export function protobuf(buf: Uint8Array): Proto {
  const m: Proto = new Map();
  let i = 0;
  // Values beyond 2^53 (including negative int64s) cannot be represented
  // exactly and are never valid counts or times; they decode as 0.
  const varint = () => {
    let r = 0n,
      shift = 0n,
      x: number;
    do {
      x = buf[i++] ?? 0;
      if (shift < 70n) r |= BigInt(x & 127) << shift;
      shift += 7n;
    } while ((x & 128) !== 0 && i < buf.length);
    return r <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(r) : 0;
  };
  while (i < buf.length) {
    const key = varint(),
      f = Math.floor(key / 8),
      t = key % 8;
    let v: number | Uint8Array | undefined;
    if (t === 0) v = varint();
    else if (t === 2) {
      const n = varint(),
        start = i;
      v = buf.subarray(start, Math.min(start + n, buf.length));
      i = Math.min(start + n, buf.length);
    } else if (t === 1) i += 8;
    else if (t === 5) i += 4;
    else return m;
    if (v !== undefined) {
      const list = m.get(f) ?? [];
      list.push(v);
      m.set(f, list);
    }
  }
  return m;
}
export const pbSub = (m: Proto | undefined, f: number): Proto | undefined => {
  const v = m?.get(f)?.[0];
  return v instanceof Uint8Array ? protobuf(v) : undefined;
};
export const pbInt = (m: Proto | undefined, f: number): number => {
  const v = m?.get(f)?.[0];
  return typeof v === "number" ? v : 0;
};
export const pbStr = (m: Proto | undefined, f: number): string => {
  const v = m?.get(f)?.[0];
  return v instanceof Uint8Array ? new TextDecoder().decode(v) : "";
};
export function uriToPath(uri: string): string {
  if (!uri.startsWith("file:///")) return uri;
  const p = decodeURIComponent(uri.slice(8));
  return /^[a-zA-Z]:/.test(p) ? p.replaceAll("/", "\\") : "/" + p;
}
