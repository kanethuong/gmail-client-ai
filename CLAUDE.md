# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
npm run dev          # Start development server with Turbo
npm run build        # Build for production with Turbo
npm run start        # Start production server
npm run lint         # Run ESLint

# Database Operations
npm run db:push      # Push schema changes to database
npm run db:pull      # Pull schema from database
npm run db:studio    # Open Drizzle Studio for database management
```

## Architecture Overview

This is a Gmail Client AI application built on the T3 Stack (Next.js, tRPC, Drizzle, NextAuth) that syncs Gmail data into PostgreSQL quickly (aims for ~400-500 threads/min) and stores email content/attachments in AWS S3 for rendering. The app should keep mailboxes in sync on a schedule (using either cron or webhook).
The UI should show inbox/label list with the thread list with infinite scroll (handle >=10k threads smoothly), and the thread view showing full conversations with HTML email body rendered from S3.
There is a search bar at the top supporting database-level search accross subject/from/snippet at minimum. Also allow user to compose, reply and forward in-thread (replied and forwarded messages should be properly threaded). And allow user to download/upload attachments (display inline where possible).
Having a "Draft with AI" button in the reply box. When clicked, use a free-tier LLM API to generate a suggested reply based on the thread context. Show the draft in the editor for the user to review/edit before sending.


### Core Architecture Layers

**Authentication Layer**
- NextAuth.js with Google OAuth for Gmail API access
- OAuth tokens stored in database with automatic refresh
- Gmail API scopes for full email access

**Data Flow Architecture**
1. **Gmail API Service** (`src/lib/gmail-api.ts`): Fetches threads, messages, attachments from Gmail
2. **S3 Service** (`src/lib/s3-service.ts`): Handles storage of email bodies and attachments
3. **Sync Service** (`src/lib/gmail-sync.ts`): Orchestrates sync process, stores metadata in PostgreSQL
4. **tRPC API** (`src/server/api/routers/sync.ts`, `src/server/api/routers/gmail.ts`): Exposes sync operations

### Database Schema (Drizzle ORM)

The schema in `src/server/db/schema.ts` implements a normalized email data model:

- `users`: User info + OAuth credentials
- `threads`: Gmail thread metadata
- `messages`: Individual message metadata (body stored in S3)
- `labels`: Gmail labels (system + user-defined)
- `thread_labels`: Many-to-many thread/label relationships
- `attachments`: Attachment metadata (files stored in S3)
- `drafts`: Local draft composition before sending
- `sync_logs`: Sync operation history and error tracking

**Key Design Decisions:**
- Gmail IDs stored as `text` (not integers) to handle Gmail's string-based IDs
- Email bodies and attachments stored in S3, metadata in PostgreSQL
- Comprehensive indexing for performance (email search, date ranges, labels)
- Cascading deletes to maintain referential integrity

### Environment Configuration

Environment variables are validated using `@t3-oss/env-nextjs` in `src/env.js`:
- Database: `DATABASE_URL`
- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- NextAuth: `NEXTAUTH_SECRET`
- AWS S3: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`

### tRPC API Structure

The API is organized into domain-specific routers:
- `sync`: Trigger syncs, get sync status/history, account info
- `gmail`: Gmail-specific operations (future: search, compose, etc.)

### Sync Process Flow

1. User authenticates with Google OAuth
2. Background sync triggered automatically for new users
3. Gmail API fetches threads → messages → attachments
4. Email bodies and attachments uploaded to S3
5. Metadata stored in PostgreSQL with S3 references
6. Sync operations logged for monitoring/debugging

### Component Architecture

**Frontend Components:**
- `SyncPanel.tsx`: UI for monitoring sync status and triggering manual syncs
- Built with Radix UI components and Tailwind CSS
- Uses tRPC React Query for server state management

### Development Notes

- Uses Drizzle ORM with PostgreSQL for type-safe database operations
- Turbo mode enabled for faster development builds
- Gmail API rate limiting handled with exponential backoff
- S3 presigned URLs for secure file access
- Comprehensive error handling and logging throughout sync pipeline

### Testing Database Operations

To test database operations:
```bash
npm run db:studio  # Opens Drizzle Studio for visual database management
```

For schema changes:
```bash
npm run db:push    # Push changes to database (development)
```

### Common Development Patterns

- All Gmail API operations go through `src/lib/gmail-api.ts`
- S3 operations centralized in `src/lib/s3-service.ts`
- Database queries use Drizzle ORM with proper type safety
- tRPC procedures follow input validation with Zod schemas
- Error handling includes user-friendly messages and detailed logging