import { Prisma } from "@prisma/client";

export interface PageCursor { at: Date; id: string }
export interface PageRequest {
  from: Date | undefined;
  through: Date;
  cursor: PageCursor | undefined;
  take: number;
}

/** Replay timestamp ties and a bounded overlap; advance only after a committed page. */
export async function copyHistory<T extends { id: string }>(options: {
  latest: () => Promise<Date | null>;
  read: (page: PageRequest) => Promise<T[]>;
  write: (rows: T[]) => Promise<{ count: number }>;
  timestamp: (row: T) => Date;
  through: Date;
  batchSize?: number;
}): Promise<{ read: number; inserted: number }> {
  const latest = await options.latest();
  // Source writers use DB-generated ingestion times. Two hours of replay
  // covers interrupted hourly runs and transactions committing out of order.
  const from = latest ? new Date(latest.getTime() - 2 * 60 * 60 * 1000) : undefined;
  const take = options.batchSize ?? 1000;
  let cursor: PageCursor | undefined;
  let read = 0;
  let inserted = 0;
  for (;;) {
    const rows = await options.read({ from, through: options.through, cursor, take });
    if (!rows.length) break;
    const last = rows[rows.length - 1];
    const next = { at: options.timestamp(last), id: last.id };
    if (cursor && (next.at.getTime() < cursor.at.getTime() ||
      (next.at.getTime() === cursor.at.getTime() && next.id <= cursor.id))) {
      throw new Error("Mirror page cursor did not advance");
    }
    const result = await options.write(rows);
    read += rows.length;
    inserted += result.count;
    cursor = next;
    if (rows.length < take) break;
  }
  return { read, inserted };
}

const TABLE_COLUMNS = {
  ApiKey: ["id", "key", "name", "active", "createdAt"],
  CustomSearch: ["id", "query", "provider", "active", "apiKeyId", "createdAt"],
  Source: ["id", "name", "slug", "feedUrl", "active", "category"],
  BrandLogo: ["id", "brand", "keywords", "filename", "source", "createdAt"],
} as const;
type ConfigTable = keyof typeof TABLE_COLUMNS;
type Value = string | number | boolean | Date | string[] | null;
type ConfigRow = { id: string } & Record<string, Value>;
const ident = (value: string) => Prisma.raw('"' + value.replaceAll('"', '""') + '"');
const bind = (value: Value) => Array.isArray(value)
  ? (value.length ? Prisma.sql`ARRAY[${Prisma.join(value)}]::text[]` : Prisma.sql`ARRAY[]::text[]`)
  : Prisma.sql`${value}`;

/** Parameterized batches, with no UPDATE when the source values are unchanged. */
export function configUpsert(table: ConfigTable, rows: ConfigRow[]): Prisma.Sql {
  if (!rows.length) throw new Error("Cannot upsert an empty configuration batch");
  const columns = TABLE_COLUMNS[table];
  const mutable = columns.filter((c) => c !== "id" && c !== "createdAt");
  for (const row of rows) {
    for (const column of columns) {
      if (!(column in row) || row[column] === undefined) throw new Error(`Missing ${table}.${column}`);
    }
  }
  const tuples = rows.map((row) => Prisma.sql`(${Prisma.join(columns.map((c) => bind(row[c])))})`);
  const updates = mutable.map((c) => Prisma.sql`${ident(c)} = EXCLUDED.${ident(c)}`);
  const changes = mutable.map((c) => Prisma.sql`target.${ident(c)} IS DISTINCT FROM EXCLUDED.${ident(c)}`);
  return Prisma.sql`INSERT INTO ${ident(table)} AS target (${Prisma.join(columns.map(ident))})
    VALUES ${Prisma.join(tuples)} ON CONFLICT (id) DO UPDATE SET ${Prisma.join(updates)}
    WHERE ${Prisma.join(changes, " OR ")}`;
}

export async function copyConfig(table: ConfigTable, rows: ConfigRow[], execute: (query: Prisma.Sql) => Promise<number>): Promise<number> {
  let changed = 0;
  for (let offset = 0; offset < rows.length; offset += 500) {
    changed += await execute(configUpsert(table, rows.slice(offset, offset + 500)));
  }
  return changed;
}
