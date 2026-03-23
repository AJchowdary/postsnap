export interface IDatabase {
  findOne<T>(collection: string, query: Record<string, any>): Promise<T | null>;
  findMany<T>(
    collection: string,
    query?: Record<string, any>,
    sort?: Record<string, number>
  ): Promise<T[]>;
  insertOne<T>(collection: string, data: Record<string, any>): Promise<T>;
  updateOne(
    collection: string,
    id: string,
    data: Record<string, any>
  ): Promise<void>;
  upsertOne(
    collection: string,
    query: Record<string, any>,
    data: Record<string, any>
  ): Promise<void>;
  deleteOne(collection: string, id: string): Promise<void>;
  countDocuments(collection: string, query?: Record<string, any>): Promise<number>;
}
