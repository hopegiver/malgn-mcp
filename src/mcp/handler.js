import { TOOL_DEFINITIONS, executeTool } from './tools.js';
import { formatToolResult } from './formatter.js';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'malgn-mcp', version: '1.0.0' };

// 파라미터 alias 매핑 (LLM이 흔히 쓰는 변형 → 정규 파라미터)
const PARAM_ALIASES = {
  search_docs: { top_k: 'limit', max_results: 'limit', count: 'limit', n: 'limit' },
  get_class:   { class_name: 'name', className: 'name', filter: 'method_filter' },
  get_doc:     { document: 'slug', name: 'slug', id: 'slug' },
  get_pattern: { pattern: 'type', name: 'type' },
  get_rules:   { type: 'category' }
};

// alias를 정규 파라미터로 변환
function resolveAliases(toolName, args) {
  const aliases = PARAM_ALIASES[toolName];
  if (!aliases) return { ...args };

  const resolved = { ...args };
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (alias in resolved && !(canonical in resolved)) {
      resolved[canonical] = resolved[alias];
      delete resolved[alias];
    }
  }
  return resolved;
}

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

      // B: alias 변환 → 미지 파라미터 검출
      const resolvedArgs = resolveAliases(name, args || {});
      const unknownParams = getUnknownParams(resolvedArgs, tool);

      try {
        const result = executeTool(name, resolvedArgs);

        // A: 마크다운 텍스트로 포맷팅
        let text = formatToolResult(name, result);

        // B: 미지 파라미터 경고 삽입
        if (unknownParams.length > 0) {
          const warning = `[WARNING] 알 수 없는 파라미터 무시됨: ${unknownParams.join(', ')}\n유효한 파라미터: ${Object.keys(tool.inputSchema.properties || {}).join(', ')}\n\n`;
          text = warning + text;
        }

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
