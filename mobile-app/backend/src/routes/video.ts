import { Router } from "express";
import rateLimit from "express-rate-limit";
import { RtcRole, RtcTokenBuilder } from "agora-token";
import { z } from "zod";
import { env } from "../config/env";
import { requireFirebaseUser } from "../middleware/firebaseAuth";

// Mints short-lived Agora join tokens. The App Certificate never leaves the server.
const TOKEN_TTL_SECONDS = 2 * 60 * 60;

const bodySchema = z.object({
  roomName: z.string().min(1).max(100)
});

// "Dharma Circle!" -> "dharmacircle": keep channel names to a safe charset
const cleanChannel = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64);

export const videoRouter = Router();
videoRouter.use(requireFirebaseUser);
videoRouter.use(rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
}));

videoRouter.post("/token", (req, res, next) => {
  try {
    if (!env.AGORA_APP_ID || !env.AGORA_APP_CERTIFICATE) {
      return res.status(503).json({ error: "Video calling is not configured" });
    }

    const parsed = bodySchema.parse(req.body);
    const channelName = cleanChannel(parsed.roomName);
    const userAccount = req.firebaseUser?.uid || "";
    if (!channelName || !userAccount) {
      return res.status(400).json({ error: "Invalid roomName or identity" });
    }

    const expireAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      env.AGORA_APP_ID,
      env.AGORA_APP_CERTIFICATE,
      channelName,
      userAccount,
      RtcRole.PUBLISHER,
      expireAt,
      expireAt
    );

    res.json({
      token,
      appId: env.AGORA_APP_ID,
      channelName,
      userAccount,
      expiresAt: expireAt
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request body" });
    }
    next(error);
  }
});
