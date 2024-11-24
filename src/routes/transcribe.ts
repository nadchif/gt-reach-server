import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import { transcribePostHandler } from '../controller/transcribe';

const uploadDir = path.resolve('./uploads');
const upload = multer({ dest: uploadDir });

const transcribeRouter = express.Router();
const limit = rateLimit({
  windowMs: 3 * 60 * 1000, // 5 minutes
  max: 6, // limit each IP to 5 requests
  message: () => JSON.stringify({ message: 'RATE_EXCEEDED' }),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.get('x-forwarded-for') || '';
  },
});

transcribeRouter.post('/', limit, upload.single('file'), transcribePostHandler);

export default transcribeRouter;
