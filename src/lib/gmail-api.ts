import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface GmailThread {
  id: string;
  historyId: string;
  snippet?: string;
  messages: GmailMessage[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: GmailMessagePayload;
  sizeEstimate: number;
}

export interface GmailMessagePayload {
  partId: string;
  mimeType: string;
  filename?: string;
  headers: GmailHeader[];
  body?: GmailBody;
  parts?: GmailMessagePayload[];
}

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailBody {
  attachmentId?: string;
  size: number;
  data?: string;
}

export interface GmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  data: string;
}

export class GmailApiService {
  private gmail: any;
  private oauth2Client: OAuth2Client;

  constructor(accessToken: string, refreshToken: string) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:3000/api/auth/callback/google'
    );

    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * Get all threads for the authenticated user
   */
  async getAllThreads(maxResults: number = 100): Promise<GmailThread[]> {
    try {
      const response = await this.gmail.users.threads.list({
        userId: 'me',
        maxResults,
        includeSpamTrash: false,
      });

      const threads = response.data.threads || [];
      const threadDetails = await Promise.all(
        threads.map((thread: any) => this.getThreadDetails(thread.id))
      );

      return threadDetails;
    } catch (error) {
      console.error('Error fetching threads:', error);
      throw new Error('Failed to fetch Gmail threads');
    }
  }

  /**
   * Get detailed information about a specific thread
   */
  async getThreadDetails(threadId: string): Promise<GmailThread> {
    try {
      const response = await this.gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full',
      });

      const thread = response.data;
      return {
        id: thread.id,
        historyId: thread.historyId,
        snippet: thread.snippet,
        messages: thread.messages || [],
      };
    } catch (error) {
      console.error(`Error fetching thread ${threadId}:`, error);
      throw new Error(`Failed to fetch thread ${threadId}`);
    }
  }

  /**
   * Get detailed information about a specific message
   */
  async getMessageDetails(messageId: string): Promise<GmailMessage> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching message ${messageId}:`, error);
      throw new Error(`Failed to fetch message ${messageId}`);
    }
  }

  /**
   * Get attachment data for a specific message and attachment
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<GmailAttachment> {
    try {
      const response = await this.gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: attachmentId,
      });

      return {
        attachmentId,
        filename: '', // Will be set from message payload
        mimeType: '', // Will be set from message payload
        size: response.data.size || 0,
        data: response.data.data || '',
      };
    } catch (error) {
      console.error(`Error fetching attachment ${attachmentId}:`, error);
      throw new Error(`Failed to fetch attachment ${attachmentId}`);
    }
  }

  /**
   * Get all labels for the authenticated user
   */
  async getLabels(): Promise<any[]> {
    try {
      const response = await this.gmail.users.labels.list({
        userId: 'me',
      });

      return response.data.labels || [];
    } catch (error) {
      console.error('Error fetching labels:', error);
      throw new Error('Failed to fetch Gmail labels');
    }
  }

  /**
   * Extract HTML body from message payload
   */
  extractHtmlBody(payload: GmailMessagePayload): string | null {
    if (payload.mimeType === 'text/html' && payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        const htmlBody = this.extractHtmlBody(part);
        if (htmlBody) return htmlBody;
      }
    }

    return null;
  }

  /**
   * Extract attachments from message payload
   */
  extractAttachments(payload: GmailMessagePayload): GmailMessagePayload[] {
    const attachments: GmailMessagePayload[] = [];

    if (payload.filename && payload.body?.attachmentId) {
      attachments.push(payload);
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        attachments.push(...this.extractAttachments(part));
      }
    }

    return attachments;
  }

  /**
   * Get header value from message headers
   */
  getHeaderValue(headers: GmailHeader[], name: string): string | null {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header?.value || null;
  }

  /**
   * Refresh access token if needed
   */
  async refreshAccessToken(): Promise<string> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      return credentials.access_token || '';
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh access token');
    }
  }
}
