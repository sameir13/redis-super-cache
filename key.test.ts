import { hashKey } from "./key";

describe("hashKey", () => {
  it("produces a string with the default sc: prefix", () => {
    expect(hashKey("user:1")).toMatch(/^sc:[0-9a-f]+$/);
  });

  it("uses a custom prefix", () => {
    expect(hashKey("user:1", "myapp")).toMatch(/^myapp:[0-9a-f]+$/);
  });

  it("is deterministic — same key always produces same hash", () => {
    expect(hashKey("user:1")).toBe(hashKey("user:1"));
  });

  it("produces different hashes for different keys", () => {
    expect(hashKey("user:1")).not.toBe(hashKey("user:2"));
  });

  it("handles very long keys without error", () => {
    const longKey = "prefix:" + "a".repeat(10_000);
    expect(() => hashKey(longKey)).not.toThrow();
  });

  it("throws RangeError for an empty key", () => {
    expect(() => hashKey("")).toThrow(RangeError);
  });
});
