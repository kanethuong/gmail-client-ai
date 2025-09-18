import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { db } from '~/server/db';
import { users } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '~/env';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  secret: env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/',
    error: '/',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user?.email) {
        try {
          // Check if user already exists
          const existingUser = await db.select()
            .from(users)
            .where(eq(users.email, user.email))
            .limit(1);

          if (existingUser.length > 0) {
            // Update existing user's OAuth tokens
            await db.update(users)
              .set({
                oauthAccessToken: account.access_token,
                oauthRefreshToken: account.refresh_token,
                oauthTokenExpiry: account.expires_at ? new Date(account.expires_at * 1000) : null,
                updatedAt: new Date(),
              })
              .where(eq(users.email, user.email));
          } else {
            // Create new user
            await db.insert(users).values({
              email: user.email,
              name: user.name || '',
              oauthAccessToken: account.access_token,
              oauthRefreshToken: account.refresh_token,
              oauthTokenExpiry: account.expires_at ? new Date(account.expires_at * 1000) : null,
            });
          }
        } catch (error) {
          console.error('Error handling user sign in:', error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, account, user }) {
      // On initial sign in, get user info from database
      if (account && user?.email) {
        const dbUser = await db.select()
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1);

        if (dbUser.length > 0) {
          token.userId = dbUser[0]!.id;
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;
          token.expiresAt = account.expires_at;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        // Add user ID to session
        (session.user as any).id = token.userId as number;
        (session as any).accessToken = token.accessToken as string;
        (session as any).refreshToken = token.refreshToken as string;
        (session as any).expiresAt = token.expiresAt as number;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      if (account?.provider === 'google' && isNewUser && user?.email) {
        // Trigger initial sync for new users
        try {
          // Import here to avoid circular dependencies
          const { GmailSyncService } = await import('~/lib/gmail-sync');

          if (account.access_token && account.refresh_token) {
            const syncService = new GmailSyncService(
              account.access_token,
              account.refresh_token
            );

            // Get user ID from database
            const dbUser = await db.select()
              .from(users)
              .where(eq(users.email, user.email))
              .limit(1);

            if (dbUser.length > 0) {
              // Start sync in background (don't await to avoid blocking login)
              syncService.syncUser(dbUser[0]!.id).catch(error => {
                console.error('Background sync failed:', error);
              });
            }
          }
        } catch (error) {
          console.error('Error triggering initial sync:', error);
        }
      }
    },
  },
});