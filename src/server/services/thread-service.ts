import { db } from "~/server/db";
import { threads, messages, labels, threadLabels } from "~/server/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";

export class ThreadService {
  async getThreads(userId: number, params: {
    limit: number;
    cursor?: number;
    label?: string;
  }) {
    const offset = params.cursor ?? 0;

    let userThreads;

    if (params.label) {
      // When filtering by label, use a subquery to avoid duplicates
      userThreads = await db.select({
        id: threads.id,
        gmailThreadId: threads.gmailThreadId,
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
                eq(labels.labelId, params.label),
                eq(labels.userId, userId)
              ))
          )
        ))
        .orderBy(desc(threads.lastMessageDate))
        .limit(params.limit)
        .offset(offset);
    } else {
      userThreads = await db.select({
        id: threads.id,
        gmailThreadId: threads.gmailThreadId,
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
        .limit(params.limit)
        .offset(offset);
    }

    // Get message counts for each thread
    const threadIds = userThreads.map(thread => thread.id);
    const messageCounts = threadIds.length > 0 ? await db.select({
      threadId: messages.threadId,
      messageCount: sql<number>`COUNT(*)::int`,
    })
      .from(messages)
      .where(inArray(messages.threadId, threadIds))
      .groupBy(messages.threadId) : [];

    // Get latest message for each thread using CTE
    const latestMessages = threadIds.length > 0 ? await db.execute(sql`
      WITH latest_msg_ids AS (
        SELECT thread_id, MAX(id) as max_id
        FROM messages
        WHERE thread_id IN (${sql.join(threadIds, sql.raw(','))})
        GROUP BY thread_id
      )
      SELECT m.thread_id as "threadId", m.from, m.subject, m.date, m.snippet
      FROM messages m
      INNER JOIN latest_msg_ids lm ON m.thread_id = lm.thread_id AND m.id = lm.max_id
    `).then(result => result.rows.map((row: any) => ({
      threadId: parseInt(row.threadId), // Convert string to number
      from: row.from,
      subject: row.subject,
      date: row.date,
      snippet: row.snippet
    }))) : [];

    // Combine the data
    const threadsWithCounts = userThreads.map(thread => {
      const messageCountData = messageCounts.find(mc => mc.threadId === thread.id);
      const latestMessage = latestMessages.find(lm => lm.threadId === thread.id);

      return {
        ...thread,
        snippet: latestMessage?.snippet || null, // Use snippet from latest message
        messageCount: messageCountData?.messageCount || 1,
        latestMessage: latestMessage ? {
          from: latestMessage.from,
          subject: latestMessage.subject,
          date: latestMessage.date,
        } : null,
      };
    });

    return {
      threads: threadsWithCounts,
      nextCursor: userThreads.length === params.limit ? offset + params.limit : null,
    };
  }

  async markThreadRead(userId: number, threadId: number) {
    // Verify thread belongs to user
    const thread = await db.select({ id: threads.id })
      .from(threads)
      .where(and(
        eq(threads.id, threadId),
        eq(threads.userId, userId)
      ))
      .limit(1);

    if (!thread.length) {
      throw new Error("Thread not found or access denied");
    }

    await db.update(threads)
      .set({
        isUnread: false,
        updatedAt: new Date(),
      })
      .where(eq(threads.id, threadId));

    return { success: true };
  }

  async toggleThreadStar(userId: number, threadId: number) {
    // Verify thread belongs to user and get current state
    const thread = await db.select({
      id: threads.id,
      isStarred: threads.isStarred,
    })
      .from(threads)
      .where(and(
        eq(threads.id, threadId),
        eq(threads.userId, userId)
      ))
      .limit(1);

    if (!thread.length) {
      throw new Error("Thread not found or access denied");
    }

    const newStarredState = !thread[0]!.isStarred;

    await db.update(threads)
      .set({
        isStarred: newStarredState,
        updatedAt: new Date(),
      })
      .where(eq(threads.id, threadId));

    return {
      success: true,
      isStarred: newStarredState,
    };
  }

  async getThreadById(userId: number, threadId: number) {
    const thread = await db.select()
      .from(threads)
      .where(and(
        eq(threads.id, threadId),
        eq(threads.userId, userId)
      ))
      .limit(1);

    if (!thread.length) {
      throw new Error("Thread not found or access denied");
    }

    return thread[0];
  }
}