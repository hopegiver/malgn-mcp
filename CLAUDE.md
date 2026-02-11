이 프로젝트는 맑은프레임워크(malgnsoft) MCP 서버입니다.

## MCP 서버 정보

- 엔드포인트: `POST /mcp` (Streamable HTTP, JSON-RPC 2.0)
- 배포 URL: https://malgn-mcp.apiserver.kr/mcp
- 인증: 없음

## MCP 서버 등록

Claude Code settings에 아래와 같이 등록:

```json
{
  "mcpServers": {
    "malgn": {
      "url": "https://malgn-mcp.apiserver.kr/mcp"
    }
  }
}
```

## 제공 도구 (Tools)

- `get_context` - 작업에 필요한 규칙+패턴+클래스 한번에 조회 (가장 먼저 호출 권장)
- `validate_code` - JSP/HTML/DAO 코드 규칙 위반 검증
- `get_class` - 클래스 메소드/사용법 조회
- `get_rules` - 코딩 규칙 조회
- `get_pattern` - 코드 패턴 템플릿 조회
- `get_doc` - 문서 조회
- `search_docs` - 문서 검색
