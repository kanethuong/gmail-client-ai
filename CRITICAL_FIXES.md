# CRITICAL FIXES REQUIRED - Gmail Client AI

## Authentication & Database Issues Found

### **Issue 1: Mock Authentication (HIGH PRIORITY)**
**Problem**: `protectedProcedure` uses hardcoded user ID 1, but database has no users.
**Location**: `src/server/api/trpc.ts:124`
**Current Code**:
```typescript
session: { user: { id: 1 } }, // Mock user for now
```

**Fix Required**:
1. Implement proper NextAuth integration
2. Connect to real user sessions
3. Create user records in database during OAuth flow

### **Issue 2: Missing User Records (HIGH PRIORITY)**
**Problem**: Database has no user records with OAuth tokens.
**Impact**: All sync operations fail with "User not found"

**Fix Required**:
1. Create initial user in database
2. Implement proper OAuth token storage
3. Add user creation flow during first login

### **Issue 3: Incomplete OAuth Integration (MEDIUM PRIORITY)**
**Problem**: Google OAuth configured but not storing user data.
**Files Affected**:
- `src/lib/auth.js` (basic functions only)
- Missing NextAuth configuration
- No OAuth callback handling

## **Immediate Action Items**

### **Quick Fix (5 minutes) - Test Environment**
Create a test user in database to unblock testing:

```sql
INSERT INTO users (id, email, name, oauth_access_token, oauth_refresh_token, created_at, updated_at)
VALUES (1, 'test@example.com', 'Test User', 'mock-access-token', 'mock-refresh-token', NOW(), NOW());
```

### **Proper Fix (30-60 minutes) - Production Ready**

#### 1. Implement NextAuth Configuration
Create `src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly'
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
      }
      return token
    },
    async session({ session, token }) {
      // Store user in database and return user ID
      session.accessToken = token.accessToken
      session.refreshToken = token.refreshToken
      return session
    }
  }
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

#### 2. Update tRPC Context
Fix `src/server/api/trpc.ts`:
```typescript
import { getServerSession } from 'next-auth/next'
import { authOptions } from '~/app/api/auth/[...nextauth]/route'

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await getServerSession(authOptions)

  return {
    db,
    session,
    ...opts,
  }
}

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session || !ctx.session.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }
    return next({
      ctx: {
        ...ctx,
        session: { ...ctx.session, user: ctx.session.user },
      },
    })
  })
```

#### 3. Implement User Creation Flow
Add user creation in OAuth callback:
```typescript
async session({ session, token }) {
  if (session.user?.email) {
    // Upsert user in database
    const existingUser = await db.select().from(users).where(eq(users.email, session.user.email)).limit(1)

    let user
    if (!existingUser.length) {
      [user] = await db.insert(users).values({
        email: session.user.email,
        name: session.user.name,
        oauthAccessToken: token.accessToken,
        oauthRefreshToken: token.refreshToken,
      }).returning()
    } else {
      user = existingUser[0]
      // Update tokens
      await db.update(users)
        .set({
          oauthAccessToken: token.accessToken,
          oauthRefreshToken: token.refreshToken,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
    }

    session.user.id = user.id
  }
  return session
}
```

## **Testing Status Impact**

**Current Test Results**: 12 failed tests due to authentication issues
**Expected After Fix**: Most tests should pass (90%+ success rate)

**Tests That Will Pass After Fix**:
- All tRPC API integration tests
- Gmail sync service tests
- Database user operation tests

## **Priority Order**

1. **URGENT**: Create test user in database (unblocks immediate testing)
2. **HIGH**: Implement proper NextAuth integration
3. **MEDIUM**: Add user creation flow and token management
4. **LOW**: Update tests to handle real authentication

## **Risk Assessment**

**Current Risk**: **HIGH**
- Core functionality completely broken
- No users can actually use the system
- Authentication system non-functional

**After Fix**: **LOW**
- Standard OAuth flow operational
- User management functional
- Ready for production deployment

---

**Estimated Fix Time**: 1-2 hours for complete implementation
**Testing Time**: 30 minutes to validate all flows work

This is a **blocking issue** that must be resolved before the system can be considered functional.