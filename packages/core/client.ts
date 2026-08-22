export interface RedisPipeline {
  set(key: string, value: Buffer, options?: { EX: number }): RedisPipeline;
  del(...keys: string[]): RedisPipeline;
  sAdd(key: string, member: string): RedisPipeline;
  sRem(key: string, member: string): RedisPipeline;
  exec(): Promise<unknown>;
}

export interface RedisCacheClient {
  getBuffer(key: string): Promise<Buffer | null>;
  set(key: string, value: Buffer, options?: { EX: number }): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<number>;
  multi(): RedisPipeline;
  sMembers(key: string): Promise<string[]>;
  sAdd(key: string, member: string): Promise<number>;
  sRem(key: string, member: string): Promise<number>;
  sCard(key: string): Promise<number>;
}
