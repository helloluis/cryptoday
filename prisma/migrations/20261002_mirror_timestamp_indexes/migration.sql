-- Apply to source and mirror separately, outside BEGIN, so existing writes continue.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Article_fetchedAt_id_idx"
  ON "Article" ("fetchedAt", "id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CryptoPriceHistory_timestamp_id_idx"
  ON "CryptoPriceHistory" ("timestamp", "id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ForexRateHistory_timestamp_id_idx"
  ON "ForexRateHistory" ("timestamp", "id");
