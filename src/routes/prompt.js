import { Hono } from 'hono';
import { DataService } from '../services/dataService.js';

const prompt = new Hono();
const dataService = new DataService();

// GET /prompt
prompt.get('/', (c) => {
  const patternIndex = dataService.getPatternIndex();
  const baseUrl = c.req.url.replace(/\/prompt.*$/, '');

  const lines = [];

  lines.push('# 맑은프레임워크 MCP API');
  lines.push('');
  lines.push('이 프로젝트는 맑은프레임워크(malgnsoft)를 사용합니다.');
  lines.push('코딩 시 아래 API를 호출하여 규칙, 클래스 정보, 코드 패턴을 조회하세요.');
  lines.push('');
  lines.push(`Base URL: ${baseUrl}`);
  lines.push('');

  // === 추천 워크플로우 ===
  lines.push('## 추천 워크플로우');
  lines.push('');
  lines.push('1. 작업 시작 시 `POST /context`로 필요한 규칙+패턴+클래스를 한번에 조회');
  lines.push('2. 특정 클래스의 메소드가 필요하면 `GET /classes/{클래스명}`으로 상세 조회');
  lines.push('3. 코드 작성 후 `POST /validate`로 규칙 위반 검증');
  lines.push('');

  // --- POST /context ---
  lines.push('## POST /context');
  lines.push('작업에 필요한 규칙+패턴+클래스를 한번에 조회. **가장 먼저 호출 권장.**');
  lines.push('');
  lines.push('요청:');
  lines.push('```json');
  lines.push('{');
  lines.push('  "task": "작업 설명 (필수)",');
  lines.push('  "features": ["list","insert","modify","delete","view","search","paging","ajax","restapi","upload","auth"],');
  lines.push('  "table_name": "tb_board",');
  lines.push('  "include_class_info": ["DataObject"],');
  lines.push('  "include_patterns": true,');
  lines.push('  "include_rules": true');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('응답:');
  lines.push('```json');
  lines.push('{');
  lines.push('  "task": "게시판 목록 만들기",');
  lines.push('  "context": {');
  lines.push('    "rules": { "critical": ["규칙1",...], "relevant": ["규칙2",...] },');
  lines.push('    "patterns": { "jsp-list": { "jsp_template": "...", "html_template": "..." } },');
  lines.push('    "class_info": { "ListManager": { "description": "...", "key_methods": ["..."] } },');
  lines.push('    "checklist": ["JSP 시작: <%@ page ...%>", ...]');
  lines.push('  }');
  lines.push('}');
  lines.push('```');
  lines.push('');

  // --- GET /classes ---
  lines.push('## GET /classes');
  lines.push('클래스 목록 조회. `?category=core|data|web|util|security` 로 필터 가능.');
  lines.push('');
  lines.push('응답:');
  lines.push('```json');
  lines.push('{');
  lines.push('  "total": 36,');
  lines.push('  "categories": { "core": ["Malgn","Form",...], "data": [...], ... },');
  lines.push('  "classes": [');
  lines.push('    { "name": "Malgn", "category": "core", "description": "...", "variable_name": "m", "method_count": 45 }');
  lines.push('  ]');
  lines.push('}');
  lines.push('```');
  lines.push('');

  // --- GET /classes/:name ---
  lines.push('## GET /classes/:name');
  lines.push('클래스 상세 조회. `?method=검색어` 로 메소드 필터 가능.');
  lines.push('');
  lines.push('응답:');
  lines.push('```json');
  lines.push('{');
  lines.push('  "name": "Malgn", "fullClassName": "malgnsoft.util.Malgn",');
  lines.push('  "description": "...", "variable_name": "m",');
  lines.push('  "methods": [');
  lines.push('    { "name": "rs", "signature": "String rs(String name)", "description": "...",');
  lines.push('      "returnType": "String", "parameters": [{ "name": "name", "type": "String" }] }');
  lines.push('  ]');
  lines.push('}');
  lines.push('```');
  lines.push('');

  // --- GET /rules ---
  lines.push('## GET /rules');
  lines.push('코딩 규칙 조회. `?category=naming|structure|template|parameter|data|postback|message|ajax|security|style`');
  lines.push('');
  lines.push('응답:');
  lines.push('```json');
  lines.push('{');
  lines.push('  "total": 35,');
  lines.push('  "rules": [');
  lines.push('    { "id": "naming-dao", "category": "naming", "severity": "error|warning|info",');
  lines.push('      "title": "...", "rule": "...", "correct": "...", "incorrect": "..." }');
  lines.push('  ]');
  lines.push('}');
  lines.push('```');
  lines.push('');

  // --- GET /rules/checklist ---
  lines.push('## GET /rules/checklist');
  lines.push('코드 리뷰용 체크리스트.');
  lines.push('');
  lines.push('응답:');
  lines.push('```json');
  lines.push('{');
  lines.push('  "sections": [{ "title": "필수 규칙", "items": [{ "id": "chk-naming", "text": "...", "severity": "error" }] }]');
  lines.push('}');
  lines.push('```');
  lines.push('');

  // --- GET /patterns ---
  lines.push('## GET /patterns');
  lines.push('코드 패턴 목록.');
  lines.push('');
  const patternTypes = [];
  for (const items of Object.values(patternIndex.categories || {})) {
    for (const item of items) patternTypes.push(item.type);
  }
  lines.push(`사용 가능한 타입: ${patternTypes.join(', ')}`);
  lines.push('');
  lines.push('응답:');
  lines.push('```json');
  lines.push('{');
  lines.push('  "total": 13,');
  lines.push('  "categories": {');
  lines.push('    "jsp": [{ "type": "jsp-list", "title": "목록 페이지", "description": "..." }],');
  lines.push('    "dao": [...], "html": [...]');
  lines.push('  }');
  lines.push('}');
  lines.push('```');
  lines.push('');

  // --- GET /patterns/:type ---
  lines.push('## GET /patterns/:type');
  lines.push('코드 패턴 상세. JSP + HTML 템플릿 코드 포함.');
  lines.push('');
  lines.push('응답:');
  lines.push('```json');
  lines.push('{');
  lines.push('  "type": "jsp-list", "title": "목록 페이지 (JSP)",');
  lines.push('  "variables": { "TABLE_NAME": { "description": "테이블명", "example": "tb_board" } },');
  lines.push('  "jsp_template": "완성된 JSP 코드",');
  lines.push('  "html_template": "완성된 HTML 코드",');
  lines.push('  "notes": ["참고사항"]');
  lines.push('}');
  lines.push('```');
  lines.push('');

  // --- GET /docs ---
  lines.push('## GET /docs');
  lines.push('문서 목록 조회.');
  lines.push('');
  lines.push('응답:');
  lines.push('```json');
  lines.push('{');
  lines.push('  "total": 28,');
  lines.push('  "categories": { "basic": [{ "slug": "introduction", "title": "프레임워크 소개" }], ... }');
  lines.push('}');
  lines.push('```');
  lines.push('');

  // --- GET /docs/:slug ---
  lines.push('## GET /docs/:slug');
  lines.push('문서 상세 조회.');
  lines.push('');
  lines.push('응답:');
  lines.push('```json');
  lines.push('{');
  lines.push('  "slug": "database", "title": "...", "category": "core",');
  lines.push('  "content": "마크다운 전문",');
  lines.push('  "sections": [{ "heading": "...", "content": "..." }],');
  lines.push('  "related_docs": ["dataobject"], "related_classes": ["DataObject"]');
  lines.push('}');
  lines.push('```');
  lines.push('');

  // --- POST /docs/search ---
  lines.push('## POST /docs/search');
  lines.push('문서 검색.');
  lines.push('');
  lines.push('요청:');
  lines.push('```json');
  lines.push('{ "query": "검색어 (필수)", "limit": 10 }');
  lines.push('```');
  lines.push('');
  lines.push('응답:');
  lines.push('```json');
  lines.push('{');
  lines.push('  "query": "database", "total": 1,');
  lines.push('  "results": [{ "slug": "database", "title": "...", "category": "core", "excerpt": "..." }]');
  lines.push('}');
  lines.push('```');
  lines.push('');

  // --- POST /validate ---
  lines.push('## POST /validate');
  lines.push('코드 규칙 위반 검증. 코드 작성 후 호출 권장.');
  lines.push('');
  lines.push('요청:');
  lines.push('```json');
  lines.push('{');
  lines.push('  "code": "코드 문자열 (필수)",');
  lines.push('  "file_type": "jsp | html | dao (필수)",');
  lines.push('  "strict": false');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('응답:');
  lines.push('```json');
  lines.push('{');
  lines.push('  "status": "ok | warning | error",');
  lines.push('  "total_issues": 2,');
  lines.push('  "issues": [{ "id": "MISSING_INIT", "severity": "error", "message": "...", "line": 1 }],');
  lines.push('  "summary": { "errors": 1, "warnings": 1, "info": 0 }');
  lines.push('}');
  lines.push('```');
  lines.push('');

  return c.text(lines.join('\n'));
});

export default prompt;
