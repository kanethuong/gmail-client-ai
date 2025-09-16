import { auth } from "~/auth";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { GmailApiService } from "~/lib/gmail-api";

// Server-side authentication helpers
export const getServerAuthSession = async () => {
  return await auth();
};

// Check if user is authenticated on server
export const requireAuth = async () => {
  const session = await getServerAuthSession();

  if (!session || !session.user) {
    throw new Error("Authentication required");
  }

  return session;
};

// Get authenticated user's OAuth tokens
export const getUserTokens = async (userId: number) => {
  const user = await db.select({
    oauthAccessToken: users.oauthAccessToken,
    oauthRefreshToken: users.oauthRefreshToken,
    oauthTokenExpiry: users.oauthTokenExpiry,
  })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user.length) {
    throw new Error("User not found");
  }

  const userData = user[0]!;
  if (!userData.oauthAccessToken || !userData.oauthRefreshToken) {
    throw new Error("OAuth tokens not found. Please re-authenticate.");
  }

  return {
    accessToken: userData.oauthAccessToken,
    refreshToken: userData.oauthRefreshToken,
    expiresAt: userData.oauthTokenExpiry,
  };
};

// Check if OAuth tokens are expired and need refresh
export const areTokensExpired = (expiresAt: Date | null): boolean => {
  if (!expiresAt) return false;

  // Consider tokens expired if they expire within the next 5 minutes
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  return expiresAt < fiveMinutesFromNow;
};

// Refresh OAuth tokens if needed
export const refreshTokensIfNeeded = async (userId: number) => {
  const tokens = await getUserTokens(userId);

  if (tokens.expiresAt && areTokensExpired(tokens.expiresAt)) {
    try {
      const gmailService = new GmailApiService(tokens.accessToken, tokens.refreshToken);
      const newAccessToken = await gmailService.refreshAccessToken();

      // Update tokens in database
      await db.update(users)
        .set({
          oauthAccessToken: newAccessToken,
          // Assume new token expires in 1 hour (typical for Google)
          oauthTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return {
        accessToken: newAccessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      console.error("Failed to refresh OAuth tokens:", error);
      throw new Error("Failed to refresh authentication. Please sign in again.");
    }
  }

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
};