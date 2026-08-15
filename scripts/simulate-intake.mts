/**
 * Sends one signed test message to /n8n/intake, the same way n8n will.
 *
 * Useful for checking the endpoint, or the review queue, without n8n actually
 * running: `npm run intake:simulate -- "Do you have batik frocks in size L?"`
 *
 * Reads N8N_WEBHOOK_SECRET from .env.local and posts to APP_URL, so it always
 * signs with the secret this server actually checks against.
 */
import { createHmac } from 'node:crypto';

import './load-env.mts';

const secret = process.env.N8N_WEBHOOK_SECRET;
if (!secret) throw new Error('N8N_WEBHOOK_SECRET is not set. Run `npm run doctor`.');

const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

const message = process.argv[2] ?? 'Do you have batik frocks in size L?';

const body = JSON.stringify({
  platform: 'whatsapp',
  phone: '55123456',
  name: 'Test Customer',
  message,
});

const timestamp = String(Date.now());
const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

const response = await fetch(`${appUrl}/n8n/intake`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-timestamp': timestamp,
    'x-signature': signature,
  },
  body,
});

console.log(response.status, await response.text());
