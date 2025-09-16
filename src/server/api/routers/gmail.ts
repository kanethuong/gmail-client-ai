import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { users, threads, messages, labels, threadLabels, attachments as attachmentsTable } from "~/server/db/schema";
import { eq, and, desc, asc, inArray, count } from "drizzle-orm";

export const gmailRouter = createTRPCRouter({
  /**
   * Get user's email threads with pagination
   */
  getThreads: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(20),
      label: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const offset = (input.page - 1) * input.limit;

      // Build query with optional label filter
      let query = db.select({
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

      // If label filter is provided, join with threadLabels
      if (input.label) {
        query = query.innerJoin(
          threadLabels,
          eq(threads.id, threadLabels.threadId)
        ).innerJoin(
          labels,
          and(
            eq(threadLabels.labelId, labels.id),
            eq(labels.labelId, input.label)
          )
        );
      }

      const userThreads = await query;

      // Get message count for each thread
      const threadIds = userThreads.map(t => t.id);
      const messageCounts = threadIds.length > 0 ? await db.select({
        threadId: messages.threadId,
        count: count(messages.id),
      })
        .from(messages)
        .where(inArray(messages.threadId, threadIds))
        .groupBy(messages.threadId) : [];

      // Get latest message for each thread
      const latestMessages = threadIds.length > 0 ? await db.select({
        threadId: messages.threadId,
        from: messages.from,
        subject: messages.subject,
        snippet: messages.snippet,
        date: messages.date,
      })
        .from(messages)
        .where(inArray(messages.threadId, threadIds))
        .orderBy(desc(messages.date)) : [];

      // Combine data
      const threadsWithData = userThreads.map(thread => {
        const messageCount = messageCounts.find(mc => mc.threadId === thread.id)?.count || 0;
        const latestMessage = latestMessages.find(lm => lm.threadId === thread.id);
        
        return {
          ...thread,
          messageCount,
          latestMessage,
        };
      });

      return {
        threads: threadsWithData,
        hasMore: userThreads.length === input.limit,
        total: userThreads.length,
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
});
