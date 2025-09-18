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

export interface SendEmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  threadId?: string;
  replyToMessageId?: string;
  references?: string;
  inReplyTo?: string;
}

export interface SendEmailResponse {
  id: string;
  threadId: string;
  labelIds: string[];
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
   * Send a new email or reply to an existing thread
   */
  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    try {
      // Build headers
      const headers: string[] = [
        `To: ${request.to.join(', ')}`,
        `Subject: ${request.subject}`,
      ];

      if (request.cc && request.cc.length > 0) {
        headers.push(`Cc: ${request.cc.join(', ')}`);
      }
      if (request.bcc && request.bcc.length > 0) {
        headers.push(`Bcc: ${request.bcc.join(', ')}`);
      }
      if (request.inReplyTo) {
        headers.push(`In-Reply-To: ${request.inReplyTo}`);
      }
      if (request.references) {
        headers.push(`References: ${request.references}`);
      }

      // Add MIME headers
      headers.push('MIME-Version: 1.0');
      if (request.isHtml) {
        headers.push('Content-Type: text/html; charset=utf-8');
      } else {
        headers.push('Content-Type: text/plain; charset=utf-8');
      }

      // Build the complete message with proper line breaks
      const fullMessage = headers.join('\r\n') + '\r\n\r\n' + request.body;

      // Debug logging
      console.log('Full message being sent:', fullMessage);
      console.log('Request body:', request.body);

      // Encode for Gmail API (URL-safe base64)
      const encodedMessage = Buffer.from(fullMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const requestBody: any = {
        raw: encodedMessage,
      };

      if (request.threadId) {
        requestBody.threadId = request.threadId;
      }

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody,
      });

      return {
        id: response.data.id,
        threadId: response.data.threadId,
        labelIds: response.data.labelIds || [],
      };
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Reply to a specific message in a thread
   */
  async replyToMessage(messageId: string, replyBody: string, replyAll: boolean = false): Promise<SendEmailResponse> {
    try {
      // Get the original message to extract threading information
      const originalMessage = await this.getMessageDetails(messageId);
      const headers = originalMessage.payload.headers;

      const fromHeader = this.getHeaderValue(headers, 'From');
      const toHeader = this.getHeaderValue(headers, 'To');
      const ccHeader = this.getHeaderValue(headers, 'Cc');
      const subjectHeader = this.getHeaderValue(headers, 'Subject');
      const messageIdHeader = this.getHeaderValue(headers, 'Message-ID');
      const referencesHeader = this.getHeaderValue(headers, 'References');

      // Parse email addresses
      const originalFrom = this.parseEmailAddress(fromHeader || '');
      const originalTo = this.parseEmailAddresses(toHeader || '');
      const originalCc = this.parseEmailAddresses(ccHeader || '');

      // Build reply headers
      const replyTo = [originalFrom].filter(Boolean);
      const replyCc = replyAll ? originalCc.filter(email => email !== originalFrom) : [];

      // Build subject with Re: prefix if not already present
      const replySubject = subjectHeader?.startsWith('Re: ') ? subjectHeader : `Re: ${subjectHeader}`;

      // Build references chain
      const newReferences = referencesHeader
        ? `${referencesHeader} ${messageIdHeader}`
        : messageIdHeader || '';

      return await this.sendEmail({
        to: replyTo,
        cc: replyCc,
        subject: replySubject,
        body: replyBody,
        isHtml: true,
        threadId: originalMessage.threadId,
        replyToMessageId: messageId,
        inReplyTo: messageIdHeader || '',
        references: newReferences,
      });
    } catch (error) {
      console.error('Error replying to message:', error);
      throw new Error('Failed to reply to message');
    }
  }

  /**
   * Forward a message
   */
  async forwardMessage(messageId: string, to: string[], cc: string[] = [], forwardBody: string = ''): Promise<SendEmailResponse> {
    try {
      // Get the original message
      const originalMessage = await this.getMessageDetails(messageId);
      const headers = originalMessage.payload.headers;

      const fromHeader = this.getHeaderValue(headers, 'From');
      const toHeader = this.getHeaderValue(headers, 'To');
      const subjectHeader = this.getHeaderValue(headers, 'Subject');
      const dateHeader = this.getHeaderValue(headers, 'Date');

      // Build forward subject
      const forwardSubject = subjectHeader?.startsWith('Fwd: ') ? subjectHeader : `Fwd: ${subjectHeader}`;

      // Get original message body
      const originalBody = this.extractHtmlBody(originalMessage.payload) || originalMessage.snippet;

      // Build forward body with original message
      const fullForwardBody = `
        ${forwardBody}

        ---------- Forwarded message ----------
        From: ${fromHeader}
        Date: ${dateHeader}
        Subject: ${subjectHeader}
        To: ${toHeader}

        ${originalBody}
      `;

      return await this.sendEmail({
        to,
        cc,
        subject: forwardSubject,
        body: fullForwardBody,
        isHtml: true,
      });
    } catch (error) {
      console.error('Error forwarding message:', error);
      throw new Error('Failed to forward message');
    }
  }

  /**
   * Parse a single email address from header value
   */
  private parseEmailAddress(headerValue: string): string {
    const emailMatch = headerValue.match(/<(.+?)>|([^\s<>]+@[^\s<>]+)/);
    return emailMatch ? (emailMatch[1] || emailMatch[2] || '') : '';
  }

  /**
   * Parse multiple email addresses from header value
   */
  private parseEmailAddresses(headerValue: string): string[] {
    if (!headerValue) return [];

    const emails: string[] = [];
    const parts = headerValue.split(',');

    for (const part of parts) {
      const email = this.parseEmailAddress(part.trim());
      if (email) emails.push(email);
    }

    return emails;
  }

  /**
   * Encode text as quoted-printable for email content
   */
  private encodeQuotedPrintable(text: string): string {
    // For simplicity, we'll just return the text as-is for now
    // Gmail API can handle UTF-8 text directly in most cases
    return text;
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
