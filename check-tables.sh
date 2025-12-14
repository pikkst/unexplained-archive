#!/bin/bash
# Quick script to check table status locally

echo "================================================"
echo "🔍 CHECKING TABLE RLS STATUS"
echo "================================================"
echo ""

# Check if we have any SQL files that create tables
echo "📋 Tables defined in SQL files:"
grep -h "CREATE TABLE" supabase/*.sql 2>/dev/null | \
  grep -oE "CREATE TABLE[^(]+" | \
  sed 's/CREATE TABLE IF NOT EXISTS //g' | \
  sed 's/CREATE TABLE //g' | \
  sort -u | \
  awk '{printf "   - %s\n", $1}'

echo ""
echo "================================================"
echo "🔒 Tables with RLS policies in our SQL files:"
echo "================================================"
grep -h "ALTER TABLE.*ENABLE ROW LEVEL SECURITY" supabase/*.sql 2>/dev/null | \
  grep -oE "ALTER TABLE[^E]+" | \
  sed 's/ALTER TABLE IF EXISTS //g' | \
  sed 's/ALTER TABLE //g' | \
  sort -u | \
  awk '{printf "   ✅ %s\n", $1}'

echo ""
echo "================================================"
echo "📊 Policy Statistics:"
echo "================================================"
total_tables=$(grep -h "CREATE TABLE" supabase/*.sql 2>/dev/null | wc -l)
rls_tables=$(grep -h "ENABLE ROW LEVEL SECURITY" supabase/*.sql 2>/dev/null | wc -l)
policies=$(grep -h "CREATE POLICY" supabase/*.sql 2>/dev/null | wc -l)

echo "   Total CREATE TABLE statements: $total_tables"
echo "   Tables with RLS enabled: $rls_tables"
echo "   Total policies created: $policies"
echo ""

echo "================================================"
echo "⚠️  To check actual database status:"
echo "================================================"
echo "Run this in Supabase SQL Editor:"
echo ""
echo "   SELECT tablename, rowsecurity FROM pg_tables"
echo "   WHERE schemaname = 'public' ORDER BY tablename;"
echo ""
echo "Or use the full analysis script:"
echo "   supabase/check-rls-status.sql"
echo "================================================"
