import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { aiRouter } from "./routes/ai";
import { healthRouter } from "./routes/health";
import { youtubeRouter } from "./routes/youtube";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((v) => v.trim())
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.use("/api/health", healthRouter);
  app.use("/api/youtube", youtubeRouter);
  app.use("/api/ai", aiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
