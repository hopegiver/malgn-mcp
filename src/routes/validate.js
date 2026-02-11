import { Hono } from 'hono';
import { ValidateService } from '../services/validateService.js';

const validate = new Hono();

// POST /validate
validate.post('/', async (c) => {
  const body = await c.req.json();

  if (!body.code || !body.file_type) {
    return c.json({ error: 'code와 file_type은 필수입니다.' }, 400);
  }

  const validateService = new ValidateService();
  const result = validateService.validate(body.code, body.file_type, body.strict);

  return c.json(result);
});

export default validate;
