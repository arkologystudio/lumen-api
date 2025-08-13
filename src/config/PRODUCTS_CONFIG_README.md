# Product Configuration System

## Overview

This directory contains the **SINGLE SOURCE OF TRUTH** for all product definitions and pricing tiers in the Lighthouse ecosystem.

## Files

- `products.config.json` - The main configuration file containing all products and pricing tiers
- `products.schema.json` - JSON Schema for validation and documentation
- `PRODUCTS_CONFIG_README.md` - This documentation file

## Important Rules

### ⚠️ DO NOT MODIFY WITHOUT AUTHORIZATION

The `products.config.json` file is the authoritative source for all product definitions. Changes to this file affect:
- Database initialization
- API responses
- Frontend displays
- Billing calculations
- License validations

### How the System Works

1. **Server Startup**: When the server starts, it checks if products exist in the database
2. **Auto-initialization**: If no products exist, they are automatically loaded from `products.config.json`
3. **Single Source**: All scripts and services load product data from this config file
4. **Validation**: The JSON schema ensures data integrity

### Current Products

1. **AI Readiness Analysis** (`ai-readiness-analysis`)
   - Base Price: $19
   - Category: Analysis
   - Beta: Yes

2. **Neural Search - Knowledge** (`neural-search-knowledge`)
   - Base Price: $29
   - Category: Search
   - Beta: No

3. **Neural Search - Product** (`neural-search-product`)
   - Base Price: $49
   - Category: Search
   - Beta: No

### Making Changes

To update products or pricing:

1. **Get Authorization**: Ensure you have approval to modify product definitions
2. **Update Config**: Edit `products.config.json` following the schema
3. **Update Version**: Increment the version number and update lastUpdated date
4. **Test Locally**: Run the reset-database script to verify changes
5. **Document Changes**: Add an entry to the changelog below

### Changelog

- **v1.0.0** (2025-01-12): Initial configuration with 3 core products and tiered pricing

### Usage in Code

```typescript
// In services/ecosystemProductService.ts
const loadProductConfig = () => {
  const configPath = path.join(__dirname, "../config/products.config.json");
  const configData = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(configData);
};
```

### Scripts Using This Config

- `/src/services/ecosystemProductService.ts` - Main product service
- `/scripts/reset-database.ts` - Database reset and seeding
- `/src/index.ts` - Server initialization

### Validation

To validate the configuration:

```bash
npx ajv validate -s src/config/products.schema.json -d src/config/products.config.json
```

## Support

For questions or issues with product configuration, contact the engineering team.