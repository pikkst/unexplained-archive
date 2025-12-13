# SQL Scripts Overview - Unexplained Archive (Refactored)

This document outlines the refactored, simplified process for setting up the Unexplained Archive database from scratch. The previous migration system has been consolidated into a logical, four-step process for clarity and maintainability.

## 🚀 New Database Setup Process

To set up a new database, execute the following scripts from the `supabase/clean_schema/` directory in the specified order.

### 1. Golden Schema (`001_golden_schema.sql`)

This script creates all tables, custom types, and relationships. It represents the complete, final state of the database schema.

**Contains:**
- All `CREATE TABLE` statements.
- `PRIMARY KEY`, `FOREIGN KEY`, and `CHECK` constraints.
- Table and column `COMMENT`s for documentation.

**Run this first:**
```bash
psql -f supabase/clean_schema/001_golden_schema.sql
```

### 2. Functions and Triggers (`002_functions_and_triggers.sql`)

This script contains all procedural logic, including database functions and triggers. It should be run after the schema is in place.

**Contains:**
- `CREATE FUNCTION` statements for application-specific business logic (e.g., `handle_new_user`, `process_direct_donation`).
- `CREATE TRIGGER` statements that automate actions based on table changes (e.g., creating a user profile on signup).

**Run this second:**
```bash
psql -f supabase/clean_schema/002_functions_and_triggers.sql
```

### 3. RLS Policies (`003_rls_policies.sql`)

This script enables and defines all Row Level Security (RLS) policies for the tables. It centralizes all security and access control rules.

**Contains:**
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statements.
- `CREATE POLICY` definitions for all tables, specifying access rights for different user roles (`admin`, `investigator`, `user`, `public`).

**Run this third:**
```bash
psql -f supabase/clean_schema/003_rls_policies.sql
```

### 4. Seeding (`004_seeding.sql`)

This script populates the database with essential initial data for the application to function correctly. It also includes optional test data for development environments.

**Contains:**
- `INSERT` statements for core data like platform Stripe accounts and the system wallet.
- Commented-out examples for creating test users, cases, and other entities.

**Run this last:**
```bash
psql -f supabase/clean_schema/004_seeding.sql
```

## 🔐 Security and Best Practices

- **Order is Crucial:** Scripts must be executed in the numbered order to ensure dependencies are met (e.g., tables must exist before policies are applied).
- **Idempotency:** Scripts are designed to be safely re-runnable where possible (e.g., using `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS`).
- **Backup:** Always back up your production database before applying any schema changes.

## 🗑️ Old Migrations

The numerous small migration files in `supabase/migrations/` are now considered deprecated. They have been consolidated into the new `clean_schema` scripts. For a new setup, these old files should **not** be used. They are kept for historical reference only and should be archived.