import pg, { type PoolClient, type PoolConfig } from 'pg';

export function createPool(connectionString: string, options: PoolConfig = {}) {
  return new pg.Pool({
    connectionString, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
    ...options,
    types: { getTypeParser(oid, format) {
      if (oid === 20) return (value: string) => {
        const number = Number(value);
        if (!Number.isSafeInteger(number)) throw new RangeError('Database integer exceeds safe JSON range');
        return number;
      };
      return pg.types.getTypeParser(oid, format);
    } },
  });
}

export type Database = ReturnType<typeof createPool>;

export async function transaction<T>(pool: Database, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'");
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { broken = true; }
    throw error;
  } finally {
    client.release(broken);
  }
}
