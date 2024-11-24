import WebSocket from 'ws';

export type TLanguage = 'es' | 'tl' | 'fr' | 'sw';

export type TStreamer = {
  id: string;
  language: TLanguage;
  ws: WebSocket;
};

export enum EMessageType {
  CREATE = 'CREATE',
  CREATED = 'CREATED',
  JOIN = 'JOIN',
  LEAVE = 'LEAVE',
  MESSAGE = 'MESSAGE',
  JOINED = 'JOINED',
  ERROR = 'ERROR',
  PUB = 'PUB',
  STREAMER_JOINED = 'STREAMER_JOINED',
  STREAMER_LEFT = 'STREAMER_LEFT',
  BROADCAST_CLOSED = 'BROADCAST_CLOSED',
  TRANSLATING = 'TRANSLATING',
}
