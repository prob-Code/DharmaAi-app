import { createServer } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { createSocketServer } from "./realtime/socketServer";

const app = createApp();
const httpServer = createServer(app);
createSocketServer(httpServer, env.SOCKET_CORS_ORIGIN || env.CORS_ORIGIN);

httpServer.listen(env.PORT, () => {
  console.log(`Dharma backend running on http://localhost:${env.PORT}`);
  console.log(`Realtime websocket enabled on ws://localhost:${env.PORT}`);
});
