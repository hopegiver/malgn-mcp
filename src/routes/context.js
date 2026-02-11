import { Hono } from 'hono';
import { ContextService } from '../services/contextService.js';

const context = new Hono();
const contextService = new ContextService();

// POST /context
context.post('/', async (c) => {
  const body = await c.req.json();

  if (!body.task) {
    return c.json({ error: 'task는 필수입니다.' }, 400);
  }

  const result = contextService.buildContext(body);
  return c.json(result);
});

export default context;
