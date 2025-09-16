import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { appRouter, type AppRouter } from '~/server/api/root';
import { createCallerFactory } from '~/server/api/trpc';
import { GmailSyncService } from '~/lib/gmail-sync';

// Mock dependencies
vi.mock('~/lib/gmail-sync');
vi.mock('~/server/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('~/server/db/schema', () => ({
  users: { id: 'users.id', email: 'users.email', name: 'users.name' },
  threads: { id: 'threads.id', userId: 'threads.userId' },
  messages: { id: 'messages.id', threadId: 'messages.threadId' },
  labels: { id: 'labels.id', userId: 'labels.userId' },
  threadLabels: { threadId: 'threadLabels.threadId', labelId: 'threadLabels.labelId' },
  attachments: { messageId: 'attachments.messageId' },
  syncLogs: { id: 'syncLogs.id', userId: 'syncLogs.userId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
  inArray: vi.fn(),
  count: vi.fn(),
}));

describe('tRPC API Integration Tests', () => {
  let caller: ReturnType<typeof createCallerFactory>;
  let mockDb: any;
  let mockGmailSyncService: any;

  const mockSession = {
    user: {
      id: 1,  // Changed to match database mock return value
      email: 'test@example.com',
      name: 'Test User'
    },
    expires: new Date(Date.now() + 3600000).toISOString()
  };

  const mockContext = {
    session: mockSession,
    db: mockDb,
  };

  beforeEach(async () => {
    // Setup database mock
    const { db } = await import('~/server/db');
    mockDb = db;

    // Setup default database responses
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    // Setup Gmail sync service mock
    mockGmailSyncService = {
      syncUser: vi.fn(),
    };
    vi.mocked(GmailSyncService).mockImplementation(() => mockGmailSyncService);

    // Create tRPC caller with mock context
    const createCaller = createCallerFactory(appRouter);
    caller = createCaller(mockContext as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Sync Router', () => {
    describe('triggerSync', () => {
      it('should trigger sync successfully with valid OAuth tokens', async () => {
        // Mock user with OAuth tokens
        mockDb.select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                id: 1,  // Changed to match session
                email: 'test@example.com',
                oauthAccessToken: 'access-token',
                oauthRefreshToken: 'refresh-token'
              }]),
            }),
          }),
        });

        // Mock successful sync
        mockGmailSyncService.syncUser.mockResolvedValue({
          success: true,
          threadsSynced: 10,
          messagesSynced: 25,
          attachmentsSynced: 5,
        });

        const result = await caller.sync.triggerSync();

        expect(result).toEqual({
          success: true,
          threadsSynced: 10,
          messagesSynced: 25,
          attachmentsSynced: 5,
          error: undefined,
        });

        expect(mockGmailSyncService.syncUser).toHaveBeenCalledWith(1);
        expect(GmailSyncService).toHaveBeenCalledWith('access-token', 'refresh-token');
      });

      it('should throw error when user not found', async () => {
        mockDb.select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

        await expect(caller.sync.triggerSync()).rejects.toThrow('User not found');
      });

      it('should throw error when OAuth tokens are missing', async () => {
        mockDb.select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                id: 123,
                email: 'test@example.com',
                oauthAccessToken: null,
                oauthRefreshToken: null
              }]),
            }),
          }),
        });

        await expect(caller.sync.triggerSync()).rejects.toThrow('User OAuth tokens not found');
      });

      it('should handle sync service errors gracefully', async () => {
        mockDb.select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                id: 123,
                oauthAccessToken: 'token',
                oauthRefreshToken: 'refresh'
              }]),
            }),
          }),
        });

        mockGmailSyncService.syncUser.mockResolvedValue({
          success: false,
          threadsSynced: 0,
          messagesSynced: 0,
          attachmentsSynced: 0,
          error: 'Gmail API error',
        });

        const result = await caller.sync.triggerSync();

        expect(result).toEqual({
          success: false,
          threadsSynced: 0,
          messagesSynced: 0,
          attachmentsSynced: 0,
          error: 'Gmail API error',
        });
      });
    });

    describe('getSyncStatus', () => {
      it('should return sync status with history', async () => {
        const mockUser = {
          id: 123,
          lastSyncAt: new Date('2023-01-01'),
        };

        const mockSyncLogs = [
          {
            id: 1,
            syncType: 'full',
            startedAt: new Date('2023-01-01T10:00:00Z'),
            completedAt: new Date('2023-01-01T10:05:00Z'),
            status: 'success',
            threadsSynced: 10,
            messagesSynced: 25,
            errorMessage: null,
          },
          {
            id: 2,
            syncType: 'incremental',
            startedAt: new Date('2023-01-01T09:00:00Z'),
            completedAt: new Date('2023-01-01T09:02:00Z'),
            status: 'success',
            threadsSynced: 2,
            messagesSynced: 5,
            errorMessage: null,
          }
        ];

        // Mock user query
        mockDb.select
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockUser]),
              }),
            }),
          })
          // Mock sync logs query
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(mockSyncLogs),
                }),
              }),
            }),
          });

        const result = await caller.sync.getSyncStatus();

        expect(result).toEqual({
          lastSyncAt: mockUser.lastSyncAt,
          recentSyncs: mockSyncLogs.map(sync => ({
            id: sync.id,
            syncType: sync.syncType,
            startedAt: sync.startedAt,
            completedAt: sync.completedAt,
            status: sync.status,
            threadsSynced: sync.threadsSynced,
            messagesSynced: sync.messagesSynced,
            errorMessage: sync.errorMessage,
          })),
        });
      });

      it('should handle missing user data gracefully', async () => {
        // Mock empty user result
        mockDb.select
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          })
          // Mock empty sync logs
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          });

        const result = await caller.sync.getSyncStatus();

        expect(result).toEqual({
          lastSyncAt: undefined,
          recentSyncs: [],
        });
      });
    });

    describe('getSyncProgress', () => {
      it('should return sync progress for valid sync log', async () => {
        const mockSyncLog = {
          id: 1,
          status: 'running',
          startedAt: new Date('2023-01-01T10:00:00Z'),
          completedAt: null,
          threadsSynced: 5,
          messagesSynced: 12,
          errorMessage: null,
        };

        mockDb.select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockSyncLog]),
            }),
          }),
        });

        const result = await caller.sync.getSyncProgress({ syncLogId: 1 });

        expect(result).toEqual({
          id: 1,
          status: 'running',
          startedAt: mockSyncLog.startedAt,
          completedAt: null,
          threadsSynced: 5,
          messagesSynced: 12,
          errorMessage: null,
        });
      });

      it('should throw error for non-existent sync log', async () => {
        mockDb.select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

        await expect(caller.sync.getSyncProgress({ syncLogId: 999 }))
          .rejects.toThrow('Sync log not found');
      });
    });

    describe('cancelSync', () => {
      it('should cancel sync successfully', async () => {
        const result = await caller.sync.cancelSync({ syncLogId: 1 });

        expect(result).toEqual({ success: true });
        expect(mockDb.update).toHaveBeenCalled();
      });
    });

    describe('getAccountInfo', () => {
      it('should return account info for valid user', async () => {
        const mockUser = {
          id: 123,
          email: 'test@example.com',
          name: 'Test User',
          lastSyncAt: new Date('2023-01-01'),
          oauthAccessToken: 'token',
          oauthRefreshToken: 'refresh',
        };

        mockDb.select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockUser]),
            }),
          }),
        });

        const result = await caller.sync.getAccountInfo();

        expect(result).toEqual({
          email: 'test@example.com',
          name: 'Test User',
          lastSyncAt: mockUser.lastSyncAt,
          hasOAuthTokens: true,
        });
      });

      it('should throw error for non-existent user', async () => {
        mockDb.select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

        await expect(caller.sync.getAccountInfo()).rejects.toThrow('User not found');
      });
    });
  });

  describe('Gmail Router', () => {
    describe('getThreads', () => {
      it('should return paginated threads with messages', async () => {
        const mockThreads = [
          {
            id: 1,
            gmailThreadId: 'thread1',
            snippet: 'Test thread 1',
            lastMessageDate: new Date('2023-01-01'),
            isUnread: false,
            isStarred: true,
            isImportant: false,
            isDraft: false,
            createdAt: new Date('2023-01-01'),
          }
        ];

        const mockMessageCounts = [{ threadId: 1, count: 3 }];
        const mockLatestMessages = [
          {
            threadId: 1,
            from: 'sender@example.com',
            subject: 'Test Subject',
            snippet: 'Test snippet',
            date: new Date('2023-01-01'),
          }
        ];

        // Mock threads query
        mockDb.select
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(mockThreads),
                  }),
                }),
              }),
            }),
          })
          // Mock message counts
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockResolvedValue(mockMessageCounts),
              }),
            }),
          })
          // Mock latest messages
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockLatestMessages),
              }),
            }),
          });

        const result = await caller.gmail.getThreads({ page: 1, limit: 20 });

        expect(result).toEqual({
          threads: [
            {
              ...mockThreads[0],
              messageCount: 3,
              latestMessage: mockLatestMessages[0],
            }
          ],
          hasMore: false,
          total: 1,
        });
      });

      it('should handle label filtering', async () => {
        const mockQuery = {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
          innerJoin: vi.fn().mockReturnThis(),
        };

        mockDb.select.mockReturnValueOnce(mockQuery);

        await caller.gmail.getThreads({ page: 1, limit: 20, label: 'INBOX' });

        // Verify that innerJoin was called for label filtering
        expect(mockQuery.innerJoin).toHaveBeenCalled();
      });

      it('should handle empty threads gracefully', async () => {
        // Mock empty threads
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        });

        const result = await caller.gmail.getThreads({ page: 1, limit: 20 });

        expect(result).toEqual({
          threads: [],
          hasMore: false,
          total: 0,
        });
      });
    });

    describe('getThreadMessages', () => {
      it('should return thread with messages and attachments', async () => {
        const mockThread = {
          id: 1,
          gmailThreadId: 'thread1',
          snippet: 'Test thread',
        };

        const mockMessages = [
          {
            id: 1,
            gmailMessageId: 'msg1',
            from: 'sender@example.com',
            to: 'receiver@example.com',
            subject: 'Test Subject',
            date: new Date('2023-01-01'),
            snippet: 'Test snippet',
            bodyS3Key: 'body-key',
            isUnread: false,
            isStarred: false,
            isDraft: false,
            createdAt: new Date('2023-01-01'),
          }
        ];

        const mockAttachments = [
          {
            messageId: 1,
            id: 1,
            gmailAttachmentId: 'att1',
            filename: 'test.pdf',
            mimeType: 'application/pdf',
            size: 1024,
            s3Key: 'attachment-key',
            inline: false,
          }
        ];

        // Mock thread verification
        mockDb.select
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockThread]),
              }),
            }),
          })
          // Mock messages query
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockMessages),
              }),
            }),
          })
          // Mock attachments query
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockAttachments),
            }),
          });

        const result = await caller.gmail.getThreadMessages({ threadId: 1 });

        expect(result).toEqual({
          thread: mockThread,
          messages: [
            {
              ...mockMessages[0],
              attachments: mockAttachments,
            }
          ],
        });
      });

      it('should throw error for non-existent thread', async () => {
        mockDb.select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

        await expect(caller.gmail.getThreadMessages({ threadId: 999 }))
          .rejects.toThrow('Thread not found');
      });
    });

    describe('Thread operations', () => {
      it('should mark thread as read/unread', async () => {
        // Mock thread exists
        mockDb.select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
          }),
        });

        const result = await caller.gmail.markThreadRead({
          threadId: 1,
          isUnread: false,
        });

        expect(result).toEqual({ success: true });
        expect(mockDb.update).toHaveBeenCalledTimes(2); // Thread and messages
      });

      it('should toggle thread star', async () => {
        // Mock thread exists
        mockDb.select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
          }),
        });

        const result = await caller.gmail.toggleThreadStar({
          threadId: 1,
          isStarred: true,
        });

        expect(result).toEqual({ success: true });
        expect(mockDb.update).toHaveBeenCalledTimes(2); // Thread and messages
      });

      it('should throw error for unauthorized thread operations', async () => {
        // Mock thread not found (user doesn't own it)
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

        await expect(caller.gmail.markThreadRead({
          threadId: 999,
          isUnread: false,
        })).rejects.toThrow('Thread not found');

        await expect(caller.gmail.toggleThreadStar({
          threadId: 999,
          isStarred: true,
        })).rejects.toThrow('Thread not found');
      });
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle database connection errors', async () => {
      mockDb.select.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(caller.sync.getAccountInfo()).rejects.toThrow('Database connection failed');
    });

    it('should validate input parameters', async () => {
      // Test invalid input types
      await expect(caller.sync.getSyncProgress({ syncLogId: 'invalid' as any }))
        .rejects.toThrow();

      await expect(caller.gmail.getThreads({ page: -1, limit: 0 }))
        .rejects.toThrow();
    });

    it('should handle concurrent operations safely', async () => {
      // Mock successful responses
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 123,
              oauthAccessToken: 'token',
              oauthRefreshToken: 'refresh'
            }]),
          }),
        }),
      });

      mockGmailSyncService.syncUser.mockResolvedValue({
        success: true,
        threadsSynced: 1,
        messagesSynced: 1,
        attachmentsSynced: 0,
      });

      // Trigger multiple syncs concurrently
      const syncPromises = Array.from({ length: 3 }, () => caller.sync.triggerSync());
      const results = await Promise.all(syncPromises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify sync service was called 3 times
      expect(mockGmailSyncService.syncUser).toHaveBeenCalledTimes(3);
    });
  });
});