import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GmailSyncService } from '~/lib/gmail-sync';
import { GmailApiService } from '~/lib/gmail-api';
import { S3Service } from '~/lib/s3-service';

// Mock the dependencies
vi.mock('~/lib/gmail-api');
vi.mock('~/lib/s3-service');
vi.mock('~/server/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('~/server/db/schema', () => ({
  users: { id: 'users.id' },
  labels: { id: 'labels.id', userId: 'labels.userId', labelId: 'labels.labelId' },
  threads: { id: 'threads.id', userId: 'threads.userId', gmailThreadId: 'threads.gmailThreadId' },
  messages: { id: 'messages.id', threadId: 'messages.threadId', gmailMessageId: 'messages.gmailMessageId' },
  attachments: { id: 'attachments.id' },
  threadLabels: { threadId: 'threadLabels.threadId', labelId: 'threadLabels.labelId' },
  syncLogs: { id: 'syncLogs.id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
}));

describe('GmailSyncService', () => {
  let syncService: GmailSyncService;
  let mockGmailApi: any;
  let mockS3Service: any;
  let mockDb: any;

  beforeEach(async () => {
    // Mock GmailApiService
    mockGmailApi = {
      getAllThreads: vi.fn(),
      getLabels: vi.fn(),
      getHeaderValue: vi.fn(),
      extractHtmlBody: vi.fn(),
      extractAttachments: vi.fn(),
      getAttachment: vi.fn(),
    };

    // Mock S3Service
    mockS3Service = {
      uploadEmailBody: vi.fn(),
      uploadAttachment: vi.fn(),
    };

    // Mock database
    const { db } = await import('~/server/db');
    mockDb = db;
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }),
    });
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    // Mock constructors
    vi.mocked(GmailApiService).mockImplementation(() => mockGmailApi);
    vi.mocked(S3Service).mockImplementation(() => mockS3Service);

    syncService = new GmailSyncService('test-access-token', 'test-refresh-token');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with GmailApiService and S3Service', () => {
      expect(GmailApiService).toHaveBeenCalledWith('test-access-token', 'test-refresh-token');
      expect(S3Service).toHaveBeenCalled();
    });
  });

  describe('syncUser', () => {
    it('should perform full sync successfully', async () => {
      const userId = 123;

      // Mock user exists
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: userId }]),
          }),
        }),
      });

      // Mock sync log creation
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      });

      // Mock gmail threads
      const mockThreads = [
        {
          id: 'thread1',
          historyId: 'hist1',
          snippet: 'Test snippet',
          messages: [
            {
              id: 'msg1',
              threadId: 'thread1',
              payload: { headers: [] },
              snippet: 'message snippet',
              internalDate: '1234567890000',
              labelIds: ['INBOX']
            }
          ]
        }
      ];

      mockGmailApi.getAllThreads.mockResolvedValue(mockThreads);
      mockGmailApi.getLabels.mockResolvedValue([
        { id: 'INBOX', name: 'INBOX', type: 'system' }
      ]);

      // Mock successful thread sync
      mockDb.select
        .mockReturnValueOnce({ // For checking existing labels
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        })
        .mockReturnValueOnce({ // For checking existing thread
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        })
        .mockReturnValueOnce({ // For thread labels
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 1, labelId: 'INBOX' }]),
          }),
        })
        .mockReturnValueOnce({ // For checking existing message
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      // Mock thread creation
      mockDb.insert
        .mockReturnValueOnce({ // Label insert
          values: vi.fn().mockResolvedValue(undefined),
        })
        .mockReturnValueOnce({ // Thread insert
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        })
        .mockReturnValueOnce({ // Thread labels insert
          values: vi.fn().mockResolvedValue(undefined),
        })
        .mockReturnValueOnce({ // Message insert
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        });

      // Mock email body extraction and upload
      mockGmailApi.getHeaderValue
        .mockReturnValueOnce('sender@example.com') // From
        .mockReturnValueOnce('receiver@example.com') // To
        .mockReturnValueOnce(null) // CC
        .mockReturnValueOnce(null) // BCC
        .mockReturnValueOnce('Test Subject'); // Subject

      mockGmailApi.extractHtmlBody.mockReturnValue('<html>Test body</html>');
      mockS3Service.uploadEmailBody.mockResolvedValue({ key: 'test-key' });
      mockGmailApi.extractAttachments.mockReturnValue([]);

      const result = await syncService.syncUser(userId);

      expect(result.success).toBe(true);
      expect(result.threadsSynced).toBe(1);
      expect(result.messagesSynced).toBe(1);
      expect(mockGmailApi.getAllThreads).toHaveBeenCalledWith(1000);
      expect(mockGmailApi.getLabels).toHaveBeenCalled();
    });

    it('should handle user not found error', async () => {
      const userId = 999;

      // Mock user not found
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock sync log creation
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      });

      const result = await syncService.syncUser(userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
      expect(result.threadsSynced).toBe(0);
      expect(result.messagesSynced).toBe(0);
    });

    it('should handle Gmail API errors gracefully', async () => {
      const userId = 123;

      // Mock user exists
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: userId }]),
          }),
        }),
      });

      // Mock sync log creation
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      });

      // Mock Gmail API failure
      mockGmailApi.getLabels.mockRejectedValue(new Error('Gmail API error'));

      const result = await syncService.syncUser(userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Gmail API error');
    });

    it('should continue syncing other threads when one fails', async () => {
      const userId = 123;

      // Mock user exists
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: userId }]),
          }),
        }),
      });

      // Mock sync log creation
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      });

      // Mock gmail labels and threads
      mockGmailApi.getLabels.mockResolvedValue([]);

      const mockThreads = [
        {
          id: 'thread1',
          messages: [{ id: 'msg1', internalDate: '1234567890000', labelIds: [] }]
        },
        {
          id: 'thread2',
          messages: [{ id: 'msg2', internalDate: '1234567890000', labelIds: [] }]
        }
      ];

      mockGmailApi.getAllThreads.mockResolvedValue(mockThreads);

      // Mock first thread sync failure, second success
      let syncThreadCallCount = 0;
      const originalSyncThread = syncService.syncThread;
      vi.spyOn(syncService, 'syncThread' as any).mockImplementation(async (userId: number, thread: any) => {
        syncThreadCallCount++;
        if (syncThreadCallCount === 1) {
          throw new Error('Thread sync error');
        }
        return {
          success: true,
          threadsSynced: 1,
          messagesSynced: 1,
          attachmentsSynced: 0
        };
      });

      const result = await syncService.syncUser(userId);

      expect(result.success).toBe(true);
      expect(result.threadsSynced).toBe(1); // Only second thread synced
      expect(result.messagesSynced).toBe(1);
    });
  });

  describe('syncThread (private method access)', () => {
    it('should handle thread with attachments', async () => {
      const userId = 123;
      const threadId = 1;

      const mockMessage = {
        id: 'msg1',
        threadId: 'thread1',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Test Subject' }
          ]
        },
        snippet: 'message snippet',
        internalDate: '1234567890000',
        labelIds: ['INBOX']
      };

      const mockAttachmentPart = {
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        body: { attachmentId: 'att1' }
      };

      // Mock existing message check
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock message creation
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      });

      // Mock header extraction
      mockGmailApi.getHeaderValue
        .mockReturnValueOnce('sender@example.com') // From
        .mockReturnValueOnce('receiver@example.com') // To
        .mockReturnValueOnce(null) // CC
        .mockReturnValueOnce(null) // BCC
        .mockReturnValueOnce('Test Subject'); // Subject

      // Mock body and attachment extraction
      mockGmailApi.extractHtmlBody.mockReturnValue('<html>Test body</html>');
      mockS3Service.uploadEmailBody.mockResolvedValue({ key: 'body-key' });
      mockGmailApi.extractAttachments.mockReturnValue([mockAttachmentPart]);

      // Mock attachment download and upload
      mockGmailApi.getAttachment.mockResolvedValue({
        attachmentId: 'att1',
        data: 'base64-data',
        size: 1024
      });
      mockS3Service.uploadAttachment.mockResolvedValue({ key: 'attachment-key' });

      // Mock attachment insert
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue(undefined),
      });

      // Access private method using type assertion
      const syncService_: any = syncService;
      const result = await syncService_.syncMessage(userId, threadId, mockMessage);

      expect(result.success).toBe(true);
      expect(result.messagesSynced).toBe(1);
      expect(result.attachmentsSynced).toBe(1);
      expect(mockGmailApi.getAttachment).toHaveBeenCalledWith('msg1', 'att1');
      expect(mockS3Service.uploadAttachment).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle S3 upload failures gracefully', async () => {
      const userId = 123;

      // Mock user exists
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: userId }]),
          }),
        }),
      });

      // Mock sync log creation
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      });

      mockGmailApi.getLabels.mockResolvedValue([]);
      mockGmailApi.getAllThreads.mockResolvedValue([
        {
          id: 'thread1',
          messages: [{
            id: 'msg1',
            payload: { headers: [] },
            internalDate: '1234567890000',
            snippet: 'test'
          }]
        }
      ]);

      // Mock S3 upload failure
      mockS3Service.uploadEmailBody.mockRejectedValue(new Error('S3 upload failed'));

      const result = await syncService.syncUser(userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('S3 upload failed');
    });

    it('should handle database connection errors', async () => {
      const userId = 123;

      // Mock database error
      mockDb.select.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      // Mock sync log creation
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      });

      const result = await syncService.syncUser(userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('Performance considerations', () => {
    it('should handle large number of threads efficiently', async () => {
      const userId = 123;

      // Mock user exists
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: userId }]),
          }),
        }),
      });

      // Mock sync log creation
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      });

      mockGmailApi.getLabels.mockResolvedValue([]);

      // Mock 100 threads
      const mockThreads = Array.from({ length: 100 }, (_, i) => ({
        id: `thread${i}`,
        messages: [{
          id: `msg${i}`,
          internalDate: '1234567890000',
          labelIds: []
        }]
      }));

      mockGmailApi.getAllThreads.mockResolvedValue(mockThreads);

      // Mock successful sync for all threads
      vi.spyOn(syncService, 'syncThread' as any).mockResolvedValue({
        success: true,
        threadsSynced: 1,
        messagesSynced: 1,
        attachmentsSynced: 0
      });

      const startTime = Date.now();
      const result = await syncService.syncUser(userId);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.threadsSynced).toBe(100);
      expect(result.messagesSynced).toBe(100);

      // Ensure sync completes within reasonable time (less than 5 seconds for mocked operations)
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});