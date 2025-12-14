// Shared CORS configuration for Edge Functions
// SECURITY UPDATE: Replace wildcard (*) with specific domain

// BEFORE (INSECURE):
// 'Access-Control-Allow-Origin': '*'  // ❌ Any website can call API

// AFTER (SECURE):
const ALLOWED_ORIGINS = [
  'https://unexplainedarchive.com',        // Production
  'https://www.unexplainedarchive.com',   // Production www
  'https://preview.unexplainedarchive.com', // Staging
  'http://localhost:5173',                 // Local development (Vite)
  'http://localhost:3000',                 // Local development (alternative)
];

export function getCorsHeaders(requestOrigin?: string): Record<string, string> {
  // Check if origin is in allowed list
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0]; // Default to production

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// USAGE IN EDGE FUNCTIONS:
/*
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Your function logic here
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
*/

// ENVIRONMENT-BASED CONFIGURATION (recommended for production):
/*
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [
  'https://unexplainedarchive.com'
];
*/

// =============================================================================
// FILES TO UPDATE (16 total):
// =============================================================================
// 1. supabase/functions/_shared/cors.ts (UPDATE THIS FIRST)
// 2. supabase/functions/reconcile-accounts/index.ts
// 3. supabase/functions/gemini-proxy/index.ts
// 4. supabase/functions/upgrade-subscription/index.ts
// 5. supabase/functions/send-mass-notification/index.ts
// 6. supabase/functions/send-contact-email/index.ts
// 7. supabase/functions/resume-subscription/index.ts
// 8. supabase/functions/subscribe/index.ts
// 9. supabase/functions/transfer-fees-to-revenue/index.ts
// 10. supabase/functions/cancel-subscription/index.ts
// 11. supabase/functions/request-verification-checkout/index.ts
// 12. supabase/functions/create-direct-payment-checkout/index.ts
// 13. supabase/functions/process-withdrawals/index.ts
// 14. supabase/functions/request-withdrawal/index.ts
// 15. supabase/functions/create-escrow-payment-checkout/index.ts
// 16. supabase/functions/stripe-webhook/index.ts (⚠️ CRITICAL: webhooks should NOT use CORS)

// =============================================================================
// SPECIAL CASE: Stripe Webhook
// =============================================================================
// stripe-webhook/index.ts should NOT have CORS headers
// Webhooks are called by Stripe servers, not browsers
/*
Deno.serve(async (req) => {
  // NO CORS HEADERS FOR WEBHOOKS!
  // Only Stripe servers should call this

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 401 });
  }

  // Process webhook...
});
*/

// =============================================================================
// DEPLOYMENT CHECKLIST:
// =============================================================================
// [ ] Update _shared/cors.ts with getCorsHeaders function
// [ ] Update all 15 Edge Functions to use getCorsHeaders()
// [ ] Remove CORS from stripe-webhook/index.ts
// [ ] Add ALLOWED_ORIGINS environment variable in Supabase Dashboard
// [ ] Test from production domain
// [ ] Verify localhost still works for development

// =============================================================================
// TESTING:
// =============================================================================
// Test from allowed domain:
// curl -H "Origin: https://unexplainedarchive.com" https://your-project.supabase.co/functions/v1/some-function
// Response should include: Access-Control-Allow-Origin: https://unexplainedarchive.com

// Test from unauthorized domain:
// curl -H "Origin: https://evil-site.com" https://your-project.supabase.co/functions/v1/some-function
// Response should include: Access-Control-Allow-Origin: https://unexplainedarchive.com (default)

export default { getCorsHeaders, ALLOWED_ORIGINS };
