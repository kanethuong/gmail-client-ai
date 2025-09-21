import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { z } from "zod";
import { ThreadService } from "~/server/services/thread-service";

const threadService = new ThreadService();

export const searchRouter = createTRPCRouter({
  searchThreads: protectedProcedure
    .input(z.object({
      query: z.string().min(1, "Search query cannot be empty"),
      limit: z.number().default(20),
      cursor: z.number().optional(),
      label: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        return await threadService.getThreads(ctx.session.user.id, {
          limit: input.limit,
          cursor: input.cursor,
          label: input.label,
          searchQuery: input.query,
        });
      } catch (error) {
        console.error('Error searching threads:', error);
        throw new Error('Failed to search threads');
      }
    }),

  searchSuggestions: protectedProcedure
    .input(z.object({
      query: z.string().min(1, "Search query cannot be empty"),
      limit: z.number().default(5),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const results = await threadService.getThreads(ctx.session.user.id, {
          limit: input.limit,
          searchQuery: input.query,
        });

        // Extract unique subjects and senders for suggestions
        const suggestions = new Set<string>();

        results.threads.forEach(thread => {
          if (thread.latestMessage?.subject) {
            suggestions.add(thread.latestMessage.subject);
          }
          if (thread.latestMessage?.from) {
            suggestions.add(thread.latestMessage.from);
          }
        });

        return Array.from(suggestions).slice(0, input.limit);
      } catch (error) {
        console.error('Error getting search suggestions:', error);
        throw new Error('Failed to get search suggestions');
      }
    }),
})