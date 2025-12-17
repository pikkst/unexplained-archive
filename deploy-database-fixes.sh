#!/bin/bash
# Deploy database fixes for case_theories and cases queries

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Database Query Fix Deployment${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI is not installed${NC}"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

# Check if we're logged in
if ! supabase projects list &> /dev/null; then
    echo -e "${RED}Error: Not logged in to Supabase${NC}"
    echo "Run: supabase login"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI is ready${NC}"
echo ""

# Get the project ref
echo -e "${YELLOW}Enter your Supabase project ref (from Project Settings > General):${NC}"
read -r PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo -e "${RED}Error: Project ref is required${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Step 1: Fix case_theories foreign key${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Apply the migration
echo -e "Applying migration: 20251217_fix_case_theories_profile_fk.sql"
supabase db push --project-ref "$PROJECT_REF" --include-all

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migration applied successfully${NC}"
else
    echo -e "${RED}✗ Migration failed${NC}"
    echo "You can manually apply it from Supabase Dashboard > SQL Editor"
    echo "File: supabase/migrations/20251217_fix_case_theories_profile_fk.sql"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Fixed issues:"
echo "  1. Changed incident_date → date_occurred in cases queries"
echo "  2. Fixed case_theories foreign key to reference profiles table"
echo ""
echo "The app should now work without console errors!"
