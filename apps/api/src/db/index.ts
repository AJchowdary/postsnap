import { IDatabase } from './IDatabase';
import { SupabaseAdapter } from './supabaseAdapter';

let _db: IDatabase | null = null;

/** v1: Supabase only. No MongoDB. */
export async function getDb(): Promise<IDatabase> {
  if (_db) return _db;
  _db = new SupabaseAdapter();
  return _db;
}
