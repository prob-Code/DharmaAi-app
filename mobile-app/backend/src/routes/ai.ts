import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { getChatCompletion } from "../services/aiService";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1)
      })
    )
    .min(1)
});

export const aiRouter = Router();

aiRouter.post("/chat", async (req, res, next) => {
  try {
    if (!env.GROQ_API_KEY) {
      return res.status(503).json({ error: "GROQ_API_KEY is not configured" });
    }

    const parsed = bodySchema.parse(req.body);

    const text = await getChatCompletion({
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL,
      messages: parsed.messages
    });

    res.json({ text });
  } catch (error) {
    next(error);
  }
});
