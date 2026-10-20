import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env";

const bodySchema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "ai"]), content: z.string().min(1).max(10000) })).min(1).max(200)
});

export const stressRouter = Router();
stressRouter.use(rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.get("x-user-id") || req.ip || "anonymous"
}));

stressRouter.post("/analyze", async (req, res, next) => {
  try {
    if (!env.STRESS_API_URL || !env.STRESS_API_KEY) {
      return res.status(503).json({ error: "Stress analysis is not configured" });
    }

    const parsed = bodySchema.parse(req.body);
    const response = await fetch(`${env.STRESS_API_URL.replace(/\/$/, "")}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": env.STRESS_API_KEY },
      body: JSON.stringify(parsed)
    });

    const text = await response.text();
    res.status(response.status).type("application/json").send(text);
  } catch (error) {
    next(error);
  }
});
