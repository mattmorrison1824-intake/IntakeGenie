# IntakeGenie - Business Handover Document

**Version:** 1.0  
**Date:** December 2024  
**Purpose:** Complete handover documentation for business acquisition on Acquire.com

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Business Model & Revenue](#business-model--revenue)
3. [Technology Stack](#technology-stack)
4. [Architecture Overview](#architecture-overview)
5. [Environment Setup](#environment-setup)
6. [Database Schema](#database-schema)
7. [Third-Party Integrations](#third-party-integrations)
8. [Deployment & Infrastructure](#deployment--infrastructure)
9. [Customer Onboarding Process](#customer-onboarding-process)
10. [Key Features](#key-features)
11. [Codebase Structure](#codebase-structure)
12. [Maintenance & Support](#maintenance--support)
13. [Access Credentials Checklist](#access-credentials-checklist)
14. [Troubleshooting Guide](#troubleshooting-guide)
15. [Next Steps for Buyer](#next-steps-for-buyer)

---

## Executive Summary

**IntakeGenie** is a SaaS platform that provides AI-powered voice receptionist services for law firms. The platform automatically handles after-hours and no-answer calls, collects structured intake information from potential clients, and sends detailed summaries to law firms via email.

### Value Proposition

- **For Law Firms:** Never miss a potential client call, even after hours
- **For Callers:** Professional, empathetic AI agent that collects all necessary information
- **Market:** Legal tech niche with high-value clients ($49-$499/month subscriptions)

### Current Status

- ✅ Production-ready platform
- ✅ Active customers and recurring revenue
- ✅ Fully automated billing via Stripe
- ✅ Complete source code included
- ✅ Modern tech stack (Next.js, Supabase, Vapi AI)

---

## Business Model & Revenue

### Subscription Plans

| Plan | Price | Minutes/Month | Approx Calls | Target Market |
|------|-------|---------------|--------------|---------------|
| **Starter** | $49/mo | 60 minutes | ~30 calls | Solo practitioners, small firms |
| **Professional** | $149/mo | 200 minutes | ~100 calls | Mid-size law firms |
| **Turbo** | $499/mo | 1,000 minutes | ~500 calls | Large firms, high-volume practices |

### Revenue Features

- **Free Trial:** 14-day free trial for Starter plan (no credit card required)
- **Billing:** Automated via Stripe subscriptions
- **Usage Tracking:** Automatic enforcement of minute limits
- **Upgrades/Downgrades:** Seamless plan changes via Stripe Customer Portal

### Pricing Model Location

- Hardcoded in `lib/constants/plans.ts`
- Displayed on landing page (`app/page.tsx`)
- Enforced in database via usage tracking functions

---

## Technology Stack

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **UI Components:** Radix UI primitives
- **State Management:** React hooks + server components

### Backend
- **Runtime:** Node.js 18+
- **Database:** PostgreSQL (via Supabase)
- **Authentication:** Supabase Auth (email/password)
- **API Routes:** Next.js API routes

### Third-Party Services

| Service | Purpose | Location |
|---------|---------|----------|
| **Vapi** | AI voice agent (replaces Twilio) | `lib/clients/vapi.ts` |
| **Stripe** | Payment processing & subscriptions | `lib/clients/stripe.ts` |
| **Supabase** | Database, Auth, RLS | `lib/clients/supabase.ts` |
| **OpenAI** | Call summarization | `lib/clients/openai.ts` |
| **Resend** | Email delivery | `lib/clients/resend.ts` |
| **Deepgram** | Transcription (legacy/optional) | `lib/clients/deepgram.ts` |

---

## Architecture Overview

### Call Flow

```
Incoming Call → Vapi AI Agent → Webhook Handler → Database → Email Notification
```

1. **Call Initiated:** Customer calls firm's phone number (provisioned via Vapi)
2. **AI Agent Handles:** Vapi AI agent collects intake information
3. **Webhook Processing:** `/api/vapi/webhook` receives call events
4. **Data Storage:** Call data stored in Supabase `calls` table
5. **Email Sent:** Intake summary emailed to firm's notification addresses
6. **Dashboard View:** Firm views call details, transcript, recording

### Key Architecture Decisions

- **Vapi Integration:** Uses Vapi for AI voice agent (modern, low-latency solution)
- **Serverless:** Deployed on Vercel (serverless functions)
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **Authentication:** Supabase Auth with RLS policies
- **Webhooks:** Public API routes (no auth required for Vapi webhooks)

---

## Environment Setup

### Required Environment Variables

Create a `.env.local` file in the project root (see `env.local.template` for reference):

```env
# Application URL (Production)
NEXT_PUBLIC_APP_URL=https://www.intakegenie.xyz

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Vapi (AI Voice Agent)
VAPI_API_KEY=your_vapi_api_key

# Stripe (Payments)
STRIPE_SECRET_KEY=sk_live_your_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_key
STRIPE_PRICE_ID_STARTER=price_xxxxx
STRIPE_PRICE_ID_PROFESSIONAL=price_xxxxx
STRIPE_PRICE_ID_TURBO=price_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# OpenAI (Summaries)
OPENAI_API_KEY=sk-your_key

# Resend (Emails)
RESEND_API_KEY=re_your_key

# Deepgram (Optional - Transcription)
DEEPGRAM_API_KEY=your_key
```

### Installation Steps

```bash
# 1. Clone repository
git clone <repository-url>
cd IntakeGenie

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp env.local.template .env.local
# Edit .env.local with your credentials

# 4. Run database migrations (see Database Schema section)

# 5. Start development server
npm run dev

# 6. Build for production
npm run build
npm start
```

---

## Database Schema

### Core Tables

#### `firms` Table
- Stores law firm information
- Key fields: `owner_user_id`, `firm_name`, `notify_emails`, `subscription_plan`, `subscription_status`
- Linked to Stripe via `stripe_customer_id`, `stripe_subscription_id`
- Vapi integration: `vapi_assistant_id`, `vapi_phone_number_id`

#### `calls` Table
- Stores all call records
- Key fields: `vapi_conversation_id`, `firm_id`, `from_number`, `transcript_text`, `recording_url`, `intake_json`, `summary_json`
- Status values: `in_progress`, `transcribing`, `summarizing`, `sending_email`, `emailed`, `error`
- Usage tracking: `call_duration_minutes`, `started_at`, `ended_at`

### Database Migrations

All SQL migrations are in the `sql/` directory. Run these in order:

1. **Initial Schema:** `sql/migrations.sql` (core tables)
2. **Vapi Support:** `sql/fix_calls_schema_for_vapi.sql`
3. **Stripe Integration:** `sql/add_stripe_subscriptions.sql`
4. **Usage Tracking:** `sql/add_usage_tracking.sql`
5. **Status Update:** `sql/add_sending_email_status.sql` (prevents duplicate emails)
6. **Additional:** Check `sql/` directory for other migrations

### Important SQL Functions

- `get_current_period_usage_minutes(p_firm_id)` - Calculates usage for billing period
- `get_billing_period_start_end(p_firm_id)` - Gets billing period dates
- `calculate_call_duration_minutes()` - Calculates call duration
- Trigger: `update_call_duration()` - Auto-calculates duration on call end

### Row Level Security (RLS)

- **Firms:** Users can only access their own firm
- **Calls:** Users can only access calls for their firms
- All policies defined in `sql/migrations.sql`

---

## Third-Party Integrations

### 1. Vapi (AI Voice Agent)

**Purpose:** Handles all voice interactions with callers

**Key Files:**
- `lib/clients/vapi.ts` - Vapi API client
- `app/api/vapi/webhook/route.ts` - Webhook handler for call events
- `lib/agent/prompts.ts` - AI agent system prompts

**Configuration:**
- Each firm has a Vapi assistant (`vapi_assistant_id`)
- Each firm has a phone number (`vapi_phone_number_id`)
- Webhook URL: `https://your-domain.com/api/vapi/webhook`

**Setup Required:**
1. Create Vapi account
2. Get API key
3. Ensure webhook URL is correctly configured for each assistant

### 2. Stripe (Payments)

**Purpose:** Subscription management, billing, invoicing

**Key Files:**
- `lib/clients/stripe.ts` - Stripe client
- `app/api/stripe/checkout/route.ts` - Checkout session creation
- `app/api/stripe/webhook/route.ts` - Webhook handler for subscription events
- `app/api/stripe/portal/route.ts` - Customer portal access

**Webhook Events Handled:**
- `checkout.session.completed` - New subscription created
- `customer.subscription.created` - Subscription activated
- `customer.subscription.updated` - Plan changes
- `customer.subscription.deleted` - Cancellation

**Stripe Setup:**
1. Create Stripe account (live mode for production)
2. Create products: Starter ($49), Professional ($149), Turbo ($499)
3. Get Price IDs for each product
4. Configure webhook endpoint: `https://your-domain.com/api/stripe/webhook`
5. Add webhook secret to environment variables

### 3. Supabase (Database & Auth)

**Purpose:** Database, authentication, Row Level Security

**Key Files:**
- `lib/clients/supabase.ts` - Supabase clients (browser & server)
- `middleware.ts` - Auth middleware for protected routes

**Setup Required:**
1. Create Supabase project
2. Run all SQL migrations (see Database Schema section)
3. Configure authentication providers (email/password)
4. Set up RLS policies (included in migrations)

### 4. Resend (Email Delivery)

**Purpose:** Sends intake summary emails to law firms

**Key Files:**
- `lib/clients/resend.ts` - Email sending logic
- `lib/intake/processor.ts` - Calls email sending after call completion

**Setup Required:**
1. Create Resend account
2. Verify sender domain (or use default for testing)
3. Get API key

### 5. OpenAI (Summarization)

**Purpose:** Generates summaries from call transcripts

**Key Files:**
- `lib/clients/openai.ts` - OpenAI client
- `lib/utils/summarize.ts` - Summary generation logic

**Setup Required:**
1. Create OpenAI account
2. Get API key
3. Ensure sufficient credits for usage

---

## Deployment & Infrastructure

### Current Deployment

- **Platform:** Vercel (recommended) or similar (Railway, Render)
- **Domain:** Configured via environment variable `NEXT_PUBLIC_APP_URL`
- **Database:** Supabase (managed PostgreSQL)
- **CDN:** Vercel Edge Network (automatic)

### Deployment Steps

1. **Connect Repository to Vercel:**
   - Import Git repository
   - Configure build settings (auto-detected for Next.js)

2. **Set Environment Variables:**
   - Add all environment variables in Vercel dashboard
   - Ensure `NEXT_PUBLIC_APP_URL` is set to production domain

3. **Configure Domain:**
   - Add custom domain in Vercel
   - Update DNS records as instructed

4. **Update Webhooks:**
   - Vapi: Update assistant webhook URLs to production domain
   - Stripe: Update webhook endpoint to production domain

### Build & Deployment Commands

```bash
# Local build test
npm run build
npm start

# Production deployment (automatic via Vercel)
# Push to main branch triggers deployment
git push origin main
```

---

## Customer Onboarding Process

### Step-by-Step Flow

1. **Sign Up**
   - Customer visits landing page
   - Clicks "Start Free Trial" (Starter plan) or "Get Started" (Pro/Turbo)
   - Creates account via email/password

2. **Subscription Setup**
   - Starter: Redirected to Stripe checkout with 14-day trial
   - Pro/Turbo: Redirected to Stripe checkout (payment required)
   - After payment: Webhook creates subscription in database

3. **Firm Configuration**
   - Customer sets up firm profile:
     - Firm name
     - Notification emails (where intake summaries are sent)
     - Business hours
     - Forward-to number (optional)

4. **Phone Number Provisioning**
   - System automatically provisions Vapi phone number
   - Vapi assistant is created/configured
   - Phone number is linked to firm's account

5. **Ready to Use**
   - Customer receives phone number
   - Customer can test by calling the number
   - Intake summaries are automatically emailed

### Onboarding Code Locations

- **Landing Page:** `app/page.tsx`
- **Login/Signup:** `app/(auth)/login/page.tsx`
- **Checkout:** `app/api/stripe/checkout/route.ts`
- **Settings:** `app/settings/page.tsx`, `components/SettingsForm.tsx`
- **Phone Provisioning:** `app/api/vapi/provision-number/route.ts`

---

## Key Features

### 1. AI Voice Agent

- **Location:** `lib/agent/prompts.ts`
- **Features:**
  - Collects structured intake (name, phone, email, incident details)
  - Detects emergencies and instructs callers to call 911
  - Natural conversation flow with state management
  - Optional email collection

### 2. Usage Tracking

- **Location:** `lib/utils/usage.ts`, `sql/add_usage_tracking.sql`
- **Features:**
  - Tracks minutes used per billing period
  - Enforces plan limits
  - Displays usage on dashboard
  - Blocks calls when limit exceeded

### 3. Free Trial Management

- **Location:** `app/api/stripe/checkout/route.ts`
- **Features:**
  - 14-day free trial for Starter plan
  - No credit card required
  - Automatic upgrade prompt when trial ends

### 4. Call Management

- **Location:** `app/calls/page.tsx`, `components/CallsList.tsx`
- **Features:**
  - View all calls with filters
  - View call details, transcript, recording
  - Search and filter by urgency, date, category

### 5. Billing Management

- **Location:** `app/billing/page.tsx`, `components/BillingClient.tsx`
- **Features:**
  - View current plan and usage
  - Upgrade/downgrade plans
  - Access Stripe Customer Portal
  - View invoices

---

## Codebase Structure

```
IntakeGenie/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth routes (login)
│   ├── api/                      # API routes
│   │   ├── stripe/              # Stripe webhooks & checkout
│   │   ├── vapi/                # Vapi webhooks & provisioning
│   │   └── telephony/           # Phone number management
│   ├── dashboard/               # Main dashboard
│   ├── calls/                   # Call logs & details
│   ├── billing/                 # Billing management
│   ├── settings/                # Firm settings
│   └── page.tsx                 # Landing page
├── components/                   # React components
│   ├── BillingClient.tsx        # Billing UI
│   ├── UsageDisplay.tsx         # Usage tracking UI
│   ├── PhoneNumberProvision.tsx # Phone number UI
│   └── CallsList.tsx            # Call listing
├── lib/
│   ├── clients/                 # Third-party API clients
│   │   ├── vapi.ts             # Vapi client
│   │   ├── stripe.ts           # Stripe client
│   │   ├── supabase.ts         # Supabase client
│   │   └── resend.ts           # Email client
│   ├── agent/
│   │   └── prompts.ts          # AI agent prompts
│   ├── intake/
│   │   └── processor.ts        # Call processing logic
│   ├── utils/
│   │   ├── usage.ts            # Usage tracking
│   │   └── summarize.ts        # Call summarization
│   └── constants/
│       └── plans.ts            # Pricing plans
├── sql/                         # Database migrations
│   ├── migrations.sql          # Initial schema
│   ├── add_stripe_subscriptions.sql
│   ├── add_usage_tracking.sql
│   └── ...
├── types/                       # TypeScript types
│   ├── index.ts                # Main types
│   └── database.ts             # Database types
└── middleware.ts               # Auth middleware
```

### Critical Files to Understand

1. **Call Processing:**
   - `lib/intake/processor.ts` - Core call finalization logic
   - `app/api/vapi/webhook/route.ts` - Webhook handler

2. **Billing:**
   - `app/api/stripe/webhook/route.ts` - Subscription updates
   - `lib/utils/usage.ts` - Usage tracking & limits

3. **Phone Provisioning:**
   - `app/api/vapi/provision-number/route.ts` - Phone number setup
   - `app/api/vapi/link-number/route.ts` - Link number to firm

4. **AI Agent:**
   - `lib/agent/prompts.ts` - Agent conversation logic

---

## Maintenance & Support

### Regular Maintenance Tasks

1. **Monitor API Usage:**
   - Vapi: Check dashboard for API usage and costs
   - OpenAI: Monitor token usage and costs
   - Stripe: Review failed payments and subscription issues

2. **Database Maintenance:**
   - Monitor Supabase usage and limits
   - Review call data growth (archive old calls if needed)
   - Check for any failed webhook processing

3. **Error Monitoring:**
   - Check Vercel logs for errors
   - Monitor email delivery (Resend dashboard)
   - Review customer support requests

### Common Issues & Solutions

#### Issue: Calls not appearing in dashboard
- **Check:** Vapi webhook URL is correct (`/api/vapi/webhook`)
- **Check:** Webhook is receiving requests (Vercel logs)
- **Check:** Firm ID is correctly associated with Vapi assistant

#### Issue: Duplicate emails
- **Status:** Fixed with `sending_email` status (see `sql/add_sending_email_status.sql`)
- **Ensure:** Migration has been run

#### Issue: Recording URLs missing
- **Check:** Vapi recording settings are enabled
- **Check:** Webhook is extracting recording URL correctly
- **Check:** Recording URL is stored in database

#### Issue: Subscription not updating
- **Check:** Stripe webhook is configured correctly
- **Check:** Webhook secret matches environment variable
- **Check:** Webhook is receiving events (Stripe dashboard)

### Support Resources

- **Code Documentation:** Inline comments in key files
- **SQL Migrations:** Well-documented in `sql/` directory
- **Error Logs:** Vercel dashboard → Functions → Logs
- **Database Queries:** Supabase SQL Editor

---

## Access Credentials Checklist

You will need access to the following accounts:

### Required Access

- [ ] **GitHub Repository** - Source code access
- [ ] **Vercel Account** - Deployment platform
- [ ] **Supabase Project** - Database & Auth
- [ ] **Vapi Account** - AI voice agent
- [ ] **Stripe Account** - Payment processing
- [ ] **Resend Account** - Email delivery
- [ ] **OpenAI Account** - Summarization
- [ ] **Domain Registrar** - Domain management
- [ ] **DNS Provider** - DNS records

### Account Details to Request

For each service, request:
- Login credentials (or transfer ownership)
- API keys and secrets
- Webhook configuration details
- Billing information

---

## Troubleshooting Guide

### Development Environment

```bash
# Check if all dependencies are installed
npm install

# Run development server
npm run dev

# Check for TypeScript errors
npx tsc --noEmit

# Run linting
npm run lint
```

### Production Issues

1. **Check Vercel Logs:**
   - Go to Vercel Dashboard → Project → Functions
   - View recent function logs

2. **Check Database:**
   - Supabase Dashboard → Table Editor
   - Verify data is being stored correctly

3. **Check Webhooks:**
   - Vapi Dashboard → Webhooks → View recent events
   - Stripe Dashboard → Webhooks → View event logs

4. **Test API Endpoints:**
   - Use `curl` or Postman to test webhook endpoints
   - Check response codes and error messages

---

## Next Steps for Buyer

### Immediate Actions (First Week)

1. **Access Transfer:**
   - [ ] Transfer all account ownerships
   - [ ] Update API keys in environment variables
   - [ ] Verify all webhooks are working

2. **Database Verification:**
   - [ ] Run all SQL migrations on your Supabase instance
   - [ ] Verify RLS policies are active
   - [ ] Test database queries

3. **Deployment Verification:**
   - [ ] Deploy to your Vercel account
   - [ ] Update domain DNS records
   - [ ] Test all critical flows (signup, checkout, call handling)

4. **Integration Testing:**
   - [ ] Test Vapi phone number provisioning
   - [ ] Test Stripe checkout and webhooks
   - [ ] Test email delivery
   - [ ] Test complete call flow end-to-end

### Ongoing Operations

1. **Customer Support:**
   - Set up support email/system
   - Document common questions
   - Create support workflows

2. **Monitoring:**
   - Set up error monitoring (Sentry, LogRocket, etc.)
   - Monitor API costs
   - Track subscription metrics

3. **Growth:**
   - Marketing & customer acquisition
   - Feature enhancements
   - Scaling infrastructure as needed

---

## Additional Resources

### Documentation Files

- `README.md` - General setup and development guide
- `STRIPE_INTEGRATION.md` - Stripe integration details
- `USAGE_TRACKING_SETUP.md` - Usage tracking documentation
- `env.local.template` - Environment variable template

### SQL Files

- All migration files in `sql/` directory
- Run in order (check file names for sequence)
- Use Supabase SQL Editor to run migrations

### Support Contact

For technical questions during handover, refer to:
- Inline code comments
- Git commit history for context
- This document

---

## Legal & Compliance Notes

- **Data Privacy:** Customer data stored in Supabase (GDPR-compliant if configured)
- **Payment Processing:** Stripe handles PCI compliance
- **Terms of Service:** Update with your business entity
- **Privacy Policy:** Update to reflect your ownership

---

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Prepared For:** Acquire.com Business Acquisition

---

*This document contains sensitive business and technical information. Keep confidential and secure.*

