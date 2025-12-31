# IntakeGenie - Account & Credential Transfer Checklist

**Purpose:** List of all accounts and API keys that need to be transferred to the buyer.

---

## Required Account Transfers

### 1. Vercel (Deployment Platform)
- **URL:** https://vercel.com
- **Action Required:**
  - Transfer project ownership OR add buyer as team member with admin access
  - Export environment variables (they're in Vercel dashboard → Project → Settings → Environment Variables)
- **Key Details:**
  - Project name: IntakeGenie
  - Domain: www.intakegenie.xyz (if applicable)

### 2. Supabase (Database & Auth)
- **URL:** https://supabase.com/dashboard
- **Action Required:**
  - Transfer project ownership OR add buyer as project owner
  - Export database backup before transfer
- **Credentials to Transfer:**
  - Project URL (`NEXT_PUBLIC_SUPABASE_URL`)
  - Anon Key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
  - Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`) - **Keep secret!**
- **Location:** Project Settings → API

### 3. Vapi (AI Voice Agent)
- **URL:** https://dashboard.vapi.ai
- **Action Required:**
  - Transfer account ownership OR create new account and update API keys
- **Credentials to Transfer:**
  - API Key (`VAPI_API_KEY`)
- **Important:** Buyer needs to update webhook URLs for all assistants after transfer

### 4. Stripe (Payments)
- **URL:** https://dashboard.stripe.com
- **Action Required:**
  - Transfer account ownership OR create new account (requires new API keys)
- **Credentials to Transfer (if keeping same account):**
  - Secret Key (`STRIPE_SECRET_KEY`)
  - Publishable Key (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`)
  - Webhook Secret (`STRIPE_WEBHOOK_SECRET`)
  - Price IDs:
    - `STRIPE_PRICE_ID_STARTER`
    - `STRIPE_PRICE_ID_PROFESSIONAL`
    - `STRIPE_PRICE_ID_TURBO`
- **Location:** API Keys section and Products section
- **Important:** If creating new Stripe account, buyer needs to:
  1. Create new products (Starter $49, Professional $149, Turbo $499)
  2. Get new Price IDs
  3. Configure new webhook endpoint
  4. Update all environment variables

### 5. Resend (Email Delivery)
- **URL:** https://resend.com
- **Action Required:**
  - Transfer account ownership OR create new account
- **Credentials to Transfer:**
  - API Key (`RESEND_API_KEY`)
- **Important:** Buyer needs to verify sender domain in new account

### 6. OpenAI (Call Summarization)
- **URL:** https://platform.openai.com
- **Action Required:**
  - Transfer account access OR create new account
- **Credentials to Transfer:**
  - API Key (`OPENAI_API_KEY`)
- **Location:** API Keys section

### 7. Domain & DNS
- **Domain Registrar:** (e.g., Namecheap, GoDaddy, Cloudflare)
- **Action Required:**
  - Transfer domain ownership to buyer
  - OR provide DNS access so buyer can point domain to their infrastructure
- **Current Domain:** (if applicable - www.intakegenie.xyz)

### 8. GitHub Repository
- **URL:** https://github.com
- **Action Required:**
  - Transfer repository ownership OR add buyer as collaborator
- **Repository:** faizanprofitpilot/IntakeGenie (or current repo name)

### 9. Deepgram (Optional - Transcription)
- **URL:** https://console.deepgram.com
- **Action Required:**
  - Transfer account OR create new account (if using)
- **Credentials:**
  - API Key (`DEEPGRAM_API_KEY`)

---

## Environment Variables Summary

All environment variables are currently set in Vercel. Here's the complete list:

```env
# Application
NEXT_PUBLIC_APP_URL=https://www.intakegenie.xyz

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Vapi
VAPI_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_STARTER=
STRIPE_PRICE_ID_PROFESSIONAL=
STRIPE_PRICE_ID_TURBO=

# OpenAI
OPENAI_API_KEY=

# Resend
RESEND_API_KEY=

# Deepgram (optional)
DEEPGRAM_API_KEY=
```

---

## Post-Transfer Steps for Buyer

After receiving all credentials, buyer needs to:

1. **Update Vercel Environment Variables**
   - Replace all API keys in Vercel dashboard
   - Update `NEXT_PUBLIC_APP_URL` if domain changes

2. **Update Vapi Webhooks**
   - Go to Vapi dashboard → Assistants
   - Update webhook URL for each assistant to: `https://[buyer-domain]/api/vapi/webhook`

3. **Update Stripe Webhook**
   - Go to Stripe dashboard → Webhooks
   - Update webhook endpoint to: `https://[buyer-domain]/api/stripe/webhook`
   - Update webhook secret in environment variables

4. **Test All Integrations**
   - Test signup flow
   - Test Stripe checkout
   - Test phone number provisioning
   - Test complete call flow
   - Verify email delivery

5. **Run Database Migrations** (if setting up new Supabase instance)
   - Run all SQL files in `sql/` directory in order
   - Start with `sql/migrations.sql`

---

## Quick Reference: Where to Find API Keys

| Service | Location |
|---------|----------|
| **Supabase** | Dashboard → Project Settings → API |
| **Vapi** | Dashboard → Settings → API Keys |
| **Stripe** | Dashboard → Developers → API Keys |
| **Resend** | Dashboard → API Keys |
| **OpenAI** | Platform → API Keys |
| **Deepgram** | Dashboard → API Keys |

---

## Important Notes

- **Keep Service Role Keys Secret:** Never share `SUPABASE_SERVICE_ROLE_KEY` publicly
- **Webhook Secrets:** Stripe webhook secret must match between Stripe dashboard and environment variables
- **Price IDs:** If buyer creates new Stripe account, they need to create products and get new Price IDs
- **Domain Transfer:** If domain is transferred, update DNS records to point to buyer's Vercel deployment
- **Customer Data:** If using new Supabase instance, buyer needs to migrate customer data or start fresh

---

**Last Updated:** December 2024
