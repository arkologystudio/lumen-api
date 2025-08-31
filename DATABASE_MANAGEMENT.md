# Database Management Guide

## Overview

This guide explains how to safely manage the Lighthouse API database, including initialization, reset, and product management.

## Important: Shared Database Environment

⚠️ **WARNING**: The development and production environments share the same Supabase database. Be extremely careful when performing database operations.

## Automatic Initialization

The system automatically initializes products on first startup:

1. When the server starts, it checks if products exist in the database
2. If no products are found, it automatically loads them from `src/config/products.config.json`
3. An initialization record is created to prevent duplicate initialization
4. Subsequent server restarts will NOT reinitialize products

## CLI Commands

### Check Database Status
```bash
npm run db:status
```
Shows:
- Initialization status (initialized/not initialized)
- Configuration version
- When products were initialized
- Database statistics (users, sites, products, etc.)

### Initialize Products (if needed)
```bash
npm run db:init
```
- Only initializes if products don't already exist
- Safe to run multiple times (idempotent)

### Reset Database (Clean)
```bash
npm run db:reset-clean
```
- **DANGER**: Deletes ALL data from the database
- Requires confirmation (add `-y` to skip)
- Does NOT automatically reinitialize products
- Use this when you want a completely clean database

### Reset and Reinitialize
```bash
npm run db:reset-reinit
```
- **DANGER**: Deletes ALL data and reinitializes products
- Requires confirmation (add `-y` to skip)
- One command to get a fresh start with products

### Force Reinitialize Products
```bash
npm run db:force-reinit
```
- Overwrites existing products with config file data
- Requires confirmation
- Use when products are corrupted or need updating

## API Endpoints (Admin Only)

All endpoints require the `x-admin-key` header with your admin API key.

### Get Database Status
```http
GET /api/admin/database/status
```

### Reset Database
```http
POST /api/admin/database/reset
Content-Type: application/json

{
  "confirm": "RESET_DATABASE"
}
```

### Reset and Reinitialize
```http
POST /api/admin/database/reset-and-reinitialize
Content-Type: application/json

{
  "confirm": "RESET_AND_REINITIALIZE"
}
```

### Force Reinitialize Products
```http
POST /api/admin/database/force-reinitialize-products
Content-Type: application/json

{
  "confirm": "FORCE_REINITIALIZE"
}
```

## Product Configuration

Products are defined in: `src/config/products.config.json`

Current products:
1. **AI Readiness Analysis** - $19/month
2. **Neural Search - Knowledge** - $29/month
3. **Neural Search - Product** - $49/month

### Modifying Products

1. Edit `src/config/products.config.json`
2. Update the version number
3. Run `npm run db:force-reinit` to apply changes

## Safety Features

1. **Initialization Tracking**: The system tracks whether products have been initialized using a `system_config` table
2. **Confirmation Required**: All destructive operations require explicit confirmation
3. **Single Source of Truth**: Products are loaded from one config file
4. **Version Control**: Product configuration includes version tracking
5. **Environment Tracking**: System tracks which environment initialized the data

## Common Scenarios

### First Time Setup
```bash
# 1. Push schema to database
npm run db:push

# 2. Check status
npm run db:status

# 3. Products will auto-initialize on server start
npm run dev
```

### Complete Reset (Development)
```bash
# Reset everything and start fresh
npm run db:reset-reinit -y
```

### Update Products After Config Change
```bash
# After editing products.config.json
npm run db:force-reinit
```

### Check What's in the Database
```bash
npm run db:status
```

## Troubleshooting

### Products Not Initializing
1. Check `npm run db:status` to see initialization status
2. Check if `SystemConfig` table exists: `npm run db:studio`
3. Manually initialize: `npm run db:init`

### Duplicate Products
1. This shouldn't happen with the new system
2. If it does: `npm run db:reset-reinit`

### Wrong Products Showing
1. Check `src/config/products.config.json` is correct
2. Run `npm run db:force-reinit` to overwrite

## Best Practices

1. **Always check status first**: Run `npm run db:status` before making changes
2. **Use config file**: Never manually insert products into the database
3. **Test locally first**: Use a local database for testing destructive operations
4. **Backup before reset**: Consider exporting data before reset operations
5. **Coordinate with team**: When sharing a database, communicate before resets

## Migration from Old System

If you have the old products (AI Ready Core, WooCommerce AI Search, etc.):

```bash
# 1. Reset the database
npm run db:reset-clean

# 2. Initialize with correct products
npm run db:init
```

## Support

For issues or questions about database management, check:
- `src/config/PRODUCTS_CONFIG_README.md` - Product configuration details
- `src/services/databaseManagement.ts` - Database management implementation
- `scripts/db-manage.ts` - CLI implementation