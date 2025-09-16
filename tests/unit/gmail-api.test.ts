import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GmailApiService } from '~/lib/gmail-api';
import { google } from 'googleapis';

// Mock the googleapis module
vi.mock('googleapis');

describe('GmailApiService', () => {
  let gmailService: GmailApiService;
  let mockGmail: any;
  let mockOAuth2Client: any;

  beforeEach(() => {
    // Mock OAuth2Client
    mockOAuth2Client = {
      setCredentials: vi.fn(),
      refreshAccessToken: vi.fn(),
    };

    // Mock Gmail API
    mockGmail = {
      users: {
        threads: {
          list: vi.fn(),
          get: vi.fn(),
        },
        messages: {
          get: vi.fn(),
          attachments: {
            get: vi.fn(),
          },
        },
        labels: {
          list: vi.fn(),
        },
      },
    };

    // Mock google.auth.OAuth2
    vi.mocked(google.auth.OAuth2).mockImplementation(() => mockOAuth2Client);

    // Mock google.gmail
    vi.mocked(google.gmail).mockReturnValue(mockGmail);

    gmailService = new GmailApiService('test-access-token', 'test-refresh-token');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize OAuth2Client with correct credentials', () => {
      expect(google.auth.OAuth2).toHaveBeenCalledWith(
        'test-google-client-id',
        'test-google-client-secret',
        'http://localhost:3000/api/auth/callback/google'
      );

      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
      });

      expect(google.gmail).toHaveBeenCalledWith({
        version: 'v1',
        auth: mockOAuth2Client,
      });
    });
  });

  describe('getAllThreads', () => {
    it('should fetch and return all threads with details', async () => {
      const mockThreadsList = {
        data: {
          threads: [
            { id: 'thread1' },
            { id: 'thread2' },
          ]
        }
      };

      const mockThreadDetails = [
        {
          id: 'thread1',
          historyId: 'hist1',
          snippet: 'Test snippet 1',
          messages: [{ id: 'msg1' }]
        },
        {
          id: 'thread2',
          historyId: 'hist2',
          snippet: 'Test snippet 2',
          messages: [{ id: 'msg2' }]
        }
      ];

      mockGmail.users.threads.list.mockResolvedValue(mockThreadsList);
      mockGmail.users.threads.get
        .mockResolvedValueOnce({ data: mockThreadDetails[0] })
        .mockResolvedValueOnce({ data: mockThreadDetails[1] });

      const result = await gmailService.getAllThreads(100);

      expect(mockGmail.users.threads.list).toHaveBeenCalledWith({
        userId: 'me',
        maxResults: 100,
        includeSpamTrash: false,
      });

      expect(result).toEqual(mockThreadDetails);
      expect(result).toHaveLength(2);
    });

    it('should handle empty threads list', async () => {
      mockGmail.users.threads.list.mockResolvedValue({ data: {} });

      const result = await gmailService.getAllThreads();

      expect(result).toEqual([]);
    });

    it('should throw error when API call fails', async () => {
      mockGmail.users.threads.list.mockRejectedValue(new Error('API Error'));

      await expect(gmailService.getAllThreads()).rejects.toThrow('Failed to fetch Gmail threads');
    });
  });

  describe('getThreadDetails', () => {
    it('should fetch and return thread details', async () => {
      const mockThreadData = {
        id: 'thread1',
        historyId: 'hist1',
        snippet: 'Test snippet',
        messages: [{ id: 'msg1' }]
      };

      mockGmail.users.threads.get.mockResolvedValue({ data: mockThreadData });

      const result = await gmailService.getThreadDetails('thread1');

      expect(mockGmail.users.threads.get).toHaveBeenCalledWith({
        userId: 'me',
        id: 'thread1',
        format: 'full',
      });

      expect(result).toEqual(mockThreadData);
    });

    it('should throw error when thread not found', async () => {
      mockGmail.users.threads.get.mockRejectedValue(new Error('Thread not found'));

      await expect(gmailService.getThreadDetails('invalid-thread')).rejects.toThrow('Failed to fetch thread invalid-thread');
    });
  });

  describe('getMessageDetails', () => {
    it('should fetch and return message details', async () => {
      const mockMessageData = {
        id: 'msg1',
        threadId: 'thread1',
        payload: { headers: [] }
      };

      mockGmail.users.messages.get.mockResolvedValue({ data: mockMessageData });

      const result = await gmailService.getMessageDetails('msg1');

      expect(mockGmail.users.messages.get).toHaveBeenCalledWith({
        userId: 'me',
        id: 'msg1',
        format: 'full',
      });

      expect(result).toEqual(mockMessageData);
    });

    it('should throw error when message not found', async () => {
      mockGmail.users.messages.get.mockRejectedValue(new Error('Message not found'));

      await expect(gmailService.getMessageDetails('invalid-msg')).rejects.toThrow('Failed to fetch message invalid-msg');
    });
  });

  describe('getAttachment', () => {
    it('should fetch and return attachment data', async () => {
      const mockAttachmentData = {
        data: {
          size: 1024,
          data: 'base64-encoded-data'
        }
      };

      mockGmail.users.messages.attachments.get.mockResolvedValue(mockAttachmentData);

      const result = await gmailService.getAttachment('msg1', 'att1');

      expect(mockGmail.users.messages.attachments.get).toHaveBeenCalledWith({
        userId: 'me',
        messageId: 'msg1',
        id: 'att1',
      });

      expect(result).toEqual({
        attachmentId: 'att1',
        filename: '',
        mimeType: '',
        size: 1024,
        data: 'base64-encoded-data'
      });
    });

    it('should handle missing attachment data', async () => {
      mockGmail.users.messages.attachments.get.mockResolvedValue({ data: {} });

      const result = await gmailService.getAttachment('msg1', 'att1');

      expect(result).toEqual({
        attachmentId: 'att1',
        filename: '',
        mimeType: '',
        size: 0,
        data: ''
      });
    });

    it('should throw error when attachment fetch fails', async () => {
      mockGmail.users.messages.attachments.get.mockRejectedValue(new Error('Attachment not found'));

      await expect(gmailService.getAttachment('msg1', 'invalid-att')).rejects.toThrow('Failed to fetch attachment invalid-att');
    });
  });

  describe('getLabels', () => {
    it('should fetch and return labels', async () => {
      const mockLabels = {
        data: {
          labels: [
            { id: 'INBOX', name: 'INBOX', type: 'system' },
            { id: 'custom1', name: 'Custom Label', type: 'user' }
          ]
        }
      };

      mockGmail.users.labels.list.mockResolvedValue(mockLabels);

      const result = await gmailService.getLabels();

      expect(mockGmail.users.labels.list).toHaveBeenCalledWith({
        userId: 'me',
      });

      expect(result).toEqual(mockLabels.data.labels);
    });

    it('should handle empty labels list', async () => {
      mockGmail.users.labels.list.mockResolvedValue({ data: {} });

      const result = await gmailService.getLabels();

      expect(result).toEqual([]);
    });

    it('should throw error when labels fetch fails', async () => {
      mockGmail.users.labels.list.mockRejectedValue(new Error('Labels fetch failed'));

      await expect(gmailService.getLabels()).rejects.toThrow('Failed to fetch Gmail labels');
    });
  });

  describe('extractHtmlBody', () => {
    it('should extract HTML body from text/html payload', () => {
      const htmlData = Buffer.from('<html><body>Test</body></html>').toString('base64');
      const payload = {
        partId: '0',
        mimeType: 'text/html',
        body: {
          size: htmlData.length,
          data: htmlData
        }
      };

      const result = gmailService.extractHtmlBody(payload);

      expect(result).toBe('<html><body>Test</body></html>');
    });

    it('should extract HTML body from multipart payload', () => {
      const htmlData = Buffer.from('<html><body>Test</body></html>').toString('base64');
      const payload = {
        partId: '0',
        mimeType: 'multipart/alternative',
        parts: [
          {
            partId: '0.0',
            mimeType: 'text/plain',
            body: { data: 'plain text' }
          },
          {
            partId: '0.1',
            mimeType: 'text/html',
            body: { data: htmlData, size: htmlData.length }
          }
        ]
      };

      const result = gmailService.extractHtmlBody(payload);

      expect(result).toBe('<html><body>Test</body></html>');
    });

    it('should return null when no HTML body found', () => {
      const payload = {
        partId: '0',
        mimeType: 'text/plain',
        body: { data: 'plain text' }
      };

      const result = gmailService.extractHtmlBody(payload);

      expect(result).toBeNull();
    });
  });

  describe('extractAttachments', () => {
    it('should extract attachments from payload', () => {
      const payload = {
        partId: '0',
        mimeType: 'multipart/mixed',
        parts: [
          {
            partId: '1',
            mimeType: 'text/plain',
            filename: 'test.txt',
            body: { attachmentId: 'att1', size: 100 }
          },
          {
            partId: '2',
            mimeType: 'image/png',
            filename: 'image.png',
            body: { attachmentId: 'att2', size: 2048 }
          }
        ]
      };

      const result = gmailService.extractAttachments(payload);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        filename: 'test.txt',
        mimeType: 'text/plain',
        body: { attachmentId: 'att1' }
      });
      expect(result[1]).toMatchObject({
        filename: 'image.png',
        mimeType: 'image/png',
        body: { attachmentId: 'att2' }
      });
    });

    it('should return empty array when no attachments found', () => {
      const payload = {
        partId: '0',
        mimeType: 'text/plain',
        body: { data: 'plain text' }
      };

      const result = gmailService.extractAttachments(payload);

      expect(result).toEqual([]);
    });
  });

  describe('getHeaderValue', () => {
    it('should find and return header value case-insensitively', () => {
      const headers = [
        { name: 'From', value: 'test@example.com' },
        { name: 'Subject', value: 'Test Subject' },
        { name: 'Content-Type', value: 'text/html' }
      ];

      expect(gmailService.getHeaderValue(headers, 'from')).toBe('test@example.com');
      expect(gmailService.getHeaderValue(headers, 'SUBJECT')).toBe('Test Subject');
      expect(gmailService.getHeaderValue(headers, 'content-type')).toBe('text/html');
    });

    it('should return null for non-existent header', () => {
      const headers = [
        { name: 'From', value: 'test@example.com' }
      ];

      expect(gmailService.getHeaderValue(headers, 'NonExistent')).toBeNull();
    });

    it('should handle empty headers array', () => {
      expect(gmailService.getHeaderValue([], 'Any')).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh and return new access token', async () => {
      const mockCredentials = {
        access_token: 'new-access-token'
      };

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: mockCredentials
      });

      const result = await gmailService.refreshAccessToken();

      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
      expect(result).toBe('new-access-token');
    });

    it('should throw error when token refresh fails', async () => {
      mockOAuth2Client.refreshAccessToken.mockRejectedValue(new Error('Token refresh failed'));

      await expect(gmailService.refreshAccessToken()).rejects.toThrow('Failed to refresh access token');
    });

    it('should handle empty credentials response', async () => {
      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: {}
      });

      const result = await gmailService.refreshAccessToken();

      expect(result).toBe('');
    });
  });
});