# CLAUDE.md - Project Context for Claude Code

## Infrastructure Overview

**This project runs on a Vultr VPS, NOT Vercel.**

- **VPS IP**: 45.76.180.229
- **Project path**: `/var/www/cryptoday`
- **Process manager**: PM2 (services: `cryptoday`)
- **Database**: PostgreSQL on VPS (port 5432)

### Deployment Process

Deployment is **automatic** via GitHub Actions on push to main:

```bash
# Just commit and push - GitHub Actions handles the rest
git add -A && git commit -m "message" && git push origin main
```

### Database Connection

- **Local development**: SSH tunnel on port 5433 → `localhost:5433`
- **VPS direct**: Port 5432 → `localhost:5432`
- **Credentials**: `earnest:earnest_secure_2024@localhost/cryptoday_db`
