import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleMcpPost } from './mcp/handler.js';

const app = new Hono();

// Middleware
app.use('*', cors());

// MCP 엔드포인트 (Streamable HTTP - spec 2025-03-26)
app.post('/mcp', handleMcpPost);
app.get('/mcp', (c) => c.body(null, 405));
app.delete('/mcp', (c) => c.body(null, 405));

// Root
app.get('/', (c) => {
  return c.json({
    service: '맑은프레임워크 MCP Server',
    version: c.env.API_VERSION || '1.0.0',
    status: 'running',
    mcp: 'POST /mcp',
    tools: ['get_context', 'validate_code', 'get_class', 'get_rules', 'get_pattern', 'get_doc', 'search_docs']
  });
});

// Health
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.notFound((c) => c.json({ error: 'Not Found', path: c.req.path }, 404));

export default app;
