import dotenv from 'dotenv';
dotenv.config();

const mandatoryEnvVars = [
  'ASSEMBLY_AI_API_KEY',
  'TRANSLATION_ENDPOINT',
  'TRANSLATION_ENDPOINT_LOCATION',
  'TRANSLATION_ENDPOINT_SUBSCRIPTION_KEY',
  'ALLOWED_ORIGIN',
];
for (const envVar of mandatoryEnvVars) {
  if (!process.env[envVar]) {
    // eslint-disable-next-line no-console
    console.error(`${envVar} is required`);
    process.exit(1);
  }
}

const ASSEMBLY_AI_KEY = process.env.ASSEMBLY_AI_API_KEY!;
const TRANSLATION_ENDPOINT = process.env.TRANSLATION_ENDPOINT!;
const TRANSLATION_ENDPOINT_LOCATION = process.env.TRANSLATION_ENDPOINT_LOCATION!;
const TRANSLATION_ENDPOINT_SUBSCRIPTION_KEY = process.env.TRANSLATION_ENDPOINT_SUBSCRIPTION_KEY!;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN!;

export const config = {
  ALLOWED_ORIGIN,
  ASSEMBLY_AI_KEY,
  TRANSLATION_ENDPOINT,
  TRANSLATION_ENDPOINT_LOCATION,
  TRANSLATION_ENDPOINT_SUBSCRIPTION_KEY,
  MAX_STREAMERS: 25, // FOR NOW: 25
  MAX_STREAMING_TIME: 10 * 60 * 1000, // FOR NOW: 15 minutes
  MAX_STREAMS: 100, // FOR NOW: 100
} as const;
