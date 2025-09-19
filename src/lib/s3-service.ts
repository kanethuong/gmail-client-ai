import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '~/env';

export interface S3UploadResult {
  key: string;
  url: string;
  size: number;
}

export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
    this.bucketName = env.S3_BUCKET_NAME;
  }

  /**
   * Upload email body HTML to S3
   */
  async uploadEmailBody(
    userId: number,
    messageId: string,
    htmlContent: string
  ): Promise<S3UploadResult> {
    const key = `emails/${userId}/bodies/${messageId}.html`;
    
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: htmlContent,
        ContentType: 'text/html; charset=utf-8',
        Metadata: {
          userId: userId.toString(),
          messageId,
          type: 'email-body',
        },
      });

      await this.s3Client.send(command);

      return {
        key,
        url: `https://${this.bucketName}.s3.${env.AWS_REGION}.amazonaws.com/${key}`,
        size: Buffer.byteLength(htmlContent, 'utf8'),
      };
    } catch (error) {
      console.error(`Error uploading email body for message ${messageId}:`, error);
      throw new Error(`Failed to upload email body for message ${messageId}`);
    }
  }

  /**
   * Upload email attachment to S3
   */
  async uploadAttachment(
    userId: number,
    messageId: string,
    attachmentId: string,
    filename: string,
    mimeType: string,
    data: Buffer
  ): Promise<S3UploadResult> {
    const sanitizedFilename = this.sanitizeFilename(filename);
    const key = `emails/${userId}/attachments/${messageId}/${attachmentId}/${sanitizedFilename}`;
    
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: data,
        ContentType: mimeType,
        ContentDisposition: `attachment; filename="${sanitizedFilename}"`,
        Metadata: {
          userId: userId.toString(),
          messageId,
          attachmentId,
          originalFilename: filename,
          type: 'email-attachment',
        },
      });

      await this.s3Client.send(command);

      return {
        key,
        url: `https://${this.bucketName}.s3.${env.AWS_REGION}.amazonaws.com/${key}`,
        size: data.length,
      };
    } catch (error) {
      console.error(`Error uploading attachment ${attachmentId}:`, error);
      throw new Error(`Failed to upload attachment ${attachmentId}`);
    }
  }

  /**
   * Get object content from S3
   */
  async getObject(key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('Empty response body');
      }

      // Convert the stream to string
      const chunks: Buffer[] = [];
      const stream = response.Body as any;

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks).toString('utf-8');
    } catch (error) {
      console.error(`Error getting object ${key}:`, error);
      throw new Error(`Failed to get object ${key}`);
    }
  }

  /**
   * Get a presigned URL for downloading a file
   */
  async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error(`Error generating download URL for ${key}:`, error);
      throw new Error(`Failed to generate download URL for ${key}`);
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error(`Error deleting file ${key}:`, error);
      throw new Error(`Failed to delete file ${key}`);
    }
  }

  /**
   * Delete all files for a specific user
   */
  async deleteUserFiles(userId: number): Promise<void> {
    try {
      // Note: This is a simplified implementation
      // In production, you might want to use S3's batch delete or list objects first
      const prefix = `emails/${userId}/`;
      
      // For now, we'll just log this operation
      // A full implementation would require listing objects and deleting them in batches
      console.log(`Would delete all files with prefix: ${prefix}`);
    } catch (error) {
      console.error(`Error deleting files for user ${userId}:`, error);
      throw new Error(`Failed to delete files for user ${userId}`);
    }
  }

  /**
   * Sanitize filename for S3 storage
   */
  private sanitizeFilename(filename: string): string {
    // Remove or replace characters that might cause issues in S3 keys
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 255); // S3 key length limit
  }

  /**
   * Generate a unique key for email body
   */
  generateEmailBodyKey(userId: number, messageId: string): string {
    return `emails/${userId}/bodies/${messageId}.html`;
  }

  /**
   * Generate a unique key for attachment
   */
  generateAttachmentKey(
    userId: number,
    messageId: string,
    attachmentId: string,
    filename: string
  ): string {
    const sanitizedFilename = this.sanitizeFilename(filename);
    return `emails/${userId}/attachments/${messageId}/${attachmentId}/${sanitizedFilename}`;
  }
}
