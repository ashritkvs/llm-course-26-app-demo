# Answerify - AI-Powered Customer Support Platform

Answerify is a modern customer support platform that uses AI to automatically answer customer questions, saving your team time while maintaining quality responses.

## Features

### 🤖 AI-Powered Auto-Replies

Answerify uses Google Gemini AI to generate intelligent, contextually relevant responses based on your knowledge base. The system:

- Analyzes incoming customer emails using semantic search
- Generates accurate responses with source citations
- Learns from human feedback to improve over time

### 📊 Intelligent Knowledge Base Management

- **Vector Embeddings**: Content is chunked and embedded for semantic search
- **Multiple Data Sources**: Support URLs, documentation, FAQs, and more
- **Internal Knowledge Base**: Auto-learns from approved responses
- **Real-time Indexing**: New content is automatically indexed when added

### ✉️ Email Thread Management

- **Unified Inbox**: View all customer conversations in one place
- **Real-time Updates**: New emails appear instantly via Supabase Realtime
- **Status Tracking**: Open/closed ticket management
- **Rich Text Editor**: Compose replies with Tiptap-powered formatting

### 🎯 Intent Detection & Tagging

The system automatically classifies incoming emails into categories:

| Category | Icon | Description |
|----------|------|-------------|
| Billing | 💳 | Payment and invoice questions |
| Bug Report | 🐛 | Software issues and errors |
| Feature Request | ✨ | Enhancement suggestions |
| General Support | 💬 | Standard support queries |
| Account Access | 🔐 | Login and access issues |
| Account Settings | ⚙️ | Configuration questions |
| Account Deletion | 🗑️ | Data removal requests |
| Refund Request | 💰 | Money return inquiries |
| Payment Failed | ❌ | Transaction failures |
| Subscription Change | 🔄 | Plan modifications |
| Invoice Request | 📄 | Billing document requests |
| Performance Issue | ⚡ | Speed and responsiveness |
| Integration Issue | 🔌 | Third-party connectivity |
| Data Export | 📤 | Information retrieval |
| Upgrade Inquiry | 🚀 | Product upgrades |
| Demo Request | 🎯 | Product demonstrations |
| Onboarding Help | 🎓 | Getting started assistance |
| How-To Question | ❓ | Usage instructions |
| Security Concern | 🛡️ | Safety and privacy |
| Abuse Report | 🚫 | Policy violations |
| Privacy Request | 🔒 | GDPR and data requests |
| Complaint | 😤 | Dissatisfaction |
| Compliment | 🌟 | Positive feedback |
| Spam / Irrelevant | 🚮 | Noise filtering |

### 🔄 Workflow Automation

Create automated rules to handle common scenarios:

**Trigger Types:**
- `subject_contains` - Match emails by keyword in subject
- `sender_domain` - Match emails from specific domains
- `has_tag` - Match emails with specific intent tags
- `any_email` - Trigger on all incoming emails

**Automation Steps:**
- **Add Tag**: Automatically categorize emails
- **Auto Reply**: Send predefined responses
- **Escalate**: Flag high-priority items
- **Call Webhook**: Integrate with external systems

### 🛡️ Autopilot Mode

Smart automation with human oversight:

- **High Confidence (≥65%)**: Auto-sends AI-generated replies
- **Low Confidence**: Creates drafts for human review
- **Configurable Threshold**: Adjust sensitivity per organization
- **Safety Guards**: Never sends empty or unclear responses

### 📝 Learning Loop

Continuous improvement from human feedback:

1. Agent edits an AI draft
2. System tracks the human response
3. If approved, the response is chunked and embedded
4. Future similar queries use this learned content
5. Reply quality improves over time

### 👥 Team Collaboration

- **Role-Based Access**: Member, Admin, and Owner roles
- **Invite System**: Add team members by email
- **Organization Management**: Multiple workspaces supported

---

## Architecture

### Database Schema

```
┌─────────────────┐     ┌─────────────────┐
│  organization   │────<│    member       │
└─────────────────┘     └─────────────────┘
        │
        ├────<│    thread        │
        │     └─────────────────┘
        │            │
        │            │
        ├────<│    email         │
        │     └─────────────────┘
        │
        ├────<│    reply         │
        │     └─────────────────┘
        │
        ├────<│  datasource      │
        │            │
        │            │
        │            └────<│    section      │
        │                       └─────────────────┘
        │
        ├────<│   workflow      │
        │     └─────────────────┘
        │
        └────<│   mcp_server    │
              └─────────────────┘
```

### Key Tables

| Table | Description |
|-------|-------------|
| `organization` | Tenant workspace with settings |
| `member` | User membership with roles |
| `thread` | Email conversation thread |
| `email` | Individual messages |
| `reply` | AI-generated or human drafts |
| `datasource` | Content sources (URLs) |
| `section` | Chunked content with embeddings |
| `workflow` | Automation rules |
| `mcp_server` | MCP tool integrations |

### API Flow

```
Inbound Email
      │
      ▼
┌─────────────────┐
│ Webhook Handler │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Intent Detection│ ───► Tags added to thread
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Vector Search   │────>│ Match Sections  │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Generate Reply  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Workflow Runner │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌────────┐
│ Auto │ │ Draft  │
│ Send │ │ Review │
└───────┘ └────────┘
```

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `NEXT_PUBLIC_BASE_URL` | Application base URL |
| `RESEND_API_KEY` | Resend email API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini API key |

### Optional - Cloudflare AI Gateway

| Variable | Description |
|----------|-------------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_GATEWAY_NAME` | AI Gateway identifier |
| `CF_AIG_TOKEN` | AI Gateway auth token |

---

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Start development server
pnpm dev
```

### Database Migrations

Apply migrations via Supabase CLI or dashboard:

```bash
supabase db push
```

### Key Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm lint` | Run ESLint |
| `pnpm tsc` | TypeScript type check |

---

## Configuration

### Autopilot Settings

```sql
-- Disable autopilot
UPDATE organization
SET autopilot_enabled = false
WHERE id = '<org-id>';

-- Adjust confidence threshold
UPDATE organization
SET autopilot_threshold = 0.75
WHERE id = '<org-id>';
```

### Tone Policy

Customize AI response tone:

```sql
UPDATE organization
SET tone_policy = 'friendly'
WHERE id = '<org-id>';
```

---

## Security

- **Row-Level Security (RLS)**: All tables enforce organization-based access
- **Service Role**: Webhooks use service key for elevated access
- **Email Sanitization**: All HTML content is XSS-sanitized
- **API Authentication**: Demo endpoints require Bearer tokens

---

## Support

For issues and feature requests, please open a GitHub issue.
