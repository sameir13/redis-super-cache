import { compress, decompress } from "./compression";
import { CacheCompressionError } from "./errors";

const SHORT = "hello world"; // below 1024 threshold
const LONG = "x".repeat(2048); // above threshold, will be compressed

describe("compress / decompress round-trip", () => {
  it("round-trips a short string (uncompressed path)", () => {
    const buf = compress(SHORT);
    expect(decompress(buf)).toBe(SHORT);
  });

  it("round-trips a long string (LZ4 path)", () => {
    const buf = compress(LONG);
    expect(decompress(buf)).toBe(LONG);
  });

  it("compressed buffer is smaller than the original for repetitive data", () => {
    const buf = compress(LONG);
    expect(buf.byteLength).toBeLessThan(Buffer.from(LONG, "utf8").byteLength);
  });

  it("round-trips JSON with special characters", () => {
    const obj = JSON.stringify({ name: "Ünïcödé", emoji: "🔥", arr: [1, 2, 3] });
    expect(decompress(compress(obj))).toBe(obj);
  });

  it("round-trips a large JSON blob (>1KB)", () => {
    const big = JSON.stringify({ data: "a".repeat(4000), nums: Array.from({ length: 100 }, (_, i) => i) });
    expect(decompress(compress(big))).toBe(big);
  });

  it("throws CacheCompressionError for a buffer that is too small", () => {
    expect(() => decompress(Buffer.from([0x00]))).toThrow(CacheCompressionError);
  });

  it("throws CacheCompressionError for an unknown magic byte", () => {
    const bad = Buffer.alloc(10);
    bad.writeUInt8(0xff, 0);
    bad.writeUInt32BE(4, 1);
    bad.writeUInt32BE(4, 5);
    expect(() => decompress(bad)).toThrow(CacheCompressionError);
  });
});
