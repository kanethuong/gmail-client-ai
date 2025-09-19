import { db } from '~/server/db';
import { users, labels, threads, messages, attachments, threadLabels, syncLogs } from '~/server/db/schema';
import { eq, and, inArray, lt } from 'drizzle-orm';
import { GmailApiService } from '~/lib/gmail-api';
import { S3Service } from '~/lib/s3-service';

export interface SyncResult {
  success: boolean;
  threadsSynced: number;
  messagesSynced: number;
  attachmentsSynced: number;
  error?: string;
}

export class GmailSyncService {
  private gmailApi: GmailApiService;
  private s3Service: S3Service;

  constructor(accessToken: string, refreshToken: string) {
    this.gmailApi = new GmailApiService(accessToken, refreshToken);
    this.s3Service = new S3Service();
  }

  /**
   * Perform full sync for a user
   */
  async syncUser(userId: number): Promise<SyncResult> {
    const syncLogId = await this.startSyncLog(userId, 'full');
    const syncStartTime = new Date();

    try {
      // Get user from database
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user.length) {
        throw new Error('User not found');
      }

      // Sync labels first
      await this.syncLabels(userId);

      // Get all threads from Gmail
      const gmailThreads = await this.gmailApi.getAllThreads(1000); // Start with 1000 threads

      let threadsSynced = 0;
      let messagesSynced = 0;
      let attachmentsSynced = 0;

      // Process each thread
      for (const gmailThread of gmailThreads) {
        try {
          const threadResult = await this.syncThread(userId, gmailThread, syncStartTime);
          threadsSynced += threadResult.threadsSynced;
          messagesSynced += threadResult.messagesSynced;
          attachmentsSynced += threadResult.attachmentsSynced;
        } catch (error) {
          console.error(`Error syncing thread ${gmailThread.id}:`, error);
          // Continue with other threads
        }
      }

      // Clean up deleted threads (threads not seen in this sync)
      const deletedThreadsCount = await this.cleanupDeletedThreads(userId, syncStartTime);
      console.log(`Cleaned up ${deletedThreadsCount} deleted threads`);

      // Update user's last sync time
      await db.update(users)
        .set({ lastSyncAt: new Date() })
        .where(eq(users.id, userId));

      await this.completeSyncLog(syncLogId, 'success', threadsSynced, messagesSynced);

      return {
        success: true,
        threadsSynced,
        messagesSynced,
        attachmentsSynced,
      };
    } catch (error) {
      console.error('Sync failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.completeSyncLog(syncLogId, 'failed', 0, 0, errorMessage);

      return {
        success: false,
        threadsSynced: 0,
        messagesSynced: 0,
        attachmentsSynced: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Sync labels for a user
   */
  private async syncLabels(userId: number): Promise<void> {
    try {
      const gmailLabels = await this.gmailApi.getLabels();
      
      for (const gmailLabel of gmailLabels) {
        // Check if label already exists
        const existingLabel = await db.select()
          .from(labels)
          .where(and(
            eq(labels.userId, userId),
            eq(labels.labelId, gmailLabel.id)
          ))
          .limit(1);

        if (!existingLabel.length) {
          // Insert new label
          await db.insert(labels).values({
            userId,
            labelId: gmailLabel.id,
            name: gmailLabel.name,
            type: gmailLabel.type || 'user',
          });
        }
      }
    } catch (error) {
      console.error('Error syncing labels:', error);
      throw error;
    }
  }

  /**
   * Sync a single thread
   */
  private async syncThread(userId: number, gmailThread: any, syncStartTime: Date): Promise<SyncResult> {
    let threadsSynced = 0;
    let messagesSynced = 0;
    let attachmentsSynced = 0;

    try {
      // Check if thread already exists
      const existingThread = await db.select()
        .from(threads)
        .where(and(
          eq(threads.userId, userId),
          eq(threads.gmailThreadId, gmailThread.id)
        ))
        .limit(1);

      let threadId: number;

      if (!existingThread.length) {
        // Create new thread
        const lastMessage = gmailThread.messages[gmailThread.messages.length - 1];
        const lastMessageDate = new Date(parseInt(lastMessage.internalDate));

        const [newThread] = await db.insert(threads).values({
          gmailThreadId: gmailThread.id,
          userId,
          historyId: gmailThread.historyId,
          lastMessageDate,
          isUnread: gmailThread.messages.some((msg: any) =>
            msg.labelIds?.includes('UNREAD')
          ),
          isStarred: gmailThread.messages.some((msg: any) =>
            msg.labelIds?.includes('STARRED')
          ),
          isImportant: gmailThread.messages.some((msg: any) =>
            msg.labelIds?.includes('IMPORTANT')
          ),
          isDraft: gmailThread.messages.some((msg: any) =>
            msg.labelIds?.includes('DRAFT')
          ),
          lastSeenAt: syncStartTime,
        }).returning();

        threadId = newThread!.id;
        threadsSynced = 1;

        // Sync thread labels
        await this.syncThreadLabels(threadId, gmailThread.messages);
      } else {
        threadId = existingThread[0]!.id;

        // Update lastSeenAt for existing thread
        await db.update(threads)
          .set({ lastSeenAt: syncStartTime })
          .where(eq(threads.id, threadId));
      }

      // Sync messages in this thread
      for (const gmailMessage of gmailThread.messages) {
        try {
          const messageResult = await this.syncMessage(userId, threadId, gmailMessage);
          messagesSynced += messageResult.messagesSynced;
          attachmentsSynced += messageResult.attachmentsSynced;
        } catch (error) {
          console.error(`Error syncing message ${gmailMessage.id}:`, error);
        }
      }

      return {
        success: true,
        threadsSynced,
        messagesSynced,
        attachmentsSynced,
      };
    } catch (error) {
      console.error(`Error syncing thread ${gmailThread.id}:`, error);
      throw error;
    }
  }

  /**
   * Sync thread labels
   */
  private async syncThreadLabels(threadId: number, gmailMessages: any[]): Promise<void> {
    try {
      // Get all unique label IDs from messages
      const labelIds = new Set<string>();
      gmailMessages.forEach(msg => {
        if (msg.labelIds) {
          msg.labelIds.forEach((labelId: string) => labelIds.add(labelId));
        }
      });

      // Get label database IDs
      const dbLabels = await db.select()
        .from(labels)
        .where(inArray(labels.labelId, Array.from(labelIds)));;

      // Insert thread-label relationships
      const threadLabelInserts = dbLabels.map(label => ({
        threadId: threadId,
        labelId: label.id,
      }));

      if (threadLabelInserts.length > 0) {
        await db.insert(threadLabels).values(threadLabelInserts);
      }
    } catch (error) {
      console.error('Error syncing thread labels:', error);
      throw error;
    }
  }

  /**
   * Sync a single message
   */
  private async syncMessage(userId: number, threadId: number, gmailMessage: any): Promise<SyncResult> {
    let messagesSynced = 0;
    let attachmentsSynced = 0;

    try {
      // Check if message already exists
      const existingMessage = await db.select()
        .from(messages)
        .where(and(
          eq(messages.threadId, threadId),
          eq(messages.gmailMessageId, gmailMessage.id)
        ))
        .limit(1);

      if (!existingMessage.length) {
        // Extract message data
        const headers = gmailMessage.payload.headers || [];
        const from = this.gmailApi.getHeaderValue(headers, 'From') || '';
        const to = this.gmailApi.getHeaderValue(headers, 'To') || '';
        const cc = this.gmailApi.getHeaderValue(headers, 'Cc');
        const bcc = this.gmailApi.getHeaderValue(headers, 'Bcc');
        const subject = this.gmailApi.getHeaderValue(headers, 'Subject') || '';
        const date = new Date(parseInt(gmailMessage.internalDate));

        // Extract HTML body
        const htmlBody = this.gmailApi.extractHtmlBody(gmailMessage.payload);
        let bodyS3Key: string | null = null;

        if (htmlBody) {
          const uploadResult = await this.s3Service.uploadEmailBody(
            userId,
            gmailMessage.id,
            htmlBody
          );
          bodyS3Key = uploadResult.key;
        }

        // Insert message
        const [newMessage] = await db.insert(messages).values({
          gmailMessageId: gmailMessage.id,
          threadId: threadId,
          from,
          to,
          cc,
          bcc,
          subject,
          date,
          snippet: gmailMessage.snippet,
          bodyS3Key,
          headers: headers,
          isUnread: gmailMessage.labelIds?.includes('UNREAD') || false,
          isStarred: gmailMessage.labelIds?.includes('STARRED') || false,
          isDraft: gmailMessage.labelIds?.includes('DRAFT') || false,
        }).returning();

        messagesSynced = 1;

        // Sync attachments
        const attachmentParts = this.gmailApi.extractAttachments(gmailMessage.payload);
        for (const attachmentPart of attachmentParts) {
          try {
            if (attachmentPart.body?.attachmentId) {
              const attachmentData = await this.gmailApi.getAttachment(
                gmailMessage.id,
                attachmentPart.body.attachmentId
              );

              const uploadResult = await this.s3Service.uploadAttachment(
                userId,
                gmailMessage.id,
                attachmentPart.body.attachmentId,
                attachmentPart.filename || 'unknown',
                attachmentPart.mimeType,
                Buffer.from(attachmentData.data, 'base64')
              );

              await db.insert(attachments).values({
                messageId: newMessage!.id,
                gmailAttachmentId: attachmentPart.body.attachmentId,
                filename: attachmentPart.filename || 'unknown',
                mimeType: attachmentPart.mimeType,
                size: attachmentData.size,
                s3Key: uploadResult.key,
                inline: attachmentPart.headers?.some((h: any) => 
                  h.name.toLowerCase() === 'content-disposition' && 
                  h.value.includes('inline')
                ) || false,
              });

              attachmentsSynced++;
            }
          } catch (error) {
            console.error(`Error syncing attachment ${attachmentPart.body?.attachmentId}:`, error);
          }
        }
      }

      return {
        success: true,
        threadsSynced: 0,
        messagesSynced,
        attachmentsSynced,
      };
    } catch (error) {
      console.error(`Error syncing message ${gmailMessage.id}:`, error);
      throw error;
    }
  }

  /**
   * Clean up threads that were deleted from Gmail
   * Deletes threads that were not seen in the current sync (lastSeenAt < syncStartTime)
   */
  private async cleanupDeletedThreads(userId: number, syncStartTime: Date): Promise<number> {
    try {
      // Find threads that weren't seen in this sync (deleted from Gmail)
      const deletedThreads = await db.select({ id: threads.id })
        .from(threads)
        .where(
          and(
            eq(threads.userId, userId),
            lt(threads.lastSeenAt, syncStartTime)
          )
        );

      if (deletedThreads.length > 0) {
        const threadIds = deletedThreads.map(t => t.id);

        // Delete the threads (cascading deletes will handle messages, attachments, etc.)
        await db.delete(threads)
          .where(inArray(threads.id, threadIds));

        console.log(`Deleted ${deletedThreads.length} threads that were removed from Gmail`);
        return deletedThreads.length;
      }

      return 0;
    } catch (error) {
      console.error('Error cleaning up deleted threads:', error);
      throw error;
    }
  }

  /**
   * Start a sync log entry
   */
  private async startSyncLog(userId: number, syncType: string): Promise<number> {
    const [syncLog] = await db.insert(syncLogs).values({
      userId,
      syncType,
      status: 'running',
    }).returning();

    return syncLog!.id;
  }

  /**
   * Complete a sync log entry
   */
  private async completeSyncLog(
    syncLogId: number,
    status: string,
    threadsSynced: number,
    messagesSynced: number,
    errorMessage?: string
  ): Promise<void> {
    await db.update(syncLogs)
      .set({
        completedAt: new Date(),
        status,
        threadsSynced,
        messagesSynced,
        errorMessage,
      })
      .where(eq(syncLogs.id, syncLogId));
  }
}
