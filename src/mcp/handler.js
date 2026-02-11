import { TOOL_DEFINITIONS, executeTool } from './tools.js';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'malgn-mcp', version: '1.0.0' };

// JSON-RPC 응답 생성
function jsonrpc(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonrpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

// MCP 메시지 처리
function handleMessage(msg) {
  // notification (id 없음) → 응답 불필요
  if (msg.id === undefined || msg.id === null) {
    return null;
  }

  switch (msg.method) {
    case 'initialize':
      return jsonrpc(msg.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO
      });

    case 'ping':
      return jsonrpc(msg.id, {});

    case 'tools/list':
      return jsonrpc(msg.id, { tools: TOOL_DEFINITIONS });

    case 'tools/call': {
      const { name, arguments: args } = msg.params || {};
      if (!name) {
        return jsonrpcError(msg.id, -32602, 'tool name is required');
      }
      const tool = TOOL_DEFINITIONS.find(t => t.name === name);
      if (!tool) {
        return jsonrpcError(msg.id, -32602, `unknown tool: ${name}`);
      }
      try {
        const result = executeTool(name, args || {});
        return jsonrpc(msg.id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        });
      } catch (e) {
        return jsonrpcError(msg.id, -32603, e.message);
      }
    }

    default:
      return jsonrpcError(msg.id, -32601, `method not found: ${msg.method}`);
  }
}

// Hono 라우트 핸들러
export async function handleMcpRequest(c) {
  const contentType = c.req.header('content-type') || '';

  // POST만 처리
  if (c.req.method !== 'POST') {
    return c.json(
      { jsonrpc: '2.0', error: { code: -32600, message: 'POST required' } },
      405
    );
  }

  if (!contentType.includes('application/json')) {
    return c.json(
      { jsonrpc: '2.0', error: { code: -32700, message: 'Content-Type must be application/json' } },
      400
    );
  }

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' } },
      400
    );
  }

  // 배치 요청 처리
  if (Array.isArray(body)) {
    const responses = body.map(handleMessage).filter(r => r !== null);
    if (responses.length === 0) return c.body(null, 202);
    return c.json(responses);
  }

  // 단일 요청 처리
  const response = handleMessage(body);
  if (response === null) return c.body(null, 202);
  return c.json(response);
}
