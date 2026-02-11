import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { errorHandler } from './middleware/errorHandler.js';

// Import routes
import classesRoutes from './routes/classes.js';
import docsRoutes from './routes/docs.js';
import rulesRoutes from './routes/rules.js';
import patternsRoutes from './routes/patterns.js';
import validateRoutes from './routes/validate.js';
import contextRoutes from './routes/context.js';
import promptRoutes from './routes/prompt.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// 선택적 API 토큰 인증
app.use('*', async (c, next) => {
  if (c.req.path === '/health' || c.req.path === '/' || c.req.path === '/prompt') {
    return await next();
  }

  const apiToken = c.env.API_TOKEN;
  if (apiToken) {
    const authHeader = c.req.header('Authorization');
    if (authHeader !== `Bearer ${apiToken}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }

  return await next();
});

// Routes
app.route('/classes', classesRoutes);
app.route('/docs', docsRoutes);
app.route('/rules', rulesRoutes);
app.route('/patterns', patternsRoutes);
app.route('/validate', validateRoutes);
app.route('/context', contextRoutes);
app.route('/prompt', promptRoutes);

// Root
app.get('/', (c) => {
  return c.json({
    service: '맑은프레임워크 MCP API',
    version: c.env.API_VERSION || '1.0.0',
    status: 'running',
    endpoints: [
      'GET /classes', 'GET /classes/:name',
      'POST /validate',
      'GET /rules', 'GET /rules/checklist',
      'GET /docs', 'GET /docs/:slug', 'POST /docs/search',
      'GET /patterns', 'GET /patterns/:type',
      'POST /context',
      'GET /prompt'
    ]
  });
});

// Health
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.onError(errorHandler);
app.notFound((c) => c.json({ error: 'Not Found', path: c.req.path }, 404));

export default app;
