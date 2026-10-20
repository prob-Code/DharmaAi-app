import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AccessToken } from "livekit-server-sdk";
import { z } from "zod";
import { env } from "../config/env";

// Mints short-lived LiveKit join tokens. The API secret never leaves the server.
const bodySchema = z.object({
  roomName: z.string().min(1).max(100),
  identity: z.string().min(1).max(100),
  name: z.string().max(60).optional()
});

// "Dharma Circle!" -> "dharmacircle": keep room/identity ids to a safe charset
const clean = (value: string, max: number) =>
  value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, max);

export const livekitRouter = Router();
livekitRouter.use(rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
}));

livekitRouter.post("/token", async (req, res, next) => {
  try {
    if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
      return res.status(503).json({ error: "Video calling is not configured" });
    }

    const parsed = bodySchema.parse(req.body);
    const roomName = clean(parsed.roomName, 64);
    const identity = clean(parsed.identity, 64);
    if (!roomName || !identity) {
      return res.status(400).json({ error: "Invalid roomName or identity" });
    }

    const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
      identity,
      name: parsed.name?.trim() || identity,
      ttl: "2h"
    });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

    res.json({ token: await at.toJwt(), url: env.LIVEKIT_URL, roomName });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request body" });
    }
    next(error);
  }
});
