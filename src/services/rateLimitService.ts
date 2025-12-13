// Rate Limiting Service using localStorage (client-side)
// For production, replace with Upstash Redis via Supabase Edge Functions

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // AI Image Generation - 2 per case submission (FREE)
  ai_image_generation: { maxRequests: 2, windowMs: 0 }, // Per case, not time-based
  
  // Case Submission - 10 per day
  case_submission: { maxRequests: 10, windowMs: 24 * 60 * 60 * 1000 },
  
  // Comments - 100 per hour
  comment_creation: { maxRequests: 100, windowMs: 60 * 60 * 1000 },
  
  // API Calls - 1000 per hour
  api_general: { maxRequests: 1000, windowMs: 60 * 60 * 1000 },
  
  // Login Attempts - 5 per 15 minutes
  login_attempt: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  
  // Password Reset - 3 per hour
  password_reset: { maxRequests: 3, windowMs: 60 * 60 * 1000 }
};

export const rateLimitService = {
  // Check if action is allowed
  checkLimit(userId: string, action: string): { allowed: boolean; resetIn?: number; remaining?: number } {
    const config = RATE_LIMITS[action];
    if (!config) return { allowed: true };

    const key = `ratelimit_${userId}_${action}`;
    const stored = localStorage.getItem(key);
    const now = Date.now();

    if (!stored) {
      // First request
      this.recordRequest(userId, action, config);
      return { allowed: true, remaining: config.maxRequests - 1 };
    }

    const record: RateLimitRecord = JSON.parse(stored);

    // Check if window has expired
    if (now >= record.resetTime) {
      // Reset window
      this.recordRequest(userId, action, config);
      return { allowed: true, remaining: config.maxRequests - 1 };
    }

    // Within window - check count
    if (record.count >= config.maxRequests) {
      const resetIn = Math.ceil((record.resetTime - now) / 1000);
      return { allowed: false, resetIn };
    }

    // Increment count
    record.count++;
    localStorage.setItem(key, JSON.stringify(record));
    return { allowed: true, remaining: config.maxRequests - record.count };
  },

  // Record a request
  recordRequest(userId: string, action: string, config: RateLimitConfig) {
    const key = `ratelimit_${userId}_${action}`;
    const record: RateLimitRecord = {
      count: 1,
      resetTime: Date.now() + config.windowMs
    };
    localStorage.setItem(key, JSON.stringify(record));
  },

  // Special: AI image generation per case (not time-based)
  checkAIGenerationForCase(userId: string, caseId: string): { allowed: boolean; remaining: number } {
    const key = `ai_generation_${userId}_case_${caseId}`;
    const stored = localStorage.getItem(key);
    const maxGenerations = 2;

    if (!stored) {
      localStorage.setItem(key, '1');
      return { allowed: true, remaining: 1 };
    }

    const count = parseInt(stored);
    if (count >= maxGenerations) {
      return { allowed: false, remaining: 0 };
    }

    localStorage.setItem(key, (count + 1).toString());
    return { allowed: true, remaining: maxGenerations - count - 1 };
  },

  // Get remaining requests
  getRemaining(userId: string, action: string): number {
    const config = RATE_LIMITS[action];
    if (!config) return Infinity;

    const key = `ratelimit_${userId}_${action}`;
    const stored = localStorage.getItem(key);
    if (!stored) return config.maxRequests;

    const record: RateLimitRecord = JSON.parse(stored);
    const now = Date.now();

    if (now >= record.resetTime) {
      return config.maxRequests;
    }

    return Math.max(0, config.maxRequests - record.count);
  },

  // Clear all rate limits for user (admin function)
  clearLimits(userId: string) {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(`ratelimit_${userId}_`)) {
        localStorage.removeItem(key);
      }
    });
  }
};

// Production Redis implementation (for Supabase Edge Function)
export const redisRateLimitService = {
  async checkLimit(userId: string, action: string) {
    try {
      const response = await fetch('/api/rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action })
      });
      return await response.json();
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return { allowed: true }; // Fail open
    }
  }
};
