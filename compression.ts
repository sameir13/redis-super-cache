import { deflateSync, inflateSync } from "fflate";
import { CacheCompressionError } from "./errors";

const COMPRESSED_MAGIC = 0x46;
const HEADER_SIZE = 9;

export function compress(data: string, threshold = 1024): Buffer {
  const input = Buffer.from(data, "utf8");

  if (input.byteLength < threshold) {
    const plain = Buffer.allocUnsafe(HEADER_SIZE + input.byteLength);
    plain.writeUInt8(0x00, 0);
    plain.writeUInt32BE(input.byteLength, 1);
    plain.writeUInt32BE(input.byteLength, 5);
    input.copy(plain, HEADER_SIZE);
    return plain;
  }

  try {
    const compressed = deflateSync(input, { level: 6 });
    const result = Buffer.allocUnsafe(HEADER_SIZE + compressed.byteLength);
    result.writeUInt8(COMPRESSED_MAGIC, 0);
    result.writeUInt32BE(input.byteLength, 1);
    result.writeUInt32BE(compressed.byteLength, 5);
    Buffer.from(compressed).copy(result, HEADER_SIZE);
    return result;
  } catch (err) {
    throw new CacheCompressionError("fflate compression failed", err);
  }
}

export function decompress(data: Buffer): string {
  if (data.byteLength < HEADER_SIZE) {
    throw new CacheCompressionError(
      `Buffer too small to contain header (${data.byteLength} bytes)`
    );
  }

  const magic = data.readUInt8(0);
  const originalSize = data.readUInt32BE(1);
  const compressedSize = data.readUInt32BE(5);
  const payload = data.subarray(HEADER_SIZE, HEADER_SIZE + compressedSize);

  if (magic === 0x00) {
    return payload.toString("utf8");
  }

  if (magic !== COMPRESSED_MAGIC) {
    throw new CacheCompressionError(
      `Unknown compression magic byte: 0x${magic.toString(16)}`
    );
  }

  try {
    const decompressed = inflateSync(payload);

    if (decompressed.byteLength !== originalSize) {
      throw new CacheCompressionError(
        `Decompressed size mismatch: expected ${originalSize}, got ${decompressed.byteLength}`
      );
    }

    return Buffer.from(decompressed).toString("utf8");
  } catch (err) {
    if (err instanceof CacheCompressionError) throw err;
    throw new CacheCompressionError("fflate decompression failed", err);
  }
}