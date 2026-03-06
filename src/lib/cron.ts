/**
 * Cron job configuration for staggered harvesting.
 *
 * Deploy this as a separate process or use an external cron service
 * to call the harvest endpoint at staggered intervals.
 *
 * Recommended crontab entries (on VPS):
 *
 *   # Harvest batch 0 (sources 1-3) at minute 0
 *   0 * * * * curl -s -X POST http://localhost:3000/api/harvest -H "Authorization: Bearer YOUR_CRON_SECRET" -H "Content-Type: application/json" -d '{"batch": 0}'
 *
 *   # Harvest batch 1 (sources 4-6) at minute 15
 *   15 * * * * curl -s -X POST http://localhost:3000/api/harvest -H "Authorization: Bearer YOUR_CRON_SECRET" -H "Content-Type: application/json" -d '{"batch": 1}'
 *
 *   # Harvest batch 2 (sources 7-9) at minute 30
 *   30 * * * * curl -s -X POST http://localhost:3000/api/harvest -H "Authorization: Bearer YOUR_CRON_SECRET" -H "Content-Type: application/json" -d '{"batch": 2}'
 *
 *   # Harvest batch 3 (sources 10-12) at minute 45
 *   45 * * * * curl -s -X POST http://localhost:3000/api/harvest -H "Authorization: Bearer YOUR_CRON_SECRET" -H "Content-Type: application/json" -d '{"batch": 3}'
 *
 * This ensures all sources are harvested every hour,
 * but the load is spread across 4 intervals (every 15 minutes).
 */
