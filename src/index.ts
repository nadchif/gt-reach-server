import express from 'express';

import http from 'http';
import WebSocket from 'ws';
import cors from 'cors';
import { logger } from './util';
import { config } from './config';
import transcribeRouter from './routes/transcribe';
import { initWebSocketService } from './service/web-socket';

const PORT = process.env.PORT || 4000;

const app = express();
app.use(express.json());
app.use(cors());
app.set('trust proxy', true);
app.set('port', PORT);
app.use('/transcribe', transcribeRouter);
/**
 * This endpoint is used to check if the API is ready.
 */
app.get('/starter.css', (req, res) => {
  res.setHeader('Content-Type', 'text/css');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send('/* API is ready and started */');
});

const server = http.createServer(app);
const wss = new WebSocket.Server({
  server,
  verifyClient: (info, callback) => {
    const origin = info.origin;
    if (origin && config.ALLOWED_ORIGIN.some((allowedOrigin) => origin.startsWith(allowedOrigin))) {
      callback(true);
    } else {
      logger.warn(`Origin not allowed: ${origin}`);
      callback(false, 403, 'ORIGIN_NOT_ALLOWED');
    }
  },
});

initWebSocketService(wss);

server.listen(PORT, () => {
  logger.log(`Server running on port ${PORT}`);
});
