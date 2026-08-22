import { compress, decompress } from "./compression";
import { CacheCompressionError } from "./errors";

const SHORT = "hello world";
const LONG = "x".repeat(2048);

describe("compress / decompress round-trip", () => {
  it("round-trips a short string (uncompressed path)", () => {
    const buf = compress(SHORT);
    expect(decompress(buf)).toBe(SHORT);
  });

  it("round-trips a long string (deflate path)", () => {
    const buf = compress(LONG);
    expect(decompress(buf)).toBe(LONG);
  });

  it("compressed buffer is smaller than the original for repetitive data", () => {
    const buf = compress(LONG);
    expect(buf.byteLength).toBeLessThan(Buffer.from(LONG, "utf8").byteLength);
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
