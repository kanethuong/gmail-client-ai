import { db } from "~/server/db";
import { threads, messages, attachments as attachmentsTable } from "~/server/db/schema";
import { eq, and, desc } from "drizzle-orm";

export class MessageService {
  async getThreadMessages(userId: number, threadId: number) {
    // Verify thread belongs to user
    const thread = await db.select({
      id: threads.id,
      gmailThreadId: threads.gmailThreadId,
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

    // Get all messages in the thread
    const threadMessages = await db.select({
      id: messages.id,
      gmailMessageId: messages.gmailMessageId,
      from: messages.from,
      to: messages.to,
      cc: messages.cc,
      bcc: messages.bcc,
      subject: messages.subject,
      snippet: messages.snippet,
      bodyS3Key: messages.bodyS3Key,
      isUnread: messages.isUnread,
      date: messages.date,
      createdAt: messages.createdAt,
    })
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(messages.date); // Ascending order: oldest first, newest last

    // Get attachments for all messages in this thread
    const messageIds = threadMessages.map(msg => msg.id);
    const attachments = messageIds.length > 0 ? await db.select({
      id: attachmentsTable.id,
      messageId: attachmentsTable.messageId,
      filename: attachmentsTable.filename,
      mimeType: attachmentsTable.mimeType,
      size: attachmentsTable.size,
      s3Key: attachmentsTable.s3Key,
    })
      .from(attachmentsTable)
      .where(eq(attachmentsTable.messageId, messageIds[0]!) || (messageIds.length > 1 ?
        eq(attachmentsTable.messageId, messageIds[1]!) : eq(attachmentsTable.messageId, messageIds[0]!))) : [];

    // Group attachments by message ID
    const attachmentsByMessage = attachments.reduce((acc, attachment) => {
      if (!acc[attachment.messageId]) {
        acc[attachment.messageId] = [];
      }
      acc[attachment.messageId]!.push(attachment);
      return acc;
    }, {} as Record<number, typeof attachments>);

    // Combine messages with their attachments
    const messagesWithAttachments = threadMessages.map(message => ({
      ...message,
      attachments: attachmentsByMessage[message.id] || [],
    }));

    return {
      thread: thread[0],
      messages: messagesWithAttachments,
    };
  }

  async getMessageById(userId: number, messageId: number) {
    // Verify message belongs to user
    const message = await db.select({
      id: messages.id,
      gmailMessageId: messages.gmailMessageId,
      from: messages.from,
      to: messages.to,
      cc: messages.cc,
      bcc: messages.bcc,
      subject: messages.subject,
      snippet: messages.snippet,
      bodyS3Key: messages.bodyS3Key,
      isUnread: messages.isUnread,
      date: messages.date,
      threadId: messages.threadId,
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

    // Get attachments for this message
    const attachments = await db.select({
      id: attachmentsTable.id,
      filename: attachmentsTable.filename,
      mimeType: attachmentsTable.mimeType,
      size: attachmentsTable.size,
      s3Key: attachmentsTable.s3Key,
    })
      .from(attachmentsTable)
      .where(eq(attachmentsTable.messageId, messageId));

    return {
      ...message[0],
      attachments,
    };
  }

  async markMessageRead(userId: number, messageId: number) {
    // Verify message belongs to user
    const message = await db.select({ id: messages.id })
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

    await db.update(messages)
      .set({
        isUnread: false,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId));

    return { success: true };
  }

  async getAttachmentsByMessageId(userId: number, messageId: number) {
    // Verify message belongs to user first
    const message = await db.select({ id: messages.id })
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

    return await db.select({
      id: attachmentsTable.id,
      filename: attachmentsTable.filename,
      mimeType: attachmentsTable.mimeType,
      size: attachmentsTable.size,
      s3Key: attachmentsTable.s3Key,
    })
      .from(attachmentsTable)
      .where(eq(attachmentsTable.messageId, messageId));
  }
}