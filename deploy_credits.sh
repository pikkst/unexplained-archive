#!/bin/bash
echo "📤 Deploying Credits System to Supabase..."
echo ""

# Use Supabase REST API to execute SQL
PROJECT_REF="plyyjvbemdsubmnvudvr"
SQL_CONTENT=$(cat supabase/migrations/20251217_user_credits_system.sql)

echo "✅ SQL migration ready to deploy"
echo "📝 Open SQL Editor and paste the content from:"
echo "   supabase/migrations/20251217_user_credits_system.sql"
echo ""
echo "🔗 Direct link:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
echo ""
echo "Or run manually with psql:"
echo "   psql \$DATABASE_URL -f supabase/migrations/20251217_user_credits_system.sql"
