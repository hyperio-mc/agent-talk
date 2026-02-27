# Archived Files

These files were moved here during the HYPR refactoring (Phase 1).

## What's Replacing Them

| Original | Replacement |
|----------|-------------|
| `db/` | HYPR Micro (managed PostgreSQL) |
| `routes/auth.ts` | HYPR Auth / WorkOS integration |
| `routes/health.ts` | HYPR platform handles health checks |
| `routes/admin.ts` | HYPR Dashboard |
| `middleware/auth.ts` | HYPR Auth middleware |
| `services/user.ts` | HYPR Micro user table queries |

## When to Delete

These files can be deleted once:
1. HYPR Micro tables are created and migrated
2. HYPR Auth / WorkOS is configured
3. All routes are updated to use HYPR client libraries

## Restoration

If you need to restore these files:
```bash
# Restore db
cp -r _archived/db ..

# Restore routes
cp _archived/routes/auth.ts ../routes/
cp _archived/routes/health.ts ../routes/
cp _archived/routes/admin.ts ../routes/
```