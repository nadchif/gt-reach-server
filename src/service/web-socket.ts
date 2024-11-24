import { createId } from '@paralleldrive/cuid2';
import { EMessageType } from '../type';
import WebSocket from 'ws';
import { Broadcast } from '../lib/broadcast';
import { getBroadcastCode, logger } from '../util';
import { supportedLanguageCodes } from '../constants';
import { config } from '../config';

export const initWebSocketService = (wss: WebSocket.Server) => {
  const broadcasts = new Map();
  const clients = new Map();
  const broadcasters = new Map();

  wss.on('connection', (ws) => {
    const clientId = createId();
    clients.set(clientId, ws);
    logger.log(`Client connected with ID: ${clientId}`);

    ws.on('message', (data, isBinary) => {
      logger.log(`Received message from client ${clientId}`);
      if (isBinary) {
        const broadcastCode = broadcasters.get(clientId);
        const broadcast = broadcasts.get(broadcastCode);
        if (broadcast) {
          broadcast.pub(data);
        }
        return;
      }

      try {
        const message = JSON.parse(data.toString());
        switch (message.type) {
          case EMessageType.CREATE:
            {
              if (broadcasters.has(clientId)) {
                const existingBroadcastCode = broadcasters.get(clientId);
                logger.log(`Client already has a broadcast ${existingBroadcastCode}`);
                ws.send(
                  JSON.stringify({
                    type: EMessageType.CREATED,
                    code: existingBroadcastCode,
                  })
                );
                return;
              }

              if (broadcasters.size >= config.MAX_STREAMS) {
                logger.log('Max streams reached');
                ws.send(
                  JSON.stringify({
                    type: EMessageType.ERROR,
                    message: 'MAX_STREAMS_REACHED',
                  })
                );
                return;
              }

              let broadcastCode;
              do {
                broadcastCode = getBroadcastCode();
              } while (broadcasts.has(broadcastCode));

              const broadcast = new Broadcast(ws, broadcastCode, clientId);
              broadcasts.set(broadcastCode, broadcast);
              broadcasters.set(clientId, broadcastCode);

              ws.send(JSON.stringify({ type: EMessageType.CREATED, code: broadcastCode }));
            }
            break;

          case EMessageType.JOIN:
            {
              const broadcast = broadcasts.get(message.code);
              if (broadcast) {
                if (broadcast.getBroadcasterId() === clientId) {
                  logger.log('Broadcaster cannot join');
                  return;
                }

                if (!supportedLanguageCodes.includes(message.language)) {
                  logger.log('Unsupported language');
                  ws.send(
                    JSON.stringify({
                      type: EMessageType.ERROR,
                      message: 'UNSUPPORTED_LANGUAGE',
                    })
                  );
                  return;
                }

                const streamer = { id: clientId, language: message.language, ws };
                broadcast.join(streamer);
              } else {
                logger.log('Broadcast not found');
                ws.send(
                  JSON.stringify({
                    type: EMessageType.ERROR,
                    message: 'BROADCAST_NOT_FOUND',
                  })
                );
              }
            }
            break;

          case EMessageType.LEAVE:
            {
              if (broadcasters.has(clientId)) {
                const broadcastCode = broadcasters.get(clientId);
                const broadcast = broadcasts.get(broadcastCode);
                if (broadcast) {
                  broadcast.close();
                  broadcasts.delete(broadcastCode);
                }
                broadcasters.delete(clientId);
                return;
              } else {
                const broadcast = broadcasts.get(message.code);
                if (broadcast) {
                  broadcast.leave(clientId);
                }
              }
            }
            break;

          case EMessageType.PUB:
            {
              const pubBroadcast = broadcasts.get(message.code);
              if (pubBroadcast) {
                pubBroadcast.pub(message.data);
              }
            }
            break;

          default:
            break;
        }
      } catch (e) {
        logger.warn(e);
      }
    });

    ws.on('close', () => {
      broadcasts.forEach((broadcast) => {
        broadcast.leave(clientId);
      });

      const broadcastCode = broadcasters.get(clientId);
      if (broadcastCode) {
        const broadcast = broadcasts.get(broadcastCode);
        if (broadcast) {
          broadcast.close();
          broadcasts.delete(broadcastCode);
        }
        broadcasters.delete(clientId);
      }
      clients.delete(clientId);
      logger.log(`Client disconnected with ID: ${clientId}`);
    });

    ws.on('error', (error) => {
      logger.error('Error:', error);
    });
  });
};
