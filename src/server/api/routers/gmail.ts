import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { GmailService } from "~/server/services/gmail-service";
import { ThreadService } from "~/server/services/thread-service";
import { MessageService } from "~/server/services/message-service";

const gmailService = new GmailService();
const threadService = new ThreadService();
const messageService = new MessageService();

export const gmailRouter = createTRPCRouter({
  /**
   * Get user's email threads with pagination
   */
  getThreads: protectedProcedure
    .input(z.object({
      limit: z.number().default(20),
      cursor: z.number().optional(),
      label: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        return await threadService.getThreads(ctx.session.user.id, input);
      } catch (error) {
        console.error('Error fetching threads:', error);
        throw new Error('Failed to fetch threads');
      }
    }),

  /**
   * Get messages in a specific thread
   */
  getThreadMessages: protectedProcedure
    .input(z.object({
      threadId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        return await messageService.getThreadMessages(ctx.session.user.id, input.threadId);
      } catch (error) {
        console.error('Error fetching thread messages:', error);
        throw new Error('Failed to fetch thread messages');
      }
    }),

  /**
   * Get user's Gmail labels
   */
  getLabels: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        return await gmailService.getLabels(ctx.session.user.id);
      } catch (error) {
        console.error('Error fetching labels:', error);
        throw new Error('Failed to fetch labels');
      }
    }),

  /**
   * Get thread counts by label
   */
  getThreadCounts: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        return await gmailService.getThreadCounts(ctx.session.user.id);
      } catch (error) {
        console.error('Error fetching thread counts:', error);
        throw new Error('Failed to fetch thread counts');
      }
    }),

  /**
   * Mark a thread as read
   */
  markThreadRead: protectedProcedure
    .input(z.object({
      threadId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await threadService.markThreadRead(ctx.session.user.id, input.threadId);
      } catch (error) {
        console.error('Error marking thread as read:', error);
        throw new Error('Failed to mark thread as read');
      }
    }),

  /**
   * Toggle thread star status
   */
  toggleThreadStar: protectedProcedure
    .input(z.object({
      threadId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await threadService.toggleThreadStar(ctx.session.user.id, input.threadId);
      } catch (error) {
        console.error('Error toggling thread star:', error);
        throw new Error('Failed to toggle thread star');
      }
    }),

  /**
   * Get message body from S3
   */
  getMessageBody: protectedProcedure
    .input(z.object({
      messageId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        return await gmailService.getMessageBody(ctx.session.user.id, parseInt(input.messageId));
      } catch (error) {
        console.error('Error fetching message body:', error);
        throw new Error('Failed to fetch message body');
      }
    }),

  /**
   * Get download URL for an attachment
   */
  getAttachmentUrl: protectedProcedure
    .input(z.object({
      attachmentId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        return await gmailService.getAttachmentDownloadUrl(ctx.session.user.id, parseInt(input.attachmentId));
      } catch (error) {
        console.error('Error getting attachment URL:', error);
        throw new Error('Failed to get attachment URL');
      }
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
      try {
        console.log('tRPC sendEmail received:', {
          to: input.to,
          subject: input.subject,
          body: input.body,
          bodyLength: input.body.length
        });

        return await gmailService.sendEmail(ctx.session.user.id, input);
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
      try {
        return await gmailService.replyToMessage(ctx.session.user.id, {
          messageId: parseInt(input.messageId),
          body: input.body,
          replyAll: input.replyAll,
        });
      } catch (error) {
        console.error('Error replying to message:', error);
        throw new Error('Failed to reply to message');
      }
    }),

  /**
   * Forward a message
   */
  forwardMessage: protectedProcedure
    .input(z.object({
      messageId: z.string(),
      to: z.array(z.string().email()),
      body: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await gmailService.forwardMessage(ctx.session.user.id, {
          messageId: parseInt(input.messageId),
          to: input.to,
          body: input.body,
        });
      } catch (error) {
        console.error('Error forwarding message:', error);
        throw new Error('Failed to forward message');
      }
    }),
});