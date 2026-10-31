import { Worker } from "node:worker_threads";
import type { FileAnalysis, FileAnalyzer } from "./scanner";
// Runs analyzeFile on worker threads so tokenizing uses several cores, the way
// the original Parallel.ForEach scan did. Each worker loads its own tokenizer
// vocabulary, so callers keep the pool small.
export class AnalyzerPool {
  private all = new Set<Worker>();
  private idle: Worker[] = [];
  private waiting: ((w: Worker) => void)[] = [];
  constructor(
    private script: string,
    readonly size: number,
  ) {}
  analyze: FileAnalyzer = async (file, language, options) => {
    const worker = await this.acquire();
    try {
      return await new Promise<FileAnalysis>((resolve, reject) => {
        const done = () => {
          worker.off("message", message);
          worker.off("error", failed);
          worker.off("exit", exited);
        };
        const message = (m: {
          value?: FileAnalysis;
          error?: { name: string; message: string };
        }) => {
          done();
          if (m.error)
            reject(Object.assign(new Error(m.error.message), m.error));
          else resolve(m.value!);
        };
        const failed = (e: Error) => {
          done();
          reject(e);
        };
        const exited = (code: number) =>
          failed(new Error(`Analyzer exited (${code})`));
        worker.on("message", message);
        worker.on("error", failed);
        worker.on("exit", exited);
        worker.postMessage({
          file,
          language,
          options: {
            maxFileSizeBytes: options.maxFileSizeBytes,
            tokenizerEncoding: options.tokenizerEncoding,
          },
        });
      });
    } finally {
      this.release(worker);
    }
  };
  private acquire() {
    const worker = this.idle.pop();
    if (worker) return Promise.resolve(worker);
    if (this.all.size < this.size) {
      // Tokenizing churns short-lived strings; a small young generation
      // collects them early and keeps eight workers near 50 MB each.
      const created = new Worker(this.script, {
        resourceLimits: { maxYoungGenerationSizeMb: 8 },
      });
      const forget = () => {
        this.all.delete(created);
        this.idle = this.idle.filter((w) => w !== created);
      };
      created.on("error", forget).on("exit", forget);
      this.all.add(created);
      return Promise.resolve(created);
    }
    return new Promise<Worker>((resolve) => this.waiting.push(resolve));
  }
  private release(worker: Worker) {
    // A crashed worker is replaced by the next caller that needs one.
    if (!this.all.has(worker)) {
      const next = this.waiting.shift();
      if (next) void this.acquire().then(next);
      return;
    }
    const next = this.waiting.shift();
    if (next) next(worker);
    else this.idle.push(worker);
  }
  async close() {
    const workers = [...this.all];
    this.all.clear();
    this.idle = [];
    await Promise.all(workers.map((w) => w.terminate()));
  }
}
