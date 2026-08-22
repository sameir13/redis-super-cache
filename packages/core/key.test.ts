import { hashKey } from "./key";

describe("hashKey", () => {
  it("produces a string with the default tc: prefix", () => {
    expect(hashKey("user:1")).toMatch(/^tc:[0-9a-f]+$/);
  });

  it("uses a custom prefix", () => {
    expect(hashKey("user:1", "myapp")).toMatch(/^myapp:[0-9a-f]+$/);
  });

  it("is deterministic", () => {
    expect(hashKey("user:1")).toBe(hashKey("user:1"));
  });

  it("throws RangeError for an empty key", () => {
    expect(() => hashKey("")).toThrow(RangeError);
  });
});
