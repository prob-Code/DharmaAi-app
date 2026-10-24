import { Router } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { requireFirebaseUser } from "../middleware/firebaseAuth";

// Mints VideoSDK join tokens. The API secret never leaves the server.
const VIDEOSDK_ROOMS_URL = "https://api.videosdk.live/v2/rooms";
const TOKEN_TTL = "120m";

const bodySchema = z.object({
  roomName: z.string().min(1).max(100)
});

// Same charset the app uses: lowercase letters and digits only
const cleanRoomName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30) || "dharmaroom";

// Everyone who taps the same circle must land in the same VideoSDK room.
const roomIds = new Map<string, string>();

function signToken(claims: { roomId?: string; participantId?: string; roles?: string[] }) {
  return jwt.sign(
    {
      apikey: env.VIDEOSDK_API_KEY,
      permissions: ["allow_join"],
      version: 2,
      ...claims
    },
    env.VIDEOSDK_SECRET as string,
    { algorithm: "HS256", expiresIn: TOKEN_TTL }
  );
}

async function getOrCreateRoomId(roomName: string): Promise<string> {
  const cached = roomIds.get(roomName);
  if (cached) return cached;

  const res = await fetch(VIDEOSDK_ROOMS_URL, {
    method: "POST",
    headers: {
      authorization: signToken({ roles: ["crawler"] }),
      "content-type": "application/json"
    },
    body: JSON.stringify({})
  });
  if (!res.ok) {
    throw new Error(`VideoSDK room creation failed (${res.status})`);
  }
  const data = (await res.json()) as { roomId?: string };
  if (!data.roomId) {
    throw new Error("VideoSDK returned no roomId");
  }
  roomIds.set(roomName, data.roomId);
  return data.roomId;
}

export const videoRouter = Router();
videoRouter.use(requireFirebaseUser);
videoRouter.use(rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
}));

videoRouter.post("/token", async (req, res, next) => {
  try {
    if (!env.VIDEOSDK_API_KEY || !env.VIDEOSDK_SECRET) {
      return res.status(503).json({ error: "Video calling is not configured" });
    }

    const parsed = bodySchema.parse(req.body);
    const roomName = cleanRoomName(parsed.roomName);
    const participantId = (req.firebaseUser?.uid || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
    if (!participantId) {
      return res.status(400).json({ error: "Invalid identity" });
    }

    const roomId = await getOrCreateRoomId(roomName);
    const token = signToken({ roomId, participantId, roles: ["rtc"] });

    res.json({ token, roomId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request body" });
    }
    next(error);
  }
});
