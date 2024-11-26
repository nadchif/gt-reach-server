import { AssemblyAI, RealtimeTranscript } from 'assemblyai';
import { EMessageType, TLanguage, TStreamer } from '../type';
import { config } from '../config';
import WebSocket from 'ws';
import { createId } from '@paralleldrive/cuid2';
import axios from 'axios';
import { logger } from '../util';

export class Broadcast {
  broadcastLanguage: string;
  streamers: TStreamer[] = [];
  id: string;
  broadcasterId: string;
  ws: WebSocket;
  transcriber;
  isTranscriberConnected = false;
  isConnecting = false;
  disconnectionTimeout: NodeJS.Timeout | null = null;
  lastTranscribedText = '';

  constructor(ws: WebSocket, id: string, broadcasterId: string) {
    this.broadcastLanguage = 'en'; // FOR NOW;
    logger.imp('Broadcast created with id:', id);
    this.streamers = [];
    this.id = id;
    this.broadcasterId = broadcasterId;
    this.ws = ws;

    this.transcriber = new AssemblyAI({
      apiKey: config.ASSEMBLY_AI_KEY,
    }).realtime.transcriber({
      sampleRate: 16_000,
      endUtteranceSilenceThreshold: config.SILENCE_THRESHOLD,
    });

    this.transcriber.on('open', ({ sessionId }) => {
      logger.log(`Session opened with ID: ${sessionId}`);
      this.disconnectionTimeout = setTimeout(() => {
        logger.log('streaming time exceeded');
        this.streamers.forEach((streamer) => {
          streamer.ws.send(
            JSON.stringify({
              type: EMessageType.BROADCAST_CLOSED,
              reason: 'MAX_STREAMING_TIME_EXCEEDED',
            })
          );
        }, config.MAX_STREAMING_TIME);
        this.ws.send(
          JSON.stringify({
            type: EMessageType.BROADCAST_CLOSED,
            reason: 'MAX_STREAMING_TIME_EXCEEDED',
          })
        );
        this.disconnectTranscriber();
      }, config.MAX_STREAMING_TIME);
    });

    this.transcriber.on('error', (error: Error) => {
      logger.error('Error:', error);
    });

    this.transcriber.on('close', (code: number, reason: string) => {
      logger.log(`Session closed with code: ${code}, reason: ${reason}`);
      this.isTranscriberConnected = false;
    });

    process.on('SIGINT', async () => {
      logger.log();
      logger.log('Closing real-time transcript connection');
      await this.disconnectTranscriber();
      process.exit();
    });
  }

  async join(streamer: TStreamer) {
    logger.log(`Streamer ${streamer.id} joined`);
    this.streamers.push(streamer);
    const newState = {
      streamerCount: this.streamers.length,
      languages: [...new Set(this.streamers.map((l) => l.language))],
    };
    if (this.streamers.length > config.MAX_STREAMERS) {
      streamer.ws.send(
        JSON.stringify({
          type: EMessageType.ERROR,
          message: 'MAX_STREAMERS_REACHED',
        })
      );
      return this.streamers;
    }

    streamer.ws.send(JSON.stringify({ type: EMessageType.JOINED, state: newState }));
    this.sendStateUpdate(EMessageType.STREAMER_JOINED);
    return this.streamers;
  }

  joinAudio(streamerId: string) {
    const streamer = this.streamers.find((l) => l.id === streamerId);
    if (!streamer) {
      return;
    }
    streamer.isAudioSub = true;
    logger.imp(`Streamer ${streamerId} joined audio`);
    return this.streamers;
  }

  leave(streamerId: string) {
    logger.log(`Streamer ${streamerId} left`);
    this.streamers = this.streamers.filter((l) => l.id !== streamerId);
    this.sendStateUpdate(EMessageType.STREAMER_LEFT);
    return this.streamers;
  }

  leaveAudio(streamerId: string) {
    logger.imp(`Streamer ${streamerId} left audio`);
    const streamer = this.streamers.find((l) => l.id === streamerId);
    if (!streamer) {
      return;
    }
    streamer.isAudioSub = false;
    return this.streamers;
  }

  async pub(data: Buffer) {
    try {
      if (!this.isTranscriberConnected) {
        await this.connectTranscriber();
      }
      logger.log('upload...');
      this.transcriber.sendAudio(data);
      this.streamers.forEach((streamer) => {
        if (streamer.isAudioSub) {
          streamer.ws.send(data);
        }
      });
    } catch (error) {
      logger.error('Error:', error);
    }
  }

  async close() {
    logger.imp(`Closed Broadcast ${this.id}`);
    // get final transcript
    this.streamers.forEach((streamer) => {
      streamer.ws.send(JSON.stringify({ type: EMessageType.BROADCAST_CLOSED }));
    });
    this.ws.send(JSON.stringify({ type: EMessageType.BROADCAST_CLOSED }));
    await this.disconnectTranscriber();
    this.streamers = [];
  }

  getId() {
    return this.id;
  }
  getBroadcasterId() {
    return this.broadcasterId;
  }

  private sendStateUpdate(type: EMessageType.STREAMER_JOINED | EMessageType.STREAMER_LEFT) {
    const newState = {
      type,
      state: {
        streamerCount: this.streamers.length,
        languages: [...new Set(this.streamers.map((l) => l.language))],
      },
    };
    const message = JSON.stringify(newState);
    this.ws.send(message);
    this.streamers.forEach((streamer) => {
      streamer.ws.send(message);
    });
  }

  private handleTranscript = (transcript: RealtimeTranscript) => {
    logger.log(`Received: "${transcript.text}", type: ${transcript.message_type}`);
    if (!transcript.text) {
      return;
    } else if (transcript.text === this.lastTranscribedText) {
      return;
    }
    this.lastTranscribedText = transcript.text;
    this.sendForTranslations(transcript.text, transcript.message_type === 'FinalTranscript');
  };

  private getSubscriberLanguages() {
    return [...new Set(this.streamers.map((l) => l.language))];
  }

  private async sendForTranslations(text: string, isFinal: boolean) {
    const params = new URLSearchParams();
    params.append('api-version', '3.0');
    params.append('from', this.broadcastLanguage);
    const languages = this.getSubscriberLanguages();
    if (languages.length === 0) {
      return {
        translations: [],
      };
    }
    for (const language of languages) {
      params.append('to', language);
    }
    try {
      logger.info(`Translate: "${text}"`);
      const res = await axios({
        baseURL: config.TRANSLATION_ENDPOINT,
        url: '/translate',
        method: 'post',
        headers: {
          'Ocp-Apim-Subscription-Key': config.TRANSLATION_ENDPOINT_SUBSCRIPTION_KEY,
          'Ocp-Apim-Subscription-Region': config.TRANSLATION_ENDPOINT_LOCATION,
          'Content-type': 'application/json',
          'X-ClientTraceId': createId(),
        },
        params: params,
        data: [
          {
            text,
          },
        ],
        responseType: 'json',
      });

      const translationsMap: Partial<Record<TLanguage, string>> = {};
      res.data[0]?.translations?.forEach((t: { to: TLanguage; text: string }) => {
        translationsMap[t.to] = t.text;
      });
      this.ws.send(
        JSON.stringify({
          type: EMessageType.PUB,
          data: { original: text, translation: text, isFinal },
        })
      );
      this.streamers.forEach((streamer) => {
        streamer.ws.send(
          JSON.stringify({
            type: EMessageType.PUB,
            data: {
              original: text,
              translation: translationsMap[streamer.language],
              isFinal,
            },
          })
        );
      });
    } catch (e) {
      logger.error(e);
      return {
        translations: [],
      };
    }
  }

  private async connectTranscriber() {
    if (this.isConnecting) {
      return;
    }
    this.isConnecting = true;
    logger.log('Connecting transcriber');
    this.transcriber.on('transcript', this.handleTranscript);
    await this.transcriber.connect();
    this.isTranscriberConnected = true;
    logger.log('Transcriber connected');
    this.isConnecting = false;
  }
  private async disconnectTranscriber() {
    if (this.disconnectionTimeout) {
      clearTimeout(this.disconnectionTimeout);
    }
    await this.transcriber.close();
    logger.log('Transcriber disconnected');
    this.isTranscriberConnected = false;
  }
}
