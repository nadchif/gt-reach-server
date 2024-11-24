import { Request, Response } from 'express';
import { logger } from '../util';
import { AssemblyAI } from 'assemblyai';
import { config } from '../config';

const client = new AssemblyAI({
  apiKey: config.ASSEMBLY_AI_KEY,
});

export const transcribePostHandler = (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  logger.log('transcribing...');
  client.transcripts
    .transcribe({
      audio: req.file.path,
      speaker_labels: true,
    })
    .then((response) => {
      logger.debug('Transcription response:', response);
      const text = response.utterances?.map((utterance) => `${utterance.speaker}: ${utterance.text}`).join('\n');
      res.status(200).send(text || '');
    })
    .catch((error) => {
      logger.error(error);
      res.status(500).json({ error: 'Transcription failed' });
    });
};
