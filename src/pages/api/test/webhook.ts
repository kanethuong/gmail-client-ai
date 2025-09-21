import { type NextApiRequest, type NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Webhook Test] Request received:', {
    method: req.method,
    headers: req.headers,
    body: req.body,
    timestamp: new Date().toISOString(),
  });

  return res.status(200).json({
    success: true,
    message: "Webhook test successful",
    timestamp: new Date().toISOString(),
    method: req.method,
    userAgent: req.headers['user-agent'],
  });
}