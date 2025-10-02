import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '~/env.js';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

export interface ThreadContext {
  messages: Array<{
    from: string;
    to: string;
    subject: string;
    snippet: string;
    date: Date | string;
  }>;
}

export async function generateReplyDraft(threadContext: ThreadContext): Promise<string> {
  try {
    const messageHistory = threadContext.messages
      .slice(-5)
      .map(msg => `From: ${msg.from}\nTo: ${msg.to}\nDate: ${new Date(msg.date).toISOString()}\nMessage: ${msg.snippet}`)
      .join('\n\n---\n\n');

    const prompt = `You are helping to draft a professional email reply. Based on the following email thread, generate a concise and appropriate reply. Keep it professional and brief.

Email Thread:
${messageHistory}

Please generate a professional reply that:
- Acknowledges the previous message(s)
- Is appropriate for the context
- Is concise and professional
- Does not include subject line or email headers
- Ends with an appropriate closing

Reply:`;

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedReply = response.text().trim();

    if (!generatedReply) {
      throw new Error('No reply generated');
    }

    return generatedReply;
  } catch (error) {
    console.error('Failed to generate AI reply:', error);

    return `Thank you for your message. I'll review the details and get back to you shortly.

Best regards,`;
  }
}