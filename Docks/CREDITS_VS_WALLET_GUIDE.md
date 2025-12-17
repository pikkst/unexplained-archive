# 💰 KREDIIDID vs RAHAKOTT - Täielik Juhend

## 🎯 Kahe Valuuta Süsteem

Platformil on **2 tüüpi valuutat**:

### 1️⃣ WALLET (Rahakott) - Reaalne Raha 💵
- **Valuuta**: EUR (eurod)
- **Kuidas saada**: Stripe makse, Paypal
- **Kuidas kasutada**: 
  - ✅ Donate case'idele (suurenda reward pool'i)
  - ✅ Boost omale case'i (tõsta esile)
  - ✅ Premium subscription
  - ✅ Withdrawals (investigaatorid saavad välja võtta)

### 2️⃣ CREDITS (Krediidid) - Virtuaalne Valuuta 🎟️
- **Valuuta**: Credits (punktid)
- **Kuidas saada**: 
  - 🎉 Promotional campaigns (esimesed 100 kasutajat)
  - 🎁 Promo koodid
  - 🏆 Reward süsteemist
  - 👨‍💼 Admin'i poolt antud
- **Kuidas kasutada**:
  - ✨ AI image generation (2 tasuta, siis 5 credits per image)
  - 📝 AI teksti analüüs
  - 💬 Premium features
  - 🎯 Case donation (kui tahad, võid credits'iga doneerida)

---

## 📊 Database Schema

### Profiles Table (Credits storage)
```sql
ALTER TABLE profiles ADD COLUMN credits INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN lifetime_credits_earned INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN lifetime_credits_spent INTEGER DEFAULT 0;
```

### Credit Transactions Table (History log)
```sql
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    transaction_type VARCHAR(50), -- 'earned', 'spent', 'promo', 'reward'
    source VARCHAR(100), -- 'campaign_redemption', 'ai_generation', etc.
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔄 Kuidas Credits Töötavad

### 1. Kasutaja lunastab promo koodi
```
User → Enters code "FIRST100" → Promotional Banner

Backend:
1. redeem_promo_code('FIRST100', user_id)
2. Creates campaign_redemption record
3. TRIGGER: grant_credits_on_redemption()
4. Calls: add_user_credits(user_id, 10, 'promo', 'campaign_redemption')
5. Updates profiles.credits = credits + 10
6. Logs to credit_transactions table

Result: User now has 10 credits! 🎉
```

### 2. Kasutaja kasutab credits AI generation'iks
```
User → Clicks "Generate AI Image" → SubmitCaseForm

Frontend:
1. Check user credits: getCredits(userId)
2. If credits >= 5: Show "Use 5 credits" option
3. User confirms

Backend:
1. spend_user_credits(user_id, 5, 'ai_generation', 'AI image for case')
2. Checks if credits >= 5
3. Updates profiles.credits = credits - 5
4. Logs -5 to credit_transactions
5. Calls Gemini API to generate image
6. Returns image_url

Result: User has 5 credits left, gets AI image ✨
```

### 3. Admin annab kasutajale credits'e
```
Admin → Admin Dashboard → User Management → Grant Credits

Frontend:
<input type="number" placeholder="Amount" />
<textarea placeholder="Reason" />
<button>Grant Credits</button>

Backend:
admin_grant_credits(admin_id, user_id, 50, 'Platform issue compensation')

Result: User gets 50 bonus credits 🎁
```

---

## 💻 API Functions

### Get User Credits
```typescript
const { data } = await supabase.rpc('get_user_credits', {
  p_user_id: userId
});

// Returns:
{
  success: true,
  balance: 15,
  lifetime_earned: 20,
  lifetime_spent: 5
}
```

### Spend Credits
```typescript
const { data } = await supabase.rpc('spend_user_credits', {
  p_user_id: userId,
  p_amount: 5,
  p_source: 'ai_generation',
  p_description: 'AI image for UFO case',
  p_case_id: caseId
});

// Returns:
{
  success: true,
  transaction_id: 'uuid',
  new_balance: 10,
  amount: -5
}

// Or error:
{
  success: false,
  error: 'Insufficient credits',
  required: 5,
  available: 2
}
```

### Add Credits (Internal/Admin)
```typescript
const { data } = await supabase.rpc('add_user_credits', {
  p_user_id: userId,
  p_amount: 10,
  p_transaction_type: 'promo',
  p_source: 'campaign_redemption',
  p_description: 'First 100 users bonus',
  p_campaign_redemption_id: redemptionId
});
```

### Admin Grant Credits
```typescript
const { data } = await supabase.rpc('admin_grant_credits', {
  p_admin_id: adminId,
  p_user_id: targetUserId,
  p_amount: 50,
  p_reason: 'Compensation for platform downtime'
});
```

---

## 🎨 Frontend Integration

### Display Credits Balance
```tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const CreditsBadge = ({ userId }) => {
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    loadCredits();
    
    // Real-time subscription
    const subscription = supabase
      .from('profiles')
      .on('UPDATE', payload => {
        if (payload.new.id === userId) {
          setCredits(payload.new.credits);
        }
      })
      .subscribe();
    
    return () => subscription.unsubscribe();
  }, [userId]);

  const loadCredits = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();
    
    if (data) setCredits(data.credits);
  };

  return (
    <div className="flex items-center gap-2 bg-purple-600/20 px-3 py-1 rounded-full">
      <span className="text-2xl">🎟️</span>
      <span className="font-bold text-purple-300">{credits} Credits</span>
    </div>
  );
};
```

### Use Credits for AI Generation
```tsx
const handleGenerateAiImage = async () => {
  // Check if user has enough credits
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', currentUser.id)
    .single();
  
  if (profile.credits < 5) {
    alert('You need 5 credits to generate an AI image. Redeem a promo code to get credits!');
    return;
  }
  
  // Spend credits
  const { data: spendResult } = await supabase.rpc('spend_user_credits', {
    p_user_id: currentUser.id,
    p_amount: 5,
    p_source: 'ai_generation',
    p_description: `AI image generation for case: ${formData.title}`,
    p_case_id: null // Will be set after case is created
  });
  
  if (!spendResult.success) {
    alert(spendResult.error);
    return;
  }
  
  // Generate image
  const result = await caseService.generateAIImage(/* ... */);
  
  // Show new balance
  alert(`Image generated! Credits remaining: ${spendResult.new_balance}`);
};
```

### Credits Transaction History
```tsx
const CreditsHistory = ({ userId }) => {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    const { data } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    
    setTransactions(data || []);
  };

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-bold">Credits History</h3>
      {transactions.map(tx => (
        <div key={tx.id} className={`p-3 rounded-lg ${
          tx.amount > 0 ? 'bg-green-900/20 border-green-500' : 'bg-red-900/20 border-red-500'
        } border`}>
          <div className="flex justify-between">
            <span className="font-bold">
              {tx.amount > 0 ? '+' : ''}{tx.amount} credits
            </span>
            <span className="text-sm text-gray-400">
              Balance: {tx.balance_after}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">{tx.description}</p>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(tx.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
};
```

---

## 🎯 Use Cases

### Scenario 1: New User Gets Promo Credits
```
1. User signs up
2. Sees promotional banner: "First 100 users get 10 free credits!"
3. Clicks "Claim"
4. Code "FIRST100" is redeemed
5. User gets 10 credits automatically
6. Can now generate 2 AI images (5 credits each)
```

### Scenario 2: User Wants More AI Images
```
1. User has 0 credits left
2. Options to get more:
   - 💰 Buy credits bundle (5€ = 50 credits)
   - 🎁 Redeem another promo code
   - 🏆 Earn credits by completing tasks
   - 💵 Use wallet balance directly (0.10€ per generation)
```

### Scenario 3: Admin Gives Bonus Credits
```
1. Platform had downtime
2. Admin compensates affected users
3. Admin → User Management → Select users
4. Grant 20 credits to each
5. Users see notification: "You've received 20 bonus credits!"
```

---

## 📈 Credits Pricing Strategy

### Free Tier
- ✅ 2 AI generations per case (free, no credits needed)
- ✅ 10 credits from "First 100" promo
- ✅ 5 credits per referral

### Paid Credits
- 💵 5€ = 50 credits
- 💵 10€ = 120 credits (20% bonus)
- 💵 20€ = 250 credits (25% bonus)

### Credits Usage Costs
- ✨ AI Image Generation: **5 credits**
- 📝 AI Text Analysis: **3 credits**
- 🎯 Featured Case (24h): **20 credits**
- 💬 Premium Chat AI: **10 credits/day**

---

## 🔐 Security Notes

1. **Credits are NOT transferable** - Users cannot send credits to each other
2. **Credits have no cash value** - Cannot be withdrawn or refunded
3. **Atomic operations** - All credit transactions use PostgreSQL ACID guarantees
4. **Audit trail** - All transactions logged in `credit_transactions` table
5. **RLS enabled** - Users can only view their own credit history
6. **Admin only** - Only admins can manually grant/remove credits

---

## 🎉 Summary

| Feature | Wallet (EUR) | Credits |
|---------|--------------|---------|
| **Type** | Real money | Virtual currency |
| **How to get** | Stripe payment | Promo codes, rewards |
| **Transferable** | ❌ No | ❌ No |
| **Withdrawable** | ✅ Yes (investigators) | ❌ No |
| **Use for donations** | ✅ Yes | ⚠️ Optional |
| **Use for AI** | ✅ Yes (0.10€) | ✅ Yes (5 credits) |
| **Expires** | ❌ Never | ❌ Never |
| **Buy more** | Stripe checkout | Credit bundles |

**Bottom line**: Wallet = real money system, Credits = promotional rewards system! 🎯
