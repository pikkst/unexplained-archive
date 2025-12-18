// Helper functions for webhook failure handling and notifications
// Import this in stripe-webhook/index.ts

export async function logWebhookFailure(
  supabaseAdmin: any,
  stripeEventId: string,
  eventType: string,
  failureReason: string,
  eventPayload: any
) {
  try {
    const { data, error } = await supabaseAdmin.rpc('log_webhook_failure', {
      p_stripe_event_id: stripeEventId,
      p_event_type: eventType,
      p_failure_reason: failureReason,
      p_event_payload: eventPayload,
    });

    if (error) {
      console.error('Failed to log webhook failure:', error);
    } else {
      console.log('Webhook failure logged:', data);
    }
  } catch (err) {
    console.error('Error logging webhook failure:', err);
  }
}

export async function notifyPaymentFailure(
  supabaseAdmin: any,
  userId: string,
  failureType: string,
  amount: number,
  reason?: string
) {
  try {
    await supabaseAdmin.rpc('notify_payment_failure', {
      p_user_id: userId,
      p_failure_type: failureType,
      p_amount: amount,
      p_reason: reason,
    });
    console.log(`Payment failure notification sent to user ${userId}`);
  } catch (err) {
    console.error('Error sending payment failure notification:', err);
  }
}

export async function checkRateLimit(
  supabaseAdmin: any,
  identifier: string,
  identifierType: string,
  endpoint: string,
  maxRequests: number = 10,
  windowMinutes: number = 60
): Promise<{ allowed: boolean; reason?: string; retryAfter?: Date }> {
  try {
    const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_identifier_type: identifierType,
      p_endpoint: endpoint,
      p_max_requests: maxRequests,
      p_window_minutes: windowMinutes,
    });

    if (error) {
      console.error('Rate limit check error:', error);
      return { allowed: true }; // Fail open in case of errors
    }

    return data;
  } catch (err) {
    console.error('Error checking rate limit:', err);
    return { allowed: true }; // Fail open
  }
}

export async function detectFraudPattern(
  supabaseAdmin: any,
  userId: string,
  amount: number,
  paymentMethod?: string
): Promise<{ suspicious: boolean; flags?: any[] }> {
  try {
    const { data, error } = await supabaseAdmin.rpc('detect_fraud_pattern', {
      p_user_id: userId,
      p_amount: amount,
      p_payment_method: paymentMethod,
    });

    if (error) {
      console.error('Fraud detection error:', error);
      return { suspicious: false }; // Fail open
    }

    return data;
  } catch (err) {
    console.error('Error detecting fraud:', err);
    return { suspicious: false };
  }
}

export function getClientIP(req: Request): string {
  // Try to get real IP from headers (if behind proxy)
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to connection info (Deno Deploy)
  const connInfo = (req as any).connInfo;
  if (connInfo?.remoteAddr) {
    return connInfo.remoteAddr.hostname || 'unknown';
  }

  return 'unknown';
}
