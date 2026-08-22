import {
  jsonSerializer,
  unwrapEnvelope,
  wrapEnvelope,
} from "./serializer";
import { CacheSerializationError } from "./errors";

describe("serializer", () => {
  it("wraps and unwraps envelope values", () => {
    const env = wrapEnvelope({ id: 1 });
    expect(unwrapEnvelope(env)).toEqual({ id: 1 });
    expect(unwrapEnvelope(null)).toBeNull();
  });

  it("throws on invalid JSON deserialize", () => {
    expect(() => jsonSerializer.deserialize("{bad")).toThrow(
      CacheSerializationError
    );
  });
});
