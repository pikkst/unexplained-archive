-- Translate subscription plan descriptions to English
UPDATE subscription_plans
SET 
  description = CASE plan_code
    WHEN 'basic' THEN 'Affordable access to AI tools. Perfect for beginners.'
    WHEN 'premium' THEN 'Unlimited AI power for professionals. Most popular!'
    WHEN 'pro' THEN 'Enterprise solution for teams and agencies.'
    ELSE description
  END,
  updated_at = NOW()
WHERE plan_code IN ('basic', 'premium', 'pro');
