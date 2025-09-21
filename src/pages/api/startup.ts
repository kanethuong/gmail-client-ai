import { type NextApiRequest, type NextApiResponse } from "next";
import { ServerStartup } from "~/lib/server-startup";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await ServerStartup.initialize();

    return res.status(200).json({
      message: "Server startup completed",
      initialized: ServerStartup.isInitialized(),
    });
  } catch (error) {
    console.error("Server startup failed:", error);

    return res.status(500).json({
      error: "Server startup failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}