import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { users, threads, messages, labels, threadLabels, attachments as attachmentsTable } from "~/server/db/schema";
import { eq, and, desc, asc, inArray, count, sql } from "drizzle-orm";
import { S3Service } from "~/lib/s3-service";
import { GmailApiService } from "~/lib/gmail-api";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const gmailRouter = createTRPCRouter({
  /**
   * Get user's email threads with pagination
   */
  getThreads: protectedProcedure
    .input(z.object({
      limit: z.number().default(20),
      cursor: z.number().optional(), // Changed from page to cursor for infinite queries
      label: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const page = input.cursor ?? 1;
      const offset = (page - 1) * input.limit;

      // Build query with optional label filter
      let userThreads;

      if (input.label) {
        // When filtering by label, use a subquery to avoid duplicates
        userThreads = await db.select({
          id: threads.id,
          gmailThreadId: threads.gmailThreadId,
          snippet: threads.snippet,
          lastMessageDate: threads.lastMessageDate,
          isUnread: threads.isUnread,
          isStarred: threads.isStarred,
          isImportant: threads.isImportant,
          isDraft: threads.isDraft,
          createdAt: threads.createdAt,
        })
          .from(threads)
          .where(and(
            eq(threads.userId, userId),
            inArray(threads.id,
              db.select({ threadId: threadLabels.threadId })
                .from(threadLabels)
                .innerJoin(labels, and(
                  eq(threadLabels.labelId, labels.id),
                  eq(labels.labelId, input.label),
                  eq(labels.userId, userId)
                ))
            )
          ))
          .orderBy(desc(threads.lastMessageDate))
          .limit(input.limit)
          .offset(offset);
      } else {
        // When not filtering by label, simple query
        userThreads = await db.select({
          id: threads.id,
          gmailThreadId: threads.gmailThreadId,
          snippet: threads.snippet,
          lastMessageDate: threads.lastMessageDate,
          isUnread: threads.isUnread,
          isStarred: threads.isStarred,
          isImportant: threads.isImportant,
          isDraft: threads.isDraft,
          createdAt: threads.createdAt,
        })
          .from(threads)
          .where(eq(threads.userId, userId))
          .orderBy(desc(threads.lastMessageDate))
          .limit(input.limit)
          .offset(offset);
      }

      // Get message count for each thread
      const threadIds = userThreads.map(t => t.id);
      const messageCounts = threadIds.length > 0 ? await db.select({
        threadId: messages.threadId,
        count: count(messages.id),
      })
        .from(messages)
        .where(inArray(messages.threadId, threadIds))
        .groupBy(messages.threadId) : [];

      // Get latest message for each thread using a subquery approach
      const latestMessages = threadIds.length > 0 ? await Promise.all(
        threadIds.map(async (threadId) => {
          const latestMessage = await db.select({
            threadId: messages.threadId,
            from: messages.from,
            subject: messages.subject,
            snippet: messages.snippet,
            date: messages.date,
          })
            .from(messages)
            .where(eq(messages.threadId, threadId))
            .orderBy(desc(messages.date))
            .limit(1);

          return latestMessage[0];
        })
      ).then(results => results.filter(Boolean)) : [];

      // Combine data and ensure uniqueness
      const threadsMap = new Map<number, any>();

      userThreads.forEach(thread => {
        if (!threadsMap.has(thread.id)) {
          const messageCount = messageCounts.find(mc => mc.threadId === thread.id)?.count || 0;
          const latestMessage = latestMessages.find(lm => lm?.threadId === thread.id);

          threadsMap.set(thread.id, {
            ...thread,
            messageCount,
            latestMessage,
          });
        }
      });

      const threadsWithData = Array.from(threadsMap.values());

      return {
        threads: threadsWithData,
        hasMore: threadsWithData.length === input.limit,
        nextCursor: threadsWithData.length === input.limit ? page + 1 : undefined,
        total: threadsWithData.length,
      };
    }),

  /**
   * Get messages for a specific thread
   */
  getThreadMessages: protectedProcedure
    .input(z.object({
      threadId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify thread belongs to user
      const thread = await db.select()
        .from(threads)
        .where(and(
          eq(threads.id, input.threadId),
          eq(threads.userId, userId)
        ))
        .limit(1);

      if (!thread.length) {
        throw new Error("Thread not found");
      }

      // Get messages for the thread
      const threadMessages = await db.select({
        id: messages.id,
        gmailMessageId: messages.gmailMessageId,
        from: messages.from,
        to: messages.to,
        cc: messages.cc,
        bcc: messages.bcc,
        subject: messages.subject,
        date: messages.date,
        snippet: messages.snippet,
        bodyS3Key: messages.bodyS3Key,
        isUnread: messages.isUnread,
        isStarred: messages.isStarred,
        isDraft: messages.isDraft,
        createdAt: messages.createdAt,
      })
        .from(messages)
        .where(eq(messages.threadId, input.threadId))
        .orderBy(asc(messages.date));

      // Get attachments for each message
      const messageIds = threadMessages.map(m => m.id);
      const attachments = await db.select({
        messageId: attachmentsTable.messageId,
        id: attachmentsTable.id,
        gmailAttachmentId: attachmentsTable.gmailAttachmentId,
        filename: attachmentsTable.filename,
        mimeType: attachmentsTable.mimeType,
        size: attachmentsTable.size,
        s3Key: attachmentsTable.s3Key,
        inline: attachmentsTable.inline,
      })
        .from(attachmentsTable)
        .where(inArray(attachmentsTable.messageId, messageIds));

      // Combine messages with their attachments
      const messagesWithAttachments = threadMessages.map(message => ({
        ...message,
        attachments: attachments.filter(att => att.messageId === message.id),
      }));

      return {
        thread: thread[0],
        messages: messagesWithAttachments,
      };
    }),

  /**
   * Get user's labels
   */
  getLabels: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;

      const userLabels = await db.select({
        id: labels.id,
        labelId: labels.labelId,
        name: labels.name,
        type: labels.type,
      })
        .from(labels)
        .where(eq(labels.userId, userId))
        .orderBy(asc(labels.name));

      return userLabels;
    }),

  /**
   * Get thread count by label
   */
  getThreadCounts: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;

      // Get all labels for user
      const userLabels = await db.select({
        id: labels.id,
        labelId: labels.labelId,
        name: labels.name,
        type: labels.type,
      })
        .from(labels)
        .where(eq(labels.userId, userId));

      // Get thread counts for each label
      const labelCounts = await Promise.all(
        userLabels.map(async (label) => {
          const countResult = await db.select({ count: count(threads.id) })
            .from(threads)
            .innerJoin(threadLabels, eq(threads.id, threadLabels.threadId))
            .where(and(
              eq(threads.userId, userId),
              eq(threadLabels.labelId, label.id)
            ));

          return {
            ...label,
            count: countResult[0]?.count || 0,
          };
        })
      );

      return labelCounts;
    }),

  /**
   * Mark thread as read/unread
   */
  markThreadRead: protectedProcedure
    .input(z.object({
      threadId: z.number(),
      isUnread: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify thread belongs to user
      const thread = await db.select()
        .from(threads)
        .where(and(
          eq(threads.id, input.threadId),
          eq(threads.userId, userId)
        ))
        .limit(1);

      if (!thread.length) {
        throw new Error("Thread not found");
      }

      // Update thread
      await db.update(threads)
        .set({ isUnread: input.isUnread })
        .where(eq(threads.id, input.threadId));

      // Update all messages in the thread
      await db.update(messages)
        .set({ isUnread: input.isUnread })
        .where(eq(messages.threadId, input.threadId));

      return { success: true };
    }),

  /**
   * Star/unstar thread
   */
  toggleThreadStar: protectedProcedure
    .input(z.object({
      threadId: z.number(),
      isStarred: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify thread belongs to user
      const thread = await db.select()
        .from(threads)
        .where(and(
          eq(threads.id, input.threadId),
          eq(threads.userId, userId)
        ))
        .limit(1);

      if (!thread.length) {
        throw new Error("Thread not found");
      }

      // Update thread
      await db.update(threads)
        .set({ isStarred: input.isStarred })
        .where(eq(threads.id, input.threadId));

      // Update all messages in the thread
      await db.update(messages)
        .set({ isStarred: input.isStarred })
        .where(eq(messages.threadId, input.threadId));

      return { success: true };
    }),

  /**
   * Get message body content from S3
   */
  getMessageBody: protectedProcedure
    .input(z.object({
      s3Key: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      try {
        // Verify the S3 key belongs to the current user
        if (!input.s3Key.startsWith(`emails/${userId}/bodies/`)) {
          throw new Error("Unauthorized access to message body");
        }

        const s3Service = new S3Service();

        // Get presigned URL for the content
        const downloadUrl = await s3Service.getDownloadUrl(input.s3Key, 300); // 5 minutes expiry

        // Fetch the content directly
        const response = await fetch(downloadUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch content: ${response.statusText}`);
        }

        const htmlContent = await response.text();
        return htmlContent;
      } catch (error) {
        console.error(`Error fetching message body from S3:`, error);
        throw new Error("Failed to load message content");
      }
    }),

  /**
   * Get attachment download URL from S3
   */
  getAttachmentUrl: protectedProcedure
    .input(z.object({
      attachmentId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get attachment from database
      const attachment = await db.select({
        s3Key: attachmentsTable.s3Key,
        filename: attachmentsTable.filename,
        mimeType: attachmentsTable.mimeType,
        messageId: attachmentsTable.messageId,
      })
        .from(attachmentsTable)
        .innerJoin(messages, eq(attachmentsTable.messageId, messages.id))
        .innerJoin(threads, eq(messages.threadId, threads.id))
        .where(and(
          eq(attachmentsTable.id, input.attachmentId),
          eq(threads.userId, userId)
        ))
        .limit(1);

      if (!attachment.length) {
        throw new Error("Attachment not found");
      }

      const s3Service = new S3Service();

      // Generate presigned URL for download
      const downloadUrl = await s3Service.getDownloadUrl(attachment[0]!.s3Key, 3600); // 1 hour expiry

      return {
        downloadUrl,
        filename: attachment[0]!.filename,
        mimeType: attachment[0]!.mimeType,
      };
    }),

  /**
   * Send a new email
   */
  sendEmail: protectedProcedure
    .input(z.object({
      to: z.array(z.string().email()),
      cc: z.array(z.string().email()).optional(),
      bcc: z.array(z.string().email()).optional(),
      subject: z.string(),
      body: z.string(),
      isHtml: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      console.log('tRPC sendEmail received:', {
        to: input.to,
        subject: input.subject,
        body: input.body,
        bodyLength: input.body.length
      });

      try {
        // Get user's OAuth tokens
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

        const gmailApi = new GmailApiService(
          user[0]!.oauthAccessToken,
          user[0]!.oauthRefreshToken
        );

        const result = await gmailApi.sendEmail({
          to: input.to,
          cc: input.cc,
          bcc: input.bcc,
          subject: input.subject,
          body: input.body,
          isHtml: input.isHtml,
        });

        return {
          success: true,
          messageId: result.id,
          threadId: result.threadId,
        };
      } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Failed to send email');
      }
    }),

  /**
   * Reply to a message in a thread
   */
  replyToMessage: protectedProcedure
    .input(z.object({
      messageId: z.string(),
      body: z.string(),
      replyAll: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      try {
        // Verify the message belongs to the user
        const message = await db.select({
          gmailMessageId: messages.gmailMessageId,
          threadId: messages.threadId,
        })
          .from(messages)
          .innerJoin(threads, eq(messages.threadId, threads.id))
          .where(and(
            eq(messages.id, parseInt(input.messageId)),
            eq(threads.userId, userId)
          ))
          .limit(1);

        if (!message.length) {
          throw new Error("Message not found");
        }

        // Get user's OAuth tokens
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

        const gmailApi = new GmailApiService(
          user[0]!.oauthAccessToken,
          user[0]!.oauthRefreshToken
        );

        const result = await gmailApi.replyToMessage(
          message[0]!.gmailMessageId,
          input.body,
          input.replyAll
        );

        // Create a temporary message object to return for immediate UI update
        const currentUser = await db.select({
          email: users.email,
        })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        const tempMessage = {
          id: Date.now(), // Temporary ID
          gmailMessageId: result.id,
          from: currentUser[0]?.email || 'me',
          to: message[0]!.threadId ? 'thread participants' : '',
          cc: '',
          bcc: '',
          subject: `Re: ${message[0]!.threadId}`,
          date: new Date(),
          snippet: input.body.substring(0, 100),
          bodyS3Key: '', // Will be populated during next sync
          isUnread: false,
          isStarred: false,
          isDraft: false,
          createdAt: new Date(),
          attachments: [],
        };

        return {
          success: true,
          messageId: result.id,
          threadId: result.threadId,
          tempMessage,
        };
      } catch (error) {
        console.error('Error replying to message:', error);
        throw new Error('Failed to send reply');
      }
    }),

  /**
   * Forward a message
   */
  forwardMessage: protectedProcedure
    .input(z.object({
      messageId: z.string(),
      to: z.array(z.string().email()),
      cc: z.array(z.string().email()).optional(),
      body: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      try {
        // Verify the message belongs to the user
        const message = await db.select({
          gmailMessageId: messages.gmailMessageId,
          threadId: messages.threadId,
        })
          .from(messages)
          .innerJoin(threads, eq(messages.threadId, threads.id))
          .where(and(
            eq(messages.id, parseInt(input.messageId)),
            eq(threads.userId, userId)
          ))
          .limit(1);

        if (!message.length) {
          throw new Error("Message not found");
        }

        // Get user's OAuth tokens
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

        const gmailApi = new GmailApiService(
          user[0]!.oauthAccessToken,
          user[0]!.oauthRefreshToken
        );

        const result = await gmailApi.forwardMessage(
          message[0]!.gmailMessageId,
          input.to,
          input.cc || [],
          input.body || ''
        );

        return {
          success: true,
          messageId: result.id,
          threadId: result.threadId,
        };
      } catch (error) {
        console.error('Error forwarding message:', error);
        throw new Error('Failed to forward message');
      }
    }),
});
