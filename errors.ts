/**
 * Thrown when the Redis client is not connected or a Redis command fails.
 */
export class CacheConnectionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "CacheConnectionError";
  }
}

/**
 * Thrown when LZ4 compression or decompression fails.
 */
export class CacheCompressionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "CacheCompressionError";
  }
}

/**
 * Thrown when JSON serialization or deserialization fails.
 */
export class CacheSerializationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "CacheSerializationError";
  }
}
