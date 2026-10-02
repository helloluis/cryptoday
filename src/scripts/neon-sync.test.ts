import assert from "node:assert/strict";
import { test } from "node:test";
import { configUpsert, copyHistory, type PageRequest } from "./neon-sync";

test("resuming a failed page preserves every record sharing a timestamp", async () => {
  const at = new Date("2026-10-02T00:00:00Z");
  const rows = ["a", "b", "c", "d", "e"].map((id) => ({ id, at }));
  const mirrored = new Map<string, typeof rows[number]>();
  const read = async ({ from, through, cursor, take }: PageRequest) => rows.filter((r) =>
    (!from || r.at >= from) && r.at <= through &&
    (!cursor || r.at > cursor.at || (+r.at === +cursor.at && r.id > cursor.id)),
  ).slice(0, take);
  let fail = true;
  const run = () => copyHistory<typeof rows[number]>({
    latest: async () => mirrored.size ? at : null,
    through: at, batchSize: 2, read, timestamp: (r) => r.at,
    write: async (batch) => {
      if (fail && batch[0].id === "c") throw new Error("connection interrupted");
      let count = 0;
      for (const row of batch) if (!mirrored.has(row.id)) { mirrored.set(row.id, row); count++; }
      return { count };
    },
  });
  await assert.rejects(run(), /connection interrupted/);
  assert.deepEqual([...mirrored.keys()], ["a", "b"]);
  fail = false;
  assert.deepEqual(await run(), { read: 5, inserted: 3 });
  assert.deepEqual([...mirrored.keys()], ["a", "b", "c", "d", "e"]);
  assert.deepEqual(await run(), { read: 5, inserted: 0 });
});

test("configuration values stay bound, including arrays and SQL-looking strings", () => {
  const hostile = "x'); DROP TABLE BrandLogo; --";
  const statement = configUpsert("BrandLogo", [{
    id: "1", brand: hostile, keywords: [hostile, "safe"], filename: "logo.svg",
    source: "manual", createdAt: new Date("2026-10-01"),
  }, {
    id: "2", brand: "empty", keywords: [], filename: "empty.svg",
    source: "manual", createdAt: new Date("2026-10-01"),
  }]);
  assert.ok(!statement.text.includes(hostile));
  assert.ok(statement.values.includes(hostile));
  assert.match(statement.text, /IS DISTINCT FROM/);
  assert.match(statement.text, /ARRAY\[\]::text\[\]/);
});
