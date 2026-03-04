/**
 * SupabaseAdapter — v1 DB implementation. All data scoped by account ownership (owner_user_id).
 * No base64 in DB; posts store only storage paths and metadata.
 */
import { getSupabase } from './supabaseClient';
import { IDatabase } from './IDatabase';

const TABLE_ACCOUNTS = 'accounts';
const TABLE_BUSINESS_PROFILES = 'business_profiles';
const TABLE_SOCIAL_CONNECTIONS = 'social_connections';
const TABLE_SUBSCRIPTIONS = 'subscriptions';
const TABLE_TEMPLATES = 'templates';
const TABLE_POSTS = 'posts';
const TABLE_POST_PUBLISH_RESULTS = 'post_publish_results';
const TABLE_JOBS = 'jobs';

function toSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function mapKeysToCamel<T extends Record<string, any>>(obj: T): Record<string, any> {
  if (obj === null || typeof obj !== 'object') return obj;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = toCamel(k);
    out[key] = Array.isArray(v) ? v.map((i) => (typeof i === 'object' && i !== null ? mapKeysToCamel(i as Record<string, any>) : i)) : (typeof v === 'object' && v !== null && !(v instanceof Date) ? mapKeysToCamel(v as Record<string, any>) : v);
  }
  return out;
}
function mapKeysToSnake(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[toSnake(k)] = v;
  }
  return out;
}

export class SupabaseAdapter implements IDatabase {
  private table(collection: string): string {
    const map: Record<string, string> = {
      accounts: TABLE_ACCOUNTS,
      business_profiles: TABLE_BUSINESS_PROFILES,
      social_accounts: TABLE_SOCIAL_CONNECTIONS,
      social_connections: TABLE_SOCIAL_CONNECTIONS,
      subscriptions: TABLE_SUBSCRIPTIONS,
      templates: TABLE_TEMPLATES,
      posts: TABLE_POSTS,
      post_publish_results: TABLE_POST_PUBLISH_RESULTS,
      jobs: TABLE_JOBS,
    };
    return map[collection] ?? collection;
  }

  async findOne<T>(collection: string, query: Record<string, any>): Promise<T | null> {
    const supabase = getSupabase();
    const table = this.table(collection);
    let q = supabase.from(table).select('*');

    // Map common query keys to column names
    if (query._id !== undefined) {
      q = q.eq('id', query._id);
    }
    if (query.id !== undefined) {
      q = q.eq('id', query.id);
    }
    if (query.userId !== undefined) {
      if (table === TABLE_ACCOUNTS) q = q.eq('owner_user_id', query.userId);
      else q = q.eq('user_id', query.userId);
    }
    if (query.owner_user_id !== undefined) {
      q = q.eq('owner_user_id', query.owner_user_id);
    }
    if (query.account_id !== undefined) {
      q = q.eq('account_id', query.account_id);
    }
    if (query.accountId !== undefined) {
      q = q.eq('account_id', query.accountId);
    }
    if (query.platform !== undefined) {
      q = q.eq('platform', query.platform);
    }
    if (query.status !== undefined) {
      q = q.eq('status', query.status);
    }
    if (query.post_id !== undefined) {
      q = q.eq('post_id', query.post_id);
    }
    if (query.postId !== undefined) {
      q = q.eq('post_id', query.postId);
    }

    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw new Error(`Supabase findOne ${table}: ${error.message}`);
    if (!data) return null;
    const row = mapKeysToCamel(data as Record<string, any>);
    if (table === TABLE_ACCOUNTS && row.ownerUserId) {
      (row as any).userId = row.ownerUserId;
    }
    return row as T;
  }

  async findMany<T>(
    collection: string,
    query: Record<string, any> = {},
    sort: Record<string, number> = {}
  ): Promise<T[]> {
    const supabase = getSupabase();
    const table = this.table(collection);
    let q = supabase.from(table).select('*');

    if (query._id !== undefined) q = q.eq('id', query._id);
    if (query.userId !== undefined) {
      if (table === TABLE_ACCOUNTS) q = q.eq('owner_user_id', query.userId);
      else q = q.eq('user_id', query.userId);
    }
    if (query.account_id !== undefined) q = q.eq('account_id', query.account_id);
    if (query.accountId !== undefined) q = q.eq('account_id', query.accountId);
    if (query.status !== undefined) q = q.eq('status', query.status);
    if (query.post_id !== undefined) q = q.eq('post_id', query.post_id);
    if (query.postId !== undefined) q = q.eq('post_id', query.postId);
    if (query.type !== undefined) q = q.eq('type', query.type);

    const orderBy = Object.keys(sort)[0];
    if (orderBy) {
      const col = toSnake(orderBy);
      q = q.order(col, { ascending: sort[orderBy] === 1 });
    }

    const { data, error } = await q;
    if (error) throw new Error(`Supabase findMany ${table}: ${error.message}`);
    const rows = (data || []).map((d) => {
      const row = mapKeysToCamel(d as Record<string, any>);
      if (table === TABLE_ACCOUNTS && row.ownerUserId) (row as any).userId = row.ownerUserId;
      return row;
    });
    return rows as T[];
  }

  async insertOne<T>(collection: string, data: Record<string, any>): Promise<T> {
    const supabase = getSupabase();
    const table = this.table(collection);
    const row = mapKeysToSnake(data);

    const { data: inserted, error } = await supabase.from(table).insert(row).select('*').single();
    if (error) throw new Error(`Supabase insertOne ${table}: ${error.message}`);
    const out = mapKeysToCamel(inserted as Record<string, any>);
    if (table === TABLE_ACCOUNTS && out.ownerUserId) (out as any).userId = out.ownerUserId;
    return out as T;
  }

  async updateOne(collection: string, id: string, data: Record<string, any>): Promise<void> {
    const supabase = getSupabase();
    const table = this.table(collection);
    const row = mapKeysToSnake(data);
    const pk = table === TABLE_BUSINESS_PROFILES || table === TABLE_SUBSCRIPTIONS ? 'account_id' : 'id';

    const { error } = await supabase.from(table).update({ ...row, updated_at: new Date().toISOString() }).eq(pk, id);
    if (error) throw new Error(`Supabase updateOne ${table}: ${error.message}`);
  }

  async upsertOne(
    collection: string,
    query: Record<string, any>,
    data: Record<string, any>
  ): Promise<void> {
    const supabase = getSupabase();
    const table = this.table(collection);
    const row = mapKeysToSnake({ ...query, ...data });
    const conflictKey =
      table === TABLE_SUBSCRIPTIONS || table === TABLE_BUSINESS_PROFILES
        ? 'account_id'
        : table === TABLE_SOCIAL_CONNECTIONS
          ? 'account_id,platform'
          : 'id';
    const { error } = await supabase.from(table).upsert(row, { onConflict: conflictKey });
    if (error) throw new Error(`Supabase upsertOne ${table}: ${error.message}`);
  }

  async deleteOne(collection: string, id: string): Promise<void> {
    const supabase = getSupabase();
    const table = this.table(collection);
    const pk = table === TABLE_BUSINESS_PROFILES || table === TABLE_SUBSCRIPTIONS ? 'account_id' : 'id';
    const { error } = await supabase.from(table).delete().eq(pk, id);
    if (error) throw new Error(`Supabase deleteOne ${table}: ${error.message}`);
  }

  async countDocuments(collection: string, query: Record<string, any> = {}): Promise<number> {
    const supabase = getSupabase();
    const table = this.table(collection);
    let q = supabase.from(table).select('*', { count: 'exact', head: true });

    if (query.account_id !== undefined) q = q.eq('account_id', query.account_id);
    if (query.accountId !== undefined) q = q.eq('account_id', query.accountId);
    if (query.status !== undefined) q = q.eq('status', query.status);

    const { count, error } = await q;
    if (error) throw new Error(`Supabase countDocuments ${table}: ${error.message}`);
    return count ?? 0;
  }
}
