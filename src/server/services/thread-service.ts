import { db } from "~/server/db";
import { threads, messages, labels, threadLabels } from "~/server/db/schema";
import { eq, and, desc, inArray, sql, or, ilike } from "drizzle-orm";

export class ThreadService {
  async getThreads(
    userId: number,
    params: {
      limit: number;
      cursor?: number;
      label?: string;
      searchQuery?: string;
    },
  ) {
    const offset = params.cursor ?? 0;

    console.log('getThreads called with params:', params);

    // Quick check to see if there are any messages for this user
    if (params.searchQuery) {
      const messageCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(messages)
        .innerJoin(threads, eq(messages.threadId, threads.id))
        .where(eq(threads.userId, userId));

      console.log('Total messages for user:', messageCount[0]?.count || 0);
    }

    let userThreads;

    let query = db
      .select({
        id: threads.id,
        gmailThreadId: threads.gmailThreadId,
        lastMessageDate: threads.lastMessageDate,
        isUnread: threads.isUnread,
        isStarred: threads.isStarred,
        isImportant: threads.isImportant,
        isDraft: threads.isDraft,
        createdAt: threads.createdAt,
      })
      .from(threads);

    const conditions = [eq(threads.userId, userId)];

    if (params.label) {
      // When filtering by label, use a subquery to avoid duplicates
      const labelSubquery = db
        .select({ threadId: threadLabels.threadId })
        .from(threadLabels)
        .innerJoin(
          labels,
          and(
            eq(threadLabels.labelId, labels.id),
            eq(labels.labelId, params.label),
            eq(labels.userId, userId),
          ),
        );
      conditions.push(inArray(threads.id, labelSubquery));
    }

    if (params.searchQuery && params.searchQuery.trim()) {
      console.log('Search query received:', params.searchQuery);
      const searchTerm = params.searchQuery.trim();
      const searchPattern = `%${searchTerm}%`;

      const searchSubquery = db
        .select({ threadId: messages.threadId })
        .from(messages)
        .where(
          or(
            ilike(messages.subject, searchPattern),
            ilike(messages.from, searchPattern),
            ilike(messages.to, searchPattern),
            ilike(messages.snippet, searchPattern),
            ilike(messages.cc, searchPattern),
            ilike(messages.bcc, searchPattern)
          )
        );

      console.log('Search pattern:', searchPattern);
      conditions.push(inArray(threads.id, searchSubquery));
    }

    query = query.where(and(...conditions)) as typeof query;

    query = query
      .orderBy(desc(threads.lastMessageDate))
      .limit(params.limit)
      .offset(offset) as typeof query;

    userThreads = await query;

    console.log('Search results:', {
      searchQuery: params.searchQuery,
      threadCount: userThreads.length,
      limit: params.limit,
      offset: offset
    });

    // Get message counts for each thread
    const threadIds = userThreads.map((thread) => thread.id);
    const messageCounts =
      threadIds.length > 0
        ? await db
            .select({
              threadId: messages.threadId,
              messageCount: sql<number>`COUNT(*)::int`,
            })
            .from(messages)
            .where(inArray(messages.threadId, threadIds))
            .groupBy(messages.threadId)
        : [];

    // Get latest message for each thread using CTE
    const latestMessages =
      threadIds.length > 0
        ? await db
            .execute(
              sql`
      WITH latest_msg_ids AS (
        SELECT thread_id, MAX(id) as max_id
        FROM messages
        WHERE thread_id IN (${sql.join(threadIds, sql.raw(","))})
        GROUP BY thread_id
      )
      SELECT m.thread_id as "threadId", m.from, m.subject, m.date, m.snippet
      FROM messages m
      INNER JOIN latest_msg_ids lm ON m.thread_id = lm.thread_id AND m.id = lm.max_id
    `,
            )
            .then((result) =>
              result.rows.map((row: any) => ({
                threadId: parseInt(row.threadId), // Convert string to number
                from: row.from,
                subject: row.subject,
                date: row.date,
                snippet: row.snippet,
              })),
            )
        : [];

    // Combine the data
    const threadsWithCounts = userThreads.map((thread) => {
      const messageCountData = messageCounts.find(
        (mc) => mc.threadId === thread.id,
      );
      const latestMessage = latestMessages.find(
        (lm) => lm.threadId === thread.id,
      );

      return {
        ...thread,
        snippet: latestMessage?.snippet || null, // Use snippet from latest message
        messageCount: messageCountData?.messageCount || 1,
        latestMessage: latestMessage
          ? {
              from: latestMessage.from,
              subject: latestMessage.subject,
              date: latestMessage.date,
            }
          : null,
      };
    });

    // Calculate if there are more pages available
    const hasMorePages = userThreads.length === params.limit;
    const nextCursor = hasMorePages ? offset + params.limit : null;

    return {
      threads: threadsWithCounts,
      nextCursor,
    };
  }

  async markThreadRead(userId: number, threadId: number) {
    // Verify thread belongs to user
    const thread = await db
      .select({ id: threads.id })
      .from(threads)
      .where(and(eq(threads.id, threadId), eq(threads.userId, userId)))
      .limit(1);

    if (!thread.length) {
      throw new Error("Thread not found or access denied");
    }

    await db
      .update(threads)
      .set({
        isUnread: false,
        updatedAt: new Date(),
      })
      .where(eq(threads.id, threadId));

    return { success: true };
  }

  async toggleThreadStar(userId: number, threadId: number) {
    // Verify thread belongs to user and get current state
    const thread = await db
      .select({
        id: threads.id,
        isStarred: threads.isStarred,
      })
      .from(threads)
      .where(and(eq(threads.id, threadId), eq(threads.userId, userId)))
      .limit(1);

    if (!thread.length) {
      throw new Error("Thread not found or access denied");
    }

    const newStarredState = !thread[0]!.isStarred;

    await db
      .update(threads)
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
    const thread = await db
      .select()
      .from(threads)
      .where(and(eq(threads.id, threadId), eq(threads.userId, userId)))
      .limit(1);

    if (!thread.length) {
      throw new Error("Thread not found or access denied");
    }

    return thread[0];
  }
}
