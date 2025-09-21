import { db } from "~/server/db";
import { users, threads, messages, labels, threadLabels, attachments as attachmentsTable } from "~/server/db/schema";
import { eq, and, desc, asc, inArray, count, sql } from "drizzle-orm";
import { S3Service } from "~/lib/s3-service";
import { GmailApiService } from "~/lib/gmail-api";
import { cacheService } from "~/lib/cache";
import { GmailSyncService } from "~/lib/gmail-sync";

export class GmailService {
  private s3Service: S3Service;

  constructor() {
    this.s3Service = new S3Service();
  }

  async getUserTokens(userId: number) {
    const user = await db.select({
      oauthAccessToken: users.oauthAccessToken,
      oauthRefreshToken: users.oauthRefreshToken,
    })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length || !user[0]!.oauthAccessToken || !user[0]!.oauthRefreshToken) {
      throw new Error("User OAuth tokens not found");
    }

    return user[0]!;
  }

  async createGmailApiService(userId: number): Promise<GmailApiService> {
    const { oauthAccessToken, oauthRefreshToken } = await this.getUserTokens(userId);
    return new GmailApiService(oauthAccessToken!, oauthRefreshToken!);
  }

  async sendEmail(userId: number, params: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    isHtml?: boolean;
  }) {
    const gmailApi = await this.createGmailApiService(userId);

    const result = await gmailApi.sendEmail({
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      body: params.body,
      isHtml: params.isHtml ?? true,
    });

    return {
      success: true,
      messageId: result.id,
      threadId: result.threadId,
    };
  }

  async replyToMessage(userId: number, params: {
    messageId: number;
    body: string;
    replyAll?: boolean;
  }) {
    // Verify the message belongs to the user
    const message = await db.select({
      gmailMessageId: messages.gmailMessageId,
      threadId: messages.threadId,
      gmailThreadId: threads.gmailThreadId,
    })
      .from(messages)
      .innerJoin(threads, eq(messages.threadId, threads.id))
      .where(and(
        eq(messages.id, params.messageId),
        eq(threads.userId, userId)
      ))
      .limit(1);

    if (!message.length) {
      throw new Error("Message not found or access denied");
    }

    const gmailApi = await this.createGmailApiService(userId);

    const result = await gmailApi.replyToMessage(
      message[0]!.gmailMessageId,
      params.body,
      params.replyAll ?? false
    );

    return {
      success: true,
      messageId: result.id,
      threadId: message[0]!.gmailThreadId,
    };
  }

  async forwardMessage(userId: number, params: {
    messageId: number;
    to: string[];
    body?: string;
  }) {
    // Verify the message belongs to the user
    const message = await db.select({
      gmailMessageId: messages.gmailMessageId,
      threadId: messages.threadId,
    })
      .from(messages)
      .innerJoin(threads, eq(messages.threadId, threads.id))
      .where(and(
        eq(messages.id, params.messageId),
        eq(threads.userId, userId)
      ))
      .limit(1);

    if (!message.length) {
      throw new Error("Message not found or access denied");
    }

    const gmailApi = await this.createGmailApiService(userId);

    const result = await gmailApi.forwardMessage(
      message[0]!.gmailMessageId,
      params.to,
      [], // cc (empty array)
      params.body || ''
    );

    return {
      success: true,
      messageId: result.id,
      threadId: result.threadId,
    };
  }

  async getMessageBody(userId: number, messageId: number) {
    const cacheKey = cacheService.messageBodyKey(userId, messageId);

    // Try cache first
    const cached = await cacheService.get<{ htmlBody: string | null; snippet: string }>(cacheKey);
    if (cached) {
      return cached;
    }

    // Verify the message belongs to the user and get S3 key
    const message = await db.select({
      bodyS3Key: messages.bodyS3Key,
      snippet: messages.snippet,
    })
      .from(messages)
      .innerJoin(threads, eq(messages.threadId, threads.id))
      .where(and(
        eq(messages.id, messageId),
        eq(threads.userId, userId)
      ))
      .limit(1);

    if (!message.length) {
      throw new Error("Message not found or access denied");
    }

    if (!message[0]!.bodyS3Key) {
      const result = {
        htmlBody: null,
        snippet: message[0]!.snippet,
      };
      // Cache the result for 24 hours
      await cacheService.set(cacheKey, result, 86400);
      return result;
    }

    try {
      const htmlBody = await this.s3Service.getObject(message[0]!.bodyS3Key);
      const result = {
        htmlBody,
        snippet: message[0]!.snippet,
      };
      // Cache the result for 24 hours
      await cacheService.set(cacheKey, result, 86400);
      return result;
    } catch (error) {
      console.error("Error fetching message body from S3:", error);
      const result = {
        htmlBody: null,
        snippet: message[0]!.snippet,
      };
      // Cache the fallback for shorter time (1 hour)
      await cacheService.set(cacheKey, result, 3600);
      return result;
    }
  }

  async getAttachmentDownloadUrl(userId: number, attachmentId: number) {
    // Verify the attachment belongs to the user
    const attachment = await db.select({
      s3Key: attachmentsTable.s3Key,
      filename: attachmentsTable.filename,
      mimeType: attachmentsTable.mimeType,
    })
      .from(attachmentsTable)
      .innerJoin(messages, eq(attachmentsTable.messageId, messages.id))
      .innerJoin(threads, eq(messages.threadId, threads.id))
      .where(and(
        eq(attachmentsTable.id, attachmentId),
        eq(threads.userId, userId)
      ))
      .limit(1);

    if (!attachment.length) {
      throw new Error("Attachment not found or access denied");
    }

    // Generate presigned URL for download
    const downloadUrl = await this.s3Service.getDownloadUrl(attachment[0]!.s3Key, 3600); // 1 hour expiry

    return {
      downloadUrl,
      filename: attachment[0]!.filename,
      mimeType: attachment[0]!.mimeType,
    };
  }

  async getLabels(userId: number) {
    return await db.select({
      id: labels.id,
      labelId: labels.labelId,
      name: labels.name,
      type: labels.type,
    })
      .from(labels)
      .where(eq(labels.userId, userId))
      .orderBy(asc(labels.name));
  }

  async getThreadCounts(userId: number) {
    const subquery = db.select({
      labelId: threadLabels.labelId,
      threadCount: count().as('thread_count'),
    })
      .from(threadLabels)
      .innerJoin(threads, eq(threadLabels.threadId, threads.id))
      .where(and(
        eq(threads.userId, userId),
        eq(threads.isUnread, true)
      ))
      .groupBy(threadLabels.labelId)
      .as('thread_counts');

    return await db.select({
      labelId: labels.labelId,
      count: sql<number>`COALESCE(${subquery.threadCount}, 0)`,
    })
      .from(labels)
      .leftJoin(subquery, eq(labels.id, subquery.labelId))
      .where(eq(labels.userId, userId));
  }

  async syncSingleThread(userId: number, gmailThreadId: string) {
    try {
      console.log(`Initiating sync for thread ${gmailThreadId}`);

      // Get user tokens for sync service
      const { oauthAccessToken, oauthRefreshToken } = await this.getUserTokens(userId);
      const syncService = new GmailSyncService(oauthAccessToken!, oauthRefreshToken!);

      // Wait a bit to allow Gmail to process the sent message
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Use the public syncSingleThread method
      const syncResult = await syncService.syncSingleThread(userId, gmailThreadId);
      console.log(`Thread sync completed:`, syncResult);

      return syncResult;
    } catch (error) {
      console.error(`Failed to sync thread ${gmailThreadId}:`, error);
      // Don't throw error to avoid breaking the reply process
      return {
        success: false,
        threadsSynced: 0,
        messagesSynced: 0,
        attachmentsSynced: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}