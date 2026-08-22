export class CacheConnectionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "CacheConnectionError";
  }
}

export class CacheCompressionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "CacheCompressionError";
  }
}

export class CacheSerializationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "CacheSerializationError";
  }
}
