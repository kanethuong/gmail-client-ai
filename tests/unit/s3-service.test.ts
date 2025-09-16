import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { S3Service } from '~/lib/s3-service';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3');
vi.mock('@aws-sdk/s3-request-presigner');

// Mock environment variables
vi.mock('~/env', () => ({
  env: {
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'test-access-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret-key',
    S3_BUCKET_NAME: 'test-bucket',
  }
}));

describe('S3Service', () => {
  let s3Service: S3Service;
  let mockS3Client: any;

  beforeEach(() => {
    mockS3Client = {
      send: vi.fn(),
    };

    vi.mocked(S3Client).mockImplementation(() => mockS3Client);
    s3Service = new S3Service();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize S3Client with correct configuration', () => {
      expect(S3Client).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      });
    });
  });

  describe('uploadEmailBody', () => {
    it('should upload email body HTML to S3 successfully', async () => {
      const htmlContent = '<html><body>Test email body</body></html>';
      const userId = 123;
      const messageId = 'msg123';

      mockS3Client.send.mockResolvedValue({});

      const result = await s3Service.uploadEmailBody(userId, messageId, htmlContent);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(PutObjectCommand)
      );

      // Verify the PutObjectCommand was created correctly
      const putObjectCommand = mockS3Client.send.mock.calls[0][0];
      expect(putObjectCommand.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'emails/123/bodies/msg123.html',
        Body: htmlContent,
        ContentType: 'text/html; charset=utf-8',
        Metadata: {
          userId: '123',
          messageId: 'msg123',
          type: 'email-body',
        },
      });

      expect(result).toEqual({
        key: 'emails/123/bodies/msg123.html',
        url: 'https://test-bucket.s3.us-east-1.amazonaws.com/emails/123/bodies/msg123.html',
        size: Buffer.byteLength(htmlContent, 'utf8'),
      });
    });

    it('should throw error when S3 upload fails', async () => {
      const htmlContent = '<html><body>Test</body></html>';
      const userId = 123;
      const messageId = 'msg123';

      mockS3Client.send.mockRejectedValue(new Error('S3 upload failed'));

      await expect(s3Service.uploadEmailBody(userId, messageId, htmlContent))
        .rejects.toThrow('Failed to upload email body for message msg123');
    });
  });

  describe('uploadAttachment', () => {
    it('should upload attachment to S3 successfully', async () => {
      const userId = 123;
      const messageId = 'msg123';
      const attachmentId = 'att123';
      const filename = 'test file.pdf';
      const mimeType = 'application/pdf';
      const data = Buffer.from('test data');

      mockS3Client.send.mockResolvedValue({});

      const result = await s3Service.uploadAttachment(
        userId, messageId, attachmentId, filename, mimeType, data
      );

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(PutObjectCommand)
      );

      const putObjectCommand = mockS3Client.send.mock.calls[0][0];
      expect(putObjectCommand.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'emails/123/attachments/msg123/att123/test_file.pdf',
        Body: data,
        ContentType: mimeType,
        ContentDisposition: 'attachment; filename=\"test_file.pdf\"',
        Metadata: {
          userId: '123',
          messageId: 'msg123',
          attachmentId: 'att123',
          originalFilename: filename,
          type: 'email-attachment',
        },
      });

      expect(result).toEqual({
        key: 'emails/123/attachments/msg123/att123/test_file.pdf',
        url: 'https://test-bucket.s3.us-east-1.amazonaws.com/emails/123/attachments/msg123/att123/test_file.pdf',
        size: data.length,
      });
    });

    it('should sanitize filename properly', async () => {
      const userId = 123;
      const messageId = 'msg123';
      const attachmentId = 'att123';
      const filename = 'test@#$%^&*()file!.pdf';
      const mimeType = 'application/pdf';
      const data = Buffer.from('test data');

      mockS3Client.send.mockResolvedValue({});

      await s3Service.uploadAttachment(
        userId, messageId, attachmentId, filename, mimeType, data
      );

      const putObjectCommand = mockS3Client.send.mock.calls[0][0];
      expect(putObjectCommand.input.Key).toBe('emails/123/attachments/msg123/att123/test_______file_.pdf');
    });

    it('should throw error when attachment upload fails', async () => {
      const userId = 123;
      const messageId = 'msg123';
      const attachmentId = 'att123';
      const filename = 'test.pdf';
      const mimeType = 'application/pdf';
      const data = Buffer.from('test data');

      mockS3Client.send.mockRejectedValue(new Error('S3 upload failed'));

      await expect(s3Service.uploadAttachment(
        userId, messageId, attachmentId, filename, mimeType, data
      )).rejects.toThrow('Failed to upload attachment att123');
    });
  });

  describe('getDownloadUrl', () => {
    it('should generate presigned URL successfully', async () => {
      const key = 'emails/123/bodies/msg123.html';
      const expectedUrl = 'https://presigned-url.example.com';

      vi.mocked(getSignedUrl).mockResolvedValue(expectedUrl);

      const result = await s3Service.getDownloadUrl(key, 1800);

      expect(getSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(GetObjectCommand),
        { expiresIn: 1800 }
      );

      const getObjectCommand = vi.mocked(getSignedUrl).mock.calls[0][1] as any;
      expect(getObjectCommand.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: key,
      });

      expect(result).toBe(expectedUrl);
    });

    it('should use default expiration time when not provided', async () => {
      const key = 'test-key';
      const expectedUrl = 'https://presigned-url.example.com';

      vi.mocked(getSignedUrl).mockResolvedValue(expectedUrl);

      await s3Service.getDownloadUrl(key);

      expect(getSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(GetObjectCommand),
        { expiresIn: 3600 }
      );
    });

    it('should throw error when URL generation fails', async () => {
      const key = 'test-key';

      vi.mocked(getSignedUrl).mockRejectedValue(new Error('URL generation failed'));

      await expect(s3Service.getDownloadUrl(key))
        .rejects.toThrow('Failed to generate download URL for test-key');
    });
  });

  describe('deleteFile', () => {
    it('should delete file from S3 successfully', async () => {
      const key = 'emails/123/bodies/msg123.html';

      mockS3Client.send.mockResolvedValue({});

      await s3Service.deleteFile(key);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(DeleteObjectCommand)
      );

      const deleteObjectCommand = mockS3Client.send.mock.calls[0][0];
      expect(deleteObjectCommand.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: key,
      });
    });

    it('should throw error when file deletion fails', async () => {
      const key = 'test-key';

      mockS3Client.send.mockRejectedValue(new Error('Delete failed'));

      await expect(s3Service.deleteFile(key))
        .rejects.toThrow('Failed to delete file test-key');
    });
  });

  describe('deleteUserFiles', () => {
    it('should log deletion operation for user files', async () => {
      const userId = 123;
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await s3Service.deleteUserFiles(userId);

      expect(consoleSpy).toHaveBeenCalledWith('Would delete all files with prefix: emails/123/');

      consoleSpy.mockRestore();
    });

    it('should throw error when deletion preparation fails', async () => {
      const userId = 123;

      // Mock console.log to throw an error to simulate failure
      vi.spyOn(console, 'log').mockImplementation(() => {
        throw new Error('Console error');
      });

      await expect(s3Service.deleteUserFiles(userId))
        .rejects.toThrow('Failed to delete files for user 123');
    });
  });

  describe('sanitizeFilename', () => {
    it('should sanitize special characters', () => {
      // Access private method through type assertion
      const service = s3Service as any;

      expect(service.sanitizeFilename('test@#$file.pdf')).toBe('test___file.pdf');
      expect(service.sanitizeFilename('file with spaces.txt')).toBe('file_with_spaces.txt');
      expect(service.sanitizeFilename('file____multiple____underscores.doc')).toBe('file_multiple_underscores.doc');
    });

    it('should truncate long filenames', () => {
      const service = s3Service as any;
      const longFilename = 'a'.repeat(300) + '.txt';

      const result = service.sanitizeFilename(longFilename);

      expect(result.length).toBeLessThanOrEqual(255);
    });

    it('should preserve valid characters', () => {
      const service = s3Service as any;
      const validFilename = 'valid-file_name.123.txt';

      expect(service.sanitizeFilename(validFilename)).toBe(validFilename);
    });
  });

  describe('generateEmailBodyKey', () => {
    it('should generate correct key for email body', () => {
      const key = s3Service.generateEmailBodyKey(123, 'msg456');
      expect(key).toBe('emails/123/bodies/msg456.html');
    });
  });

  describe('generateAttachmentKey', () => {
    it('should generate correct key for attachment', () => {
      const key = s3Service.generateAttachmentKey(123, 'msg456', 'att789', 'test file.pdf');
      expect(key).toBe('emails/123/attachments/msg456/att789/test_file.pdf');
    });

    it('should sanitize filename in generated key', () => {
      const key = s3Service.generateAttachmentKey(123, 'msg456', 'att789', 'test@#$file.pdf');
      expect(key).toBe('emails/123/attachments/msg456/att789/test___file.pdf');
    });
  });
});