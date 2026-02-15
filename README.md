# Gmail Client AI

<div align="center">

![Gmail Client AI](https://img.shields.io/badge/Gmail-Client-blue?style=for-the-badge&logo=gmail)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![AWS S3](https://img.shields.io/badge/AWS_S3-FF9900?style=for-the-badge&logo=amazon-aws&logoColor=white)

**A high-performance, AI-powered Gmail client built with the T3 Stack**

</div>

---

## 🎯 Project Overview

Gmail Client AI is a full-stack web application that replicates Gmail's core functionality while adding AI-powered draft generation. Built to handle **10,000+ emails** with seamless performance, this project demonstrates expertise in **full-stack development, cloud infrastructure, and system design**.

### Key Achievements

- **High-Performance Sync**: Syncs 400-500 Gmail threads per minute
- **Smooth UX**: Handles 10,000+ threads with infinite scroll
- **AI Integration**: Context-aware email draft generation using Google's Gemini API
- **Cloud-Native**: Leverages AWS S3 for scalable email storage
- **Secure**: OAuth 2.0 authentication with proper token management

---

## ✨ Features

### Core Email Functionality
- **Full Gmail Integration** via Google OAuth 2.0
- **Blazing-Fast Sync** - Background synchronization with automatic scheduling
- **Smart Threading** - Proper conversation threading for replies and forwards
- **Rich Email Rendering** - HTML emails rendered from S3 with inline images
- **Attachment Management** - Upload, download, and inline display support

### Advanced Features
- **Real-Time Search** - Database-level search across subject, sender, and content
- **Infinite Scroll** - Smooth pagination for large mailboxes (10k+ threads)
- **Label Management** - Full support for Gmail labels and filters
- **Compose & Reply** - Full-featured email composition with proper threading

### AI-Powered Drafts
- **Smart Draft Generation** - Context-aware suggestions using Gemini API
- **Interactive Editing** - Review and customize AI-generated drafts
- **Conversation Context** - Analyzes entire thread for relevant responses

---

## 🛠️ Tech Stack

| Frontend | Backend | Database & Storage | External APIs |
|----------|---------|-------------------|---------------|
| **Next.js 15** | **Next.js API Routes** | **PostgreSQL** (Neon) | **Gmail API** |
| **TypeScript** | **tRPC** | **AWS S3** | **Google Gemini** |
| **Tailwind CSS** | **NextAuth.js** | **Redis** | **AWS SDK** |
| **shadcn/ui** | **Drizzle ORM** | | |
| **tRPC** | | | |

---

## 🏗️ Architecture

### System Design
```
┌─────────────┐      OAuth      ┌──────────────┐
│   Client    │ ◄─────────────► │  Google      │
│  (Browser)  │                 │  OAuth       │
└──────┬──────┘                 └──────────────┘
       │
       │ tRPC
       │
┌──────▼──────────────────────────────────────┐
│         Next.js Application                 │
│  ┌────────────┐  ┌─────────────┐            │
│  │   tRPC     │  │  NextAuth   │            │
│  │   API      │  │  Session    │            │
│  └─────┬──────┘  └──────┬──────┘            │
│        │                 │                  │
│  ┌─────▼─────────────────▼──────┐           │
│  │   Business Logic Layer       │           │
│  │  • GmailSyncService          │           │
│  │  • MessageService            │           │
│  │  • ThreadService             │           │
│  └─────┬────────────────────────┘           │
└────────┼────────────────────────────────────┘
         │
    ┌────┴────┬─────────────┬──────────────┐
    │         │             │              │
┌───▼───┐ ┌──▼──┐     ┌────▼─────┐   ┌───▼────┐
│ Gmail │ │ S3  │     │PostgreSQL│   │ Gemini │
│  API  │ │     │     │          │   │  API   │
└───────┘ └─────┘     └──────────┘   └────────┘
```

### Data Flow

1. **Authentication**: User authenticates via Google OAuth 2.0
2. **Sync Process**:
   - Fetch Gmail threads (400-500/min)
   - Extract metadata → PostgreSQL
   - Upload HTML bodies → S3
   - Upload attachments → S3
3. **Display**: 
   - Query metadata from PostgreSQL
   - Fetch HTML from S3 (presigned URLs)
   - Render in client with infinite scroll
4. **AI Draft**:
   - Extract thread context from DB
   - Send to Gemini API
   - Display generated draft for editing

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Neon account)
- AWS account (S3 bucket)
- Google Cloud Console project (OAuth credentials)
- Gemini API key

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/kanethuong/gmail-client-ai.git
cd gmail-client-ai
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Configure the following in `.env`:
```env
# Database
DATABASE_URL="postgresql://..."
DATABASE_URL_UNPOOLED="postgresql://..."

# Google OAuth
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"

# NextAuth
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"

# AWS S3
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"
S3_BUCKET_NAME="your-bucket-name"

# Gemini AI
GEMINI_API_KEY="your-gemini-key"

# Optional: Redis for caching
REDIS_URL="redis://..."
```

4. **Set up Google OAuth**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project
   - Enable Gmail API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Add scopes: `gmail.readonly`, `gmail.send`

5. **Set up AWS S3**
   - Create an S3 bucket
   - Configure CORS for your domain
   - Create IAM user with S3 access
   - Generate access keys

6. **Push database schema**
```bash
npm run db:push
```

7. **Run the development server**
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## 🧪 Testing

Comprehensive test suite with 98 tests covering:
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test gmail-api.test.ts
```

**Test Coverage**:
- Unit tests for core services
- Integration tests for API routes
- System tests for database schema
- Workflow validation tests

---

## 🚢 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy!

**Note**: Set up Vercel Cron for scheduled sync:
```json
// vercel.json
{
  "crons": [{
    "path": "/api/sync/scheduled",
    "schedule": "0 */6 * * *"
  }]
}
```

### Docker (Alternative)
```bash
docker build -t gmail-client-ai .
docker run -p 3000:3000 gmail-client-ai
```

---

## 🔐 Security Considerations

- ✅ OAuth tokens encrypted in database
- ✅ S3 presigned URLs with expiration (1 hour)
- ✅ Environment variables never committed
- ✅ Input validation with Zod
- ✅ SQL injection prevention via ORM
- ✅ User data isolation by user ID
- ✅ HTTPS enforced in production

---

## 🎯 Future Enhancements
- Real-time sync via Gmail webhooks (push notifications)
- Advanced search with filters (date range, attachment type)
- Email templates and signatures
- Dark mode support
- Mobile responsive improvements
- Multi-account support
- Email scheduling
- Advanced AI features (summarization, categorization)

<div align="center">

</div>
