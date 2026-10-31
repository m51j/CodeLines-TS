import o200k from "js-tiktoken/ranks/o200k_base";
import cl100k from "js-tiktoken/ranks/cl100k_base";
import type { ScanOptions } from "../shared/contracts";
type Ranks = typeof o200k;
// js-tiktoken rescans every pair and allocates a string key for each one on
// every merge, so a long run without separators (minified code, base64, rows
// of '=') takes minutes. This encoder reuses its vocabularies with the same
// merge order — lowest rank first, leftmost on ties — but merges through a
// heap over a linked list and keys ranks by byte strings, never re-joining.
class Encoder {
  private ranks = new Map<string, number>();
  private pattern: RegExp;
  private special: RegExp;
  private utf8 = new TextEncoder();
  // Identifiers repeat across a codebase, so remember merged short pieces.
  private merged = new Map<string, number>();
  constructor(data: Ranks) {
    for (const line of data.bpe_ranks.split("\n")) {
      if (!line) continue;
      const [, offset, ...tokens] = line.split(" ");
      let rank = Number.parseInt(offset, 10);
      for (const token of tokens)
        this.ranks.set(Buffer.from(token, "base64").toString("latin1"), rank++);
    }
    this.pattern = new RegExp(data.pat_str, "gu");
    this.special = new RegExp(
      Object.keys(data.special_tokens)
        .map((t) => t.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&"))
        .join("|"),
      "g",
    );
  }
  // Special tokens are allowed and count as one token each.
  count(text: string): number {
    let start = 0,
      total = 0;
    for (const m of text.matchAll(this.special)) {
      total += this.ordinary(text.slice(start, m.index)) + 1;
      start = m.index + m[0].length;
    }
    return total + this.ordinary(start ? text.slice(start) : text);
  }
  private ordinary(text: string) {
    const pattern = this.pattern;
    let total = 0;
    pattern.lastIndex = 0;
    for (let m; (m = pattern.exec(text));) {
      const piece = this.bytes(m[0]);
      if (this.ranks.has(piece)) {
        total++;
        continue;
      }
      let tokens = this.merged.get(piece);
      if (tokens === undefined) {
        tokens = this.merge(piece);
        if (piece.length <= 64) {
          if (this.merged.size >= 100_000) this.merged.clear();
          this.merged.set(piece, tokens);
        }
      }
      total += tokens;
    }
    return total;
  }
  // Each char of the returned string is one UTF-8 byte (latin1 code units).
  private bytes(s: string) {
    if (!/[^\x00-\x7f]/.test(s)) return s;
    const b = this.utf8.encode(s);
    let r = "";
    for (let i = 0; i < b.length; i += 4096)
      r += String.fromCharCode(...b.subarray(i, i + 4096));
    return r;
  }
  // Returns how many tokens the piece merges into; every single byte is a
  // token, so each remaining node is one.
  private merge(piece: string) {
    const n = piece.length,
      next = new Int32Array(n),
      prev = new Int32Array(n),
      pair = new Float64Array(n),
      heap = new Heap();
    // pair[i] is the rank of node i joined with its successor (Infinity: none).
    const rankAt = (i: number) => {
      const j = next[i];
      if (j >= n) return Infinity;
      return (
        this.ranks.get(piece.slice(i, next[j] >= n ? n : next[j])) ?? Infinity
      );
    };
    for (let i = 0; i < n; i++) {
      next[i] = i + 1;
      prev[i] = i - 1;
    }
    for (let i = 0; i < n - 1; i++) {
      pair[i] = rankAt(i);
      if (pair[i] !== Infinity) heap.push(pair[i], i);
    }
    pair[n - 1] = Infinity;
    while (heap.size) {
      const [rank, i] = heap.pop();
      // Stale entries: the node was absorbed or its pair rank has changed.
      if (pair[i] !== rank) continue;
      const j = next[i];
      next[i] = next[j];
      if (next[j] < n) prev[next[j]] = i;
      pair[j] = NaN;
      pair[i] = rankAt(i);
      if (pair[i] !== Infinity) heap.push(pair[i], i);
      const p = prev[i];
      if (p >= 0) {
        pair[p] = rankAt(p);
        if (pair[p] !== Infinity) heap.push(pair[p], p);
      }
    }
    let tokens = 0;
    for (let i = 0; i < n; i = next[i]) tokens++;
    return tokens;
  }
}
// Min-heap ordered by rank, then position, matching tiktoken's leftmost tie.
class Heap {
  private ranks: number[] = [];
  private positions: number[] = [];
  get size() {
    return this.ranks.length;
  }
  private less(a: number, b: number) {
    const r = this.ranks,
      p = this.positions;
    return r[a] < r[b] || (r[a] === r[b] && p[a] < p[b]);
  }
  private swap(a: number, b: number) {
    const r = this.ranks,
      p = this.positions;
    [r[a], r[b]] = [r[b], r[a]];
    [p[a], p[b]] = [p[b], p[a]];
  }
  push(rank: number, position: number) {
    this.ranks.push(rank);
    this.positions.push(position);
    for (let i = this.ranks.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }
  pop(): [number, number] {
    const top: [number, number] = [this.ranks[0], this.positions[0]],
      last = this.ranks.length - 1;
    this.swap(0, last);
    this.ranks.pop();
    this.positions.pop();
    for (let i = 0; ;) {
      const l = 2 * i + 1,
        r = l + 1;
      let m = i;
      if (l < last && this.less(l, m)) m = l;
      if (r < last && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }
}
const sources = { o200k_base: o200k, cl100k_base: cl100k };
const encoders = new Map<string, Encoder>();
export function countTokens(
  text: string,
  encoding: ScanOptions["tokenizerEncoding"],
): number {
  if (!Object.hasOwn(sources, encoding))
    throw new Error("Unsupported tokenizer encoding");
  let enc = encoders.get(encoding);
  if (!enc) {
    enc = new Encoder(sources[encoding]);
    encoders.set(encoding, enc);
  }
  return enc.count(text);
}
