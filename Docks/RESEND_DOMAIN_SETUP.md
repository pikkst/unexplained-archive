# Resend Domain Verification Setup Guide

## Overview

This guide explains how to verify your custom domain (`unexplainedarchive.com`) in Resend to enable production email sending through the contact form and admin notifications.

## Prerequisites

- Active Resend account (free tier available)
- Access to your domain provider's DNS settings (Namecheap, GoDaddy, Google Domains, etc.)
- Admin access to the domain

---

## Step 1: Add Domain to Resend Dashboard

1. Go to [Resend Domains Dashboard](https://resend.com/domains)
2. Click **Add Domain**
3. Enter your domain: `unexplainedarchive.com`
4. Click **Add**

You'll be presented with DNS records to add.

---

## Step 2: Add DNS Records

Add the following DNS records in your domain provider's control panel:

### DNS Records to Add

#### A. Domain Verification (DKIM)
| Type | Name | Content | TTL |
|------|------|---------|-----|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDeuHxx9BTiLU8bBKgCEsBV6kzpUv3sE6zKuuLpVZeE3aJxBhnCsBWFj46V5fmSeJ1kGiT8zUbqkG8O+P6P1rOweb0D9m1Z8ph1T8MxLFsgIrBAzAj3HuL8mmaKmvr1zg07rXlIC/1HTkI74CCMLmTu6RmMK1OWPGnyreex91u9nwIDAQAB` | Auto |

#### B. SPF Configuration (Enable Sending)
| Type | Name | Content | TTL | Priority |
|------|------|---------|-----|----------|
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` | Auto | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | Auto | — |

#### C. DMARC Configuration (Optional but Recommended)
| Type | Name | Content | TTL |
|------|------|---------|-----|
| TXT | `_dmarc` | `v=DMARC1; p=none;` | Auto |

#### D. MX Configuration (Enable Receiving)
| Type | Name | Content | TTL | Priority |
|------|------|---------|-----|----------|
| MX | `@` | `inbound-smtp.eu-west-1.amazonaws.com` | Auto | 10 |

---

## Step 3: DNS Setup by Provider

### Namecheap
1. Log in to Namecheap
2. Go to **Dashboard** → Your Domain → **Manage**
3. Click **Advanced DNS**
4. Click **Add New Record** and add each DNS record above
5. Save changes

### GoDaddy
1. Log in to GoDaddy
2. Go to **My Products** → Your Domain → **DNS**
3. Click **Add Record** and enter each record
4. Save changes

### Google Domains
1. Log in to Google Domains
2. Click your domain → **DNS** on the left
3. Scroll to **Custom records**
4. Click **Create new record** and add each record
5. Save changes

### Other Providers
Follow your provider's DNS management guide to add TXT, MX, and SPF records.

---

## Step 4: Verify Domain in Resend

1. Return to [Resend Domains Dashboard](https://resend.com/domains)
2. Your domain should show status as **Pending** or **Verifying**
3. Click **Check** to manually verify
4. Wait for verification (usually 24-48 hours)
5. Status will change to **Verified** ✓

---

## Step 5: Update Production Code

Once your domain is verified in Resend:

### Update Edge Function
Edit `supabase/functions/send-contact-email/index.ts`:

```typescript
body: JSON.stringify({
  from: "noreply@unexplainedarchive.com",  // Change from onboarding@resend.dev
  to: ADMIN_EMAIL,
  reply_to: email,
  subject: `[${category.toUpperCase()}] New contact form submission from ${name}`,
  // ... rest of email body
})
```

### Deploy Updated Function
```bash
npx supabase functions deploy send-contact-email
```

---

## Verification Checklist

- [ ] Domain added to Resend Dashboard
- [ ] DKIM TXT record added to DNS
- [ ] SPF MX record added (send subdomain)
- [ ] SPF TXT record added (send subdomain)
- [ ] DMARC record added (optional)
- [ ] MX record added for receiving
- [ ] All DNS records are visible in domain provider
- [ ] DNS propagation complete (24-48 hours)
- [ ] Resend shows domain as "Verified"
- [ ] Edge Function updated with production domain
- [ ] Contact form tested

---

## Testing

### During Verification (Using Test Domain)
```typescript
from: "onboarding@resend.dev"  // Use Resend's test domain
```

### After Verification (Production)
```typescript
from: "noreply@unexplainedarchive.com"  // Use your domain
```

### Test Contact Form
1. Navigate to `http://localhost:3000/contact`
2. Fill in test form:
   - **Name**: Test User
   - **Email**: your-test@example.com
   - **Category**: General Inquiry
   - **Message**: This is a test message
3. Click **Send Message**
4. Check admin inbox: emails should arrive without errors

---

## Troubleshooting

### Domain still shows "Pending" after 48 hours
- Verify all DNS records are correctly added
- Check for typos in record names and content
- Some providers cache DNS—try flushing cache
- Contact Resend support: support@resend.com

### Emails still failing with "domain not verified"
- Ensure DKIM record is exactly as provided
- Wait for complete DNS propagation (can take up to 48 hours)
- Check Resend Dashboard for specific error message

### SPF/DMARC Alignment Issues
- Verify SPF record includes `include:amazonses.com`
- Ensure DMARC policy is set to `p=none` initially
- After successful sending, can change to `p=quarantine` or `p=reject`

### Low Email Deliverability
- Ensure DKIM signature is valid
- Add SPF and DMARC records
- Use consistent sender address (`noreply@unexplainedarchive.com`)
- Test with [MXToolbox](https://mxtoolbox.com) for SPF/DKIM validation

---

## Production Deployment Checklist

Before pushing to GitHub and going live:

- [ ] Domain verified in Resend
- [ ] All DNS records properly configured
- [ ] Edge Function uses production domain
- [ ] Contact form successfully sends emails
- [ ] Admin receives emails with correct domain
- [ ] No CORS or 500 errors in browser console
- [ ] RESEND_API_KEY is set in Supabase Secrets
- [ ] No sensitive data in `.env` before committing
- [ ] GitHub Pages/Netlify/Vercel deployment tested
- [ ] Contact form tested on production domain

---

## Cost & Rate Limiting

**Resend Free Tier:**
- 100 emails per day
- Unlimited custom domains
- Unlimited team members

**Upgrade to Pro:**
- Unlimited emails
- Advanced analytics
- Priority support

For high-volume email needs, consider upgrading or implementing queue system.

---

## Additional Resources

- [Resend Documentation](https://resend.com/docs)
- [Resend Domains Guide](https://resend.com/docs/dashboard/domains)
- [SPF Record Guide](https://resend.com/docs/dashboard/domains#spf)
- [DKIM Setup](https://resend.com/docs/dashboard/domains#dkim)
- [DMARC Best Practices](https://resend.com/docs/dashboard/domains#dmarc)

---

**Last Updated:** December 13, 2025
