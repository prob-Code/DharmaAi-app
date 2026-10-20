import { createServer } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { createSocketServer } from "./realtime/socketServer";

const app = createApp();
const httpServer = createServer(app);
createSocketServer(httpServer, env.SOCKET_CORS_ORIGIN || env.CORS_ORIGIN);

httpServer.listen(env.PORT, "0.0.0.0", () => {
  console.log(`Dharma backend running on port ${env.PORT}`);
  console.log(`Realtime websocket enabled on port ${env.PORT}`);
});
