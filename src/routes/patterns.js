import { Hono } from 'hono';
import { DataService } from '../services/dataService.js';

const patterns = new Hono();
const dataService = new DataService();

// GET /patterns
patterns.get('/', (c) => {
  const index = dataService.getPatternIndex();
  return c.json(index);
});

// GET /patterns/:type
patterns.get('/:type', (c) => {
  const type = c.req.param('type');
  const pattern = dataService.getPattern(type);

  if (!pattern) {
    return c.json({ error: `패턴 '${type}'를 찾을 수 없습니다.` }, 404);
  }

  return c.json(pattern);
});

export default patterns;
