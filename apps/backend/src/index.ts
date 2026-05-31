import { Hono } from 'hono';

const app = new Hono();

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'sava-backend',
    timestamp: new Date().toISOString(),
  }),
);

export default app;
