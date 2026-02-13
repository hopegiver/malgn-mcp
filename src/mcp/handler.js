import { TOOL_DEFINITIONS, executeTool } from './tools.js';
import { formatToolResult } from './formatter.js';

const PROTOCOL_VERSION = '2025-03-26';
const SERVER_INFO = { name: 'malgn-mcp', version: '1.0.0' };

// 스키마에 정의되지 않은 파라미터 검출
function getUnknownParams(args, toolDef) {
  const validProps = Object.keys(toolDef.inputSchema.properties || {});
  return Object.keys(args).filter(k => !validProps.includes(k));
}

// JSON-RPC 응답 생성
function jsonrpc(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonrpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

// 메시지가 JSON-RPC request인지 판별 (method + id 존재)
function isRequest(msg) {
  return msg && typeof msg.method === 'string' && msg.id !== undefined && msg.id !== null;
}

// MCP 메시지 처리
function handleMessage(msg) {
  // notification/response (id 없음) → 응답 불필요
  if (!isRequest(msg)) {
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

      // 미지 파라미터 → 즉시 에러 반환
      const unknownParams = getUnknownParams(args || {}, tool);
      if (unknownParams.length > 0) {
        const validProps = Object.keys(tool.inputSchema.properties || {}).join(', ');
        return jsonrpcError(msg.id, -32602,
          `알 수 없는 파라미터: ${unknownParams.join(', ')}. 유효한 파라미터: ${validProps}`
        );
      }

      try {
        const result = executeTool(name, args || {});
        const text = formatToolResult(name, result);
        return jsonrpc(msg.id, {
          content: [{ type: 'text', text }]
        });
      } catch (e) {
        return jsonrpcError(msg.id, -32603, e.message);
      }
    }

    default:
      return jsonrpcError(msg.id, -32601, `method not found: ${msg.method}`);
  }
}

// POST /mcp - MCP Streamable HTTP 핸들러
export async function handleMcpPost(c) {
  const contentType = c.req.header('content-type') || '';

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

  // 배치 요청
  if (Array.isArray(body)) {
    const responses = body.map(handleMessage).filter(r => r !== null);
    if (responses.length === 0) return c.body(null, 202);
    return c.json(responses);
  }

  // 단일 메시지
  const response = handleMessage(body);
  if (response === null) return c.body(null, 202);
  return c.json(response);
}
