# 맑은프레임워크 MCP API - Cloudflare Workers 설계서

> AI 코딩 도구(Claude Code, Cursor, Windsurf)가 맑은프레임워크 정보를 실시간 조회할 수 있는 MCP API 서버

---

## 1. 프로젝트 개요

### 1.1 목적

JSP 기반 "맑은프레임워크"로 개발할 때, AI 코딩 도구가 프레임워크의 API 정보, 코딩 규칙, 문서, 코드 패턴을 조회할 수 있는 API 서버를 Cloudflare Workers로 구현합니다.

### 1.2 왜 Cloudflare Workers인가?

| 항목 | 기존 (FastAPI + Linux) | Cloudflare Workers |
|------|----------------------|-------------------|
| 인프라 | 서버 구매/관리 필요 | 서버리스, 관리 불필요 |
| 배포 | SSH + systemd | `wrangler deploy` 한 줄 |
| 비용 | 월 서버 비용 | 무료 티어 10만 req/day |
| Java 의존성 | JDK 필요 | 불필요 (사전 분석 데이터 사용) |

### 1.3 아키텍처

```
AI 코딩 도구 (Claude Code / Cursor / Windsurf)
        │ HTTP
        ▼
┌─────────────────────────────────────┐
│        Cloudflare Workers           │
│                                     │
│  Hono (Router + Middleware)         │
│    ├── routes/     → 요청 처리      │
│    └── services/   → 비즈니스 로직  │
│                                     │
│  KV Store (MALGN_DATA)             │
│    ├── class:*     → 클래스 정보    │
│    ├── doc:*       → 프레임워크 문서 │
│    ├── rules:*     → 코딩 규칙      │
│    └── pattern:*   → 코드 패턴      │
└─────────────────────────────────────┘
```

**핵심 설계 원칙:**
- KV 네임스페이스는 **1개**(`MALGN_DATA`)만 사용, 키 접두사로 구분
- 자주 사용되고 변경이 적은 데이터(안티패턴 규칙, 체크리스트)는 **코드에 내장**
- 대용량/변경 가능 데이터(클래스 상세, 문서, 패턴 템플릿)는 **KV에 저장**
- JWT 인증 불필요 — 선택적 API 토큰 인증만 지원

---

## 2. 프로젝트 구조

```
malgn-mcp/
├── wrangler.toml              # Workers 설정
├── package.json
├── src/
│   ├── index.js               # 엔트리포인트 (Hono 앱)
│   ├── routes/
│   │   ├── classes.js         # 클래스/메소드 조회
│   │   ├── docs.js            # 문서 조회/검색
│   │   ├── rules.js           # 코딩 규칙 + 체크리스트
│   │   ├── patterns.js        # 코드 패턴/템플릿
│   │   ├── validate.js        # 코드 검증
│   │   └── context.js         # 통합 컨텍스트
│   ├── services/
│   │   ├── kvService.js       # KV 데이터 접근 (공통)
│   │   ├── validateService.js # 코드 검증 로직 (안티패턴 내장)
│   │   └── contextService.js  # 컨텍스트 조합 로직
│   ├── middleware/
│   │   └── errorHandler.js    # 에러 핸들러
│   └── utils/
│       └── utils.js           # 유틸리티 함수
├── data/                      # KV 업로드용 JSON 데이터
│   ├── classes/               # 클래스별 JSON
│   ├── docs/                  # 문서별 JSON
│   ├── rules/                 # 규칙 JSON
│   └── patterns/              # 패턴 JSON
├── scripts/
│   └── upload-kv.sh           # KV 데이터 일괄 업로드
└── docs/                      # 원본 맑은프레임워크 문서 (33개 .md)
```

---

## 3. API 엔드포인트

### 3.1 엔드포인트 요약

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | API 정보 |
| GET | `/health` | 헬스 체크 |
| GET | `/classes` | 클래스 목록 |
| GET | `/classes/:name` | 클래스 상세 (메소드 포함) |
| POST | `/validate` | 코드 검증 |
| GET | `/rules` | 코딩 규칙 (카테고리 필터 지원) |
| GET | `/rules/checklist` | 코드 체크리스트 |
| GET | `/docs` | 문서 목록 |
| GET | `/docs/:slug` | 문서 상세 |
| POST | `/docs/search` | 문서 검색 |
| GET | `/patterns` | 코드 패턴 목록 |
| GET | `/patterns/:type` | 코드 패턴 상세 |
| POST | `/context` | 통합 컨텍스트 조회 |

### 3.2 엔드포인트 상세

---

#### `GET /`

```json
{
  "service": "맑은프레임워크 MCP API",
  "version": "1.0.0",
  "status": "running",
  "endpoints": [
    "GET /classes",
    "GET /classes/:name",
    "POST /validate",
    "GET /rules",
    "GET /docs",
    "GET /patterns",
    "POST /context"
  ]
}
```

---

#### `GET /health`

```json
{
  "status": "healthy",
  "timestamp": "2026-02-10T12:00:00Z",
  "kv_status": "connected"
}
```

---

#### `GET /classes`

전체 클래스 목록을 반환합니다.

**Query Parameters:** `?category=core|data|web|util|security`

```json
{
  "total": 17,
  "categories": {
    "core": ["Malgn", "Form", "Page"],
    "data": ["DataObject", "DataSet", "Database", "ListManager"],
    "web": ["Json", "RestAPI", "Http"],
    "util": ["Mail", "ExcelX", "Xml", "FileManager", "Calendar"],
    "security": ["Auth", "Cipher"]
  },
  "classes": [
    {
      "name": "Malgn",
      "category": "core",
      "description": "프레임워크 핵심 유틸리티 클래스",
      "variable_name": "m",
      "initialization": "Malgn m = new Malgn(request, response, out);",
      "method_count": 45
    }
  ]
}
```

---

#### `GET /classes/:name`

특정 클래스의 상세 정보(모든 메소드 포함)를 반환합니다.

**Query Parameters:** `?method=메소드명` (특정 메소드만 필터)

```json
{
  "name": "Malgn",
  "fullClassName": "malgnsoft.util.Malgn",
  "category": "core",
  "description": "프레임워크 핵심 유틸리티 클래스",
  "variable_name": "m",
  "initialization": "Malgn m = new Malgn(request, response, out);",
  "initialized_in": "init.jsp",
  "methods": [
    {
      "name": "rs",
      "signature": "String rs(String key)",
      "description": "GET 파라미터를 문자열로 가져옴 (XSS 자동 필터)",
      "returnType": "String",
      "parameters": [
        { "name": "key", "type": "String", "description": "파라미터명" }
      ],
      "usage": "String keyword = m.rs(\"keyword\");",
      "notes": "GET 파라미터 전용. POST 데이터는 f.get() 사용.",
      "related": ["m.ri()", "f.get()"]
    }
  ],
  "method_count": 45,
  "important_rules": [
    "init.jsp에서 자동 초기화됨 (개별 import 불필요)",
    "GET: m.rs(), m.ri() / POST: f.get(), f.getInt()"
  ]
}
```

---

#### `POST /validate`

JSP/HTML 코드를 검증하고 안티패턴을 찾습니다.

**Request:**
```json
{
  "code": "int id = m.getInt(\"id\");",
  "file_type": "jsp",
  "strict": false
}
```

**Response:**
```json
{
  "status": "error",
  "total_issues": 1,
  "issues": [
    {
      "line": 1,
      "severity": "error",
      "code": "INVALID_METHOD",
      "message": "m.getInt() 메소드는 존재하지 않습니다.",
      "suggestion": "m.ri()를 사용하세요.",
      "fix": { "old": "m.getInt(\"id\")", "new": "m.ri(\"id\")" }
    }
  ],
  "summary": { "errors": 1, "warnings": 0, "info": 0 }
}
```

---

#### `GET /rules`

코딩 규칙을 반환합니다.

**Query Parameters:** `?category=naming|postback|parameter|security|template|structure|data|message|ajax|style`

```json
{
  "total": 35,
  "rules": [
    {
      "id": "naming-dao",
      "category": "naming",
      "severity": "error",
      "title": "DAO 변수명 규칙",
      "rule": "DAO 변수명은 테이블명에서 tb_ 제거 후 소문자 사용",
      "correct": "UserDao user = new UserDao();",
      "incorrect": "UserDao userDao = new UserDao();"
    }
  ]
}
```

---

#### `GET /rules/checklist`

코드 작성 후 확인할 체크리스트를 반환합니다.

```json
{
  "sections": [
    {
      "title": "필수 규칙",
      "items": [
        { "id": "chk-naming", "text": "명명 규칙: UserDao user, DataSet info/list", "severity": "error" },
        { "id": "chk-jsp-start", "text": "JSP 시작: <%@ page contentType...%><%@ include file=\"/init.jsp\"%><%", "severity": "error" },
        { "id": "chk-no-import", "text": "JSP import 금지", "severity": "error" },
        { "id": "chk-separation", "text": "JSP/HTML 완전 분리", "severity": "error" },
        { "id": "chk-no-try-catch", "text": "try-catch 금지 (boolean 체크)", "severity": "error" },
        { "id": "chk-page-order", "text": "Page 순서: setLayout→setBody→setVar→display", "severity": "error" },
        { "id": "chk-dataset-next", "text": "DataSet next() 호출 필수", "severity": "error" }
      ]
    }
  ]
}
```

---

#### `GET /docs`

문서 목록을 카테고리별로 반환합니다.

```json
{
  "total": 28,
  "categories": {
    "basic": [
      { "slug": "introduction", "title": "프레임워크 소개" },
      { "slug": "getting-started", "title": "시작하기" },
      { "slug": "coding-principles", "title": "코딩 원칙" }
    ],
    "core": [
      { "slug": "template", "title": "맑은템플릿" },
      { "slug": "database", "title": "데이터베이스 연동" },
      { "slug": "dataobject", "title": "DataObject 클래스" }
    ]
  }
}
```

---

#### `GET /docs/:slug`

특정 문서의 전체 내용을 반환합니다.

```json
{
  "slug": "database",
  "title": "데이터베이스 연동",
  "category": "core",
  "content": "# 데이터베이스 연동\n\n맑은프레임워크의 데이터베이스...",
  "sections": [
    {
      "heading": "DB 설정",
      "content": "config.xml에서 데이터베이스를 설정합니다..."
    }
  ],
  "related_docs": ["dataobject", "dataset"],
  "related_classes": ["Database", "DataObject"]
}
```

---

#### `POST /docs/search`

문서를 키워드로 검색합니다.

**Request:**
```json
{ "query": "데이터베이스 연결", "limit": 5 }
```

**Response:**
```json
{
  "query": "데이터베이스 연결",
  "total": 3,
  "results": [
    {
      "slug": "database",
      "title": "데이터베이스 연동",
      "excerpt": "맑은프레임워크의 데이터베이스 연동은..."
    }
  ]
}
```

---

#### `GET /patterns`

코드 패턴 목록을 반환합니다.

```json
{
  "total": 13,
  "categories": {
    "jsp": [
      { "type": "jsp-list", "title": "목록 페이지", "description": "페이징+검색+목록 조회" },
      { "type": "jsp-insert", "title": "등록 페이지", "description": "유효성 검증+POST 처리" },
      { "type": "jsp-modify", "title": "수정 페이지", "description": "조회→검증→수정" },
      { "type": "jsp-delete", "title": "삭제 처리", "description": "POST 삭제" },
      { "type": "jsp-view", "title": "상세 조회", "description": "단일 레코드 조회" },
      { "type": "jsp-restapi", "title": "REST API", "description": "CRUD REST API" },
      { "type": "jsp-ajax", "title": "AJAX 처리", "description": "JSON 응답" }
    ],
    "dao": [
      { "type": "dao-basic", "title": "기본 DAO", "description": "DataObject 상속 기본" },
      { "type": "dao-custom", "title": "커스텀 DAO", "description": "커스텀 메소드 포함" }
    ],
    "html": [
      { "type": "html-list", "title": "목록 템플릿", "description": "테이블+페이징" },
      { "type": "html-form", "title": "폼 템플릿", "description": "등록/수정 공용" },
      { "type": "html-view", "title": "상세 템플릿", "description": "상세 조회 화면" },
      { "type": "html-layout", "title": "레이아웃", "description": "기본 레이아웃" }
    ]
  }
}
```

---

#### `GET /patterns/:type`

특정 코드 패턴의 JSP/HTML/DAO 템플릿을 반환합니다.

```json
{
  "type": "jsp-list",
  "title": "목록 페이지 (JSP)",
  "variables": {
    "TABLE_NAME": { "description": "테이블명", "example": "tb_user" },
    "DAO_CLASS": { "description": "DAO 클래스명", "example": "UserDao" },
    "DAO_VAR": { "description": "DAO 변수명", "example": "user" }
  },
  "jsp_template": "<%@ page contentType=\"text/html; charset=utf-8\" %>...",
  "html_template": "<!-- 검색 -->\n<form name=\"form1\"...",
  "notes": ["ListManager가 페이징 자동 처리", "addSearch()는 빈 값 자동 무시"]
}
```

---

#### `POST /context` (핵심 엔드포인트)

AI가 코드 생성 전 필요한 모든 컨텍스트를 한 번에 조회합니다.

**Request:**
```json
{
  "task": "게시판 목록 페이지 만들기",
  "file_type": "jsp",
  "features": ["list", "search", "paging"],
  "table_name": "tb_board",
  "include_rules": true,
  "include_patterns": true,
  "include_class_info": ["ListManager", "DataObject"]
}
```

**Response:**
```json
{
  "task": "게시판 목록 페이지 만들기",
  "context": {
    "rules": {
      "critical": [
        "DAO 변수명: BoardDao board (boardDao X)",
        "JSP/HTML 완전 분리",
        "DataSet은 next() 호출 필수"
      ],
      "relevant": [
        "ListManager로 페이징 처리",
        "f.addElement()로 검색값 유지"
      ]
    },
    "patterns": {
      "jsp": "<%@ page contentType=...",
      "html": "..."
    },
    "class_info": {
      "ListManager": {
        "description": "목록 조회 + 페이징 + 검색",
        "key_methods": [
          "setRequest(request) - 요청 객체 설정",
          "setListNum(int) - 페이지당 개수",
          "setTable(String) - 테이블명",
          "getDataSet() - 결과 DataSet"
        ]
      }
    },
    "checklist": [
      "BoardDao board (boardDao X)",
      "DataSet list (ds X, result X)",
      "setLayout→setBody→setLoop→setVar→display 순서"
    ]
  }
}
```

---

## 4. KV 데이터 구조

### 4.1 단일 KV 네임스페이스: `MALGN_DATA`

모든 데이터를 키 접두사로 구분합니다.

```
키                          | 설명
----------------------------|----------------------------------
class:_index                | 전체 클래스 인덱스
class:Malgn                 | Malgn 클래스 상세
class:Form                  | Form 클래스 상세
class:Page                  | Page 클래스 상세
class:DataObject            | DataObject 클래스 상세
class:DataSet               | DataSet 클래스 상세
class:Database              | Database 클래스 상세
class:ListManager           | ListManager 클래스 상세
class:Auth                  | Auth 클래스 상세
class:Json                  | Json 클래스 상세
class:RestAPI               | RestAPI 클래스 상세
class:Http                  | Http 클래스 상세
class:Mail                  | Mail 클래스 상세
class:ExcelX                | ExcelX 클래스 상세
class:Xml                   | Xml 클래스 상세
class:FileManager           | FileManager 클래스 상세
class:Cipher                | Cipher 클래스 상세
class:Calendar              | Calendar 클래스 상세
doc:_index                  | 문서 인덱스
doc:{slug}                  | 각 문서 내용 (28개)
rules:all                   | 전체 코딩 규칙
rules:{category}            | 카테고리별 규칙
pattern:_index              | 패턴 인덱스
pattern:{type}              | 각 패턴 템플릿 (13개)
```

### 4.2 코드에 내장하는 데이터

아래 데이터는 변경 빈도가 낮고 크기가 작으므로 KV 대신 코드에 직접 포함합니다.

- **안티패턴 규칙** (`validateService.js`에 내장)
- **체크리스트** (`rules.js` 라우트에 내장)
- **feature → class/pattern 매핑** (`contextService.js`에 내장)
- **클래스 인덱스** (`classes.js` 라우트에 내장 가능)

---

## 5. 구현 상세

### 5.1 wrangler.toml

```toml
name = "malgn-mcp"
main = "src/index.js"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "development"
API_VERSION = "1.0.0"

# KV 네임스페이스 (1개만 사용)
[[kv_namespaces]]
binding = "MALGN_DATA"
id = "<KV_NAMESPACE_ID>"

[env.production]
name = "malgn-mcp-prod"
vars = { ENVIRONMENT = "production" }

[[env.production.kv_namespaces]]
binding = "MALGN_DATA"
id = "<PROD_KV_NAMESPACE_ID>"
```

### 5.2 package.json

```json
{
  "name": "malgn-mcp",
  "version": "1.0.0",
  "description": "맑은프레임워크 MCP API - Cloudflare Workers",
  "main": "src/index.js",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "deploy:prod": "wrangler deploy --env production"
  },
  "dependencies": {
    "hono": "^4.0.0"
  },
  "devDependencies": {
    "wrangler": "^3.0.0"
  }
}
```

> 기존 템플릿의 `jose`, `@hono/swagger-ui`는 제거합니다. MCP API 서버에는 JWT 인증과 Swagger UI가 불필요합니다.

### 5.3 엔트리포인트 (`src/index.js`)

```javascript
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

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// 선택적 API 토큰 인증
app.use('*', async (c, next) => {
  // /health는 인증 불필요
  if (c.req.path === '/health' || c.req.path === '/') {
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
      'POST /context'
    ]
  });
});

// Health
app.get('/health', async (c) => {
  let kvStatus = 'unknown';
  try {
    await c.env.MALGN_DATA.get('class:_index');
    kvStatus = 'connected';
  } catch {
    kvStatus = 'error';
  }
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    kv_status: kvStatus
  });
});

app.onError(errorHandler);
app.notFound((c) => c.json({ error: 'Not Found', path: c.req.path }, 404));

export default app;
```

### 5.4 KV 서비스 (`src/services/kvService.js`)

모든 KV 접근을 하나의 서비스로 통합합니다.

```javascript
export class KvService {
  constructor(env) {
    this.kv = env.MALGN_DATA;
  }

  // 클래스 데이터
  async getClassIndex() {
    return await this.kv.get('class:_index', { type: 'json' });
  }

  async getClass(name) {
    return await this.kv.get(`class:${name}`, { type: 'json' });
  }

  // 문서 데이터
  async getDocIndex() {
    return await this.kv.get('doc:_index', { type: 'json' });
  }

  async getDoc(slug) {
    return await this.kv.get(`doc:${slug}`, { type: 'json' });
  }

  // 규칙 데이터
  async getRules(category = 'all') {
    return await this.kv.get(`rules:${category}`, { type: 'json' });
  }

  // 패턴 데이터
  async getPatternIndex() {
    return await this.kv.get('pattern:_index', { type: 'json' });
  }

  async getPattern(type) {
    return await this.kv.get(`pattern:${type}`, { type: 'json' });
  }

  // 병렬 조회 (context 엔드포인트용)
  async getMultiple(keys) {
    return await Promise.all(
      keys.map(key => this.kv.get(key, { type: 'json' }))
    );
  }
}
```

### 5.5 코드 검증 서비스 (`src/services/validateService.js`)

안티패턴 규칙을 코드에 내장합니다.

```javascript
const ANTIPATTERNS = [
  // 존재하지 않는 메소드
  { pattern: /m\.getInt\s*\(/, code: 'INVALID_METHOD', severity: 'error',
    message: 'm.getInt() 메소드는 존재하지 않습니다.', suggestion: 'm.ri()를 사용하세요.' },
  { pattern: /m\.getString\s*\(/, code: 'INVALID_METHOD', severity: 'error',
    message: 'm.getString() 메소드는 존재하지 않습니다.', suggestion: 'm.rs()를 사용하세요.' },
  { pattern: /m\.isSet\s*\(/, code: 'INVALID_METHOD', severity: 'error',
    message: 'm.isSet() 메소드는 존재하지 않습니다.',
    suggestion: 'm.rs()로 받은 후 !"".equals() 체크하세요.' },
  { pattern: /m\.getParameter\s*\(/, code: 'INVALID_METHOD', severity: 'error',
    message: 'm.getParameter()는 사용하지 마세요.', suggestion: 'm.rs() 또는 m.ri()를 사용하세요.' },
  { pattern: /request\.getParameter\s*\(/, code: 'RAW_PARAMETER', severity: 'error',
    message: 'request.getParameter() 직접 사용 금지.',
    suggestion: 'GET: m.rs()/m.ri(), POST: f.get()/f.getInt() 사용.' },

  // 명명 규칙 위반
  { pattern: /(\w+)Dao\s+\1Dao\s*=/, code: 'NAMING_VIOLATION', severity: 'error',
    message: "DAO 변수명에 'Dao' 접미사를 붙이지 마세요.",
    suggestion: 'UserDao user = new UserDao(); 형태로 사용하세요.' },
  { pattern: /DataSet\s+ds\s*=/, code: 'NAMING_VIOLATION', severity: 'error',
    message: "DataSet 변수명으로 'ds'를 사용하지 마세요.",
    suggestion: '단일: info/data, 복수: list 또는 xxxList를 사용하세요.' },

  // 보안 위반
  { pattern: /query\s*\(\s*"[^"]*'\s*\+/, code: 'SQL_INJECTION', severity: 'error',
    message: 'SQL 문자열 직접 연결은 SQL Injection 위험.',
    suggestion: 'query("WHERE id = ?", new Object[]{id}) 형태를 사용하세요.' },

  // 구조 위반
  { pattern: /<%@\s*page\s+import\s*=/, code: 'FORBIDDEN_IMPORT', severity: 'error',
    message: 'JSP에서 개별 import 절대 금지.',
    suggestion: 'init.jsp에서 제공하는 import만 사용하세요.' },
  { pattern: /try\s*\{[\s\S]*?catch\s*\(/, code: 'TRY_CATCH', severity: 'error',
    message: 'try-catch 사용 금지. boolean 리턴으로 처리합니다.',
    suggestion: 'if(user.insert()) { ... } else { m.jsError(user.getErrMsg()); }' },

  // 템플릿 위반
  { pattern: /<%=/, code: 'SCRIPTLET_OUTPUT', severity: 'error',
    message: 'JSP 표현식 태그 사용 금지.',
    suggestion: 'HTML 템플릿에서 {{변수명}} 사용.' },

  // Page 순서 위반
  { pattern: /p\.setVar\([^)]*\)[\s\S]*?p\.setBody\(/, code: 'PAGE_ORDER', severity: 'error',
    message: 'p.setVar()가 p.setBody()보다 먼저 호출됨.',
    suggestion: '순서: setLayout()→setBody()→setVar()→setLoop()→display()' },

  // NULL 체크 불필요
  { pattern: /info\.s\([^)]+\)\s*!=\s*null/, code: 'UNNECESSARY_NULL_CHECK', severity: 'warning',
    message: 'DataSet.s()는 null을 반환하지 않습니다.',
    suggestion: '조건문 없이 바로 사용하세요.' },
  { pattern: /m\.rs\([^)]+\)\s*!=\s*null/, code: 'UNNECESSARY_NULL_CHECK', severity: 'warning',
    message: 'm.rs()는 null을 반환하지 않습니다.', suggestion: '빈 문자열 체크도 불필요합니다.' },

  // DataSet next() 누락
  { pattern: /=\s*\w+\.(find|get|query)\([^)]*\)\s*;\s*\n\s*\w+\.s\(/, code: 'MISSING_NEXT', severity: 'error',
    message: 'DataSet의 next()를 호출하지 않고 데이터에 접근.',
    suggestion: 'if(info.next()) { ... } 또는 while(list.next()) { ... }' },

  // AJAX 위반
  { pattern: /data-ajax\s*=\s*"true"[\s\S]*?m\.jsReplace/, code: 'AJAX_REDIRECT', severity: 'error',
    message: 'AJAX 폼에서 m.jsReplace()는 작동하지 않습니다.',
    suggestion: 'j.success() / j.error() 를 사용하세요.' },

  // moveRow
  { pattern: /\.moveRow\s*\(/, code: 'INVALID_METHOD', severity: 'error',
    message: 'moveRow() 메소드는 존재하지 않습니다.',
    suggestion: 'setLoop()가 자동으로 커서를 초기화합니다.' }
];

export class ValidateService {
  validate(code, fileType = 'jsp', strict = false) {
    const issues = [];

    for (const ap of ANTIPATTERNS) {
      if (!strict && ap.severity === 'info') continue;

      const regex = new RegExp(ap.pattern.source, 'g');
      let match;

      while ((match = regex.exec(code)) !== null) {
        const line = code.substring(0, match.index).split('\n').length;

        issues.push({
          line,
          severity: ap.severity,
          code: ap.code,
          message: ap.message,
          suggestion: ap.suggestion
        });
      }
    }

    issues.sort((a, b) => a.line - b.line);

    const summary = {
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length
    };

    return {
      status: summary.errors > 0 ? 'error' : 'ok',
      total_issues: issues.length,
      issues,
      summary
    };
  }
}
```

### 5.6 컨텍스트 서비스 (`src/services/contextService.js`)

feature 키워드 → 필요 데이터 매핑을 내장합니다.

```javascript
import { KvService } from './kvService.js';

// feature → 필요한 클래스/패턴/규칙 매핑
const FEATURE_MAP = {
  list:    { classes: ['ListManager', 'DataObject', 'Form'], patterns: ['jsp-list', 'html-list'] },
  insert:  { classes: ['DataObject', 'Form', 'Page'], patterns: ['jsp-insert', 'html-form', 'dao-basic'] },
  modify:  { classes: ['DataObject', 'Form', 'Page'], patterns: ['jsp-modify', 'html-form'] },
  delete:  { classes: ['DataObject'], patterns: ['jsp-delete'] },
  view:    { classes: ['DataObject', 'Page'], patterns: ['jsp-view', 'html-view'] },
  search:  { classes: ['ListManager', 'Form'], patterns: ['jsp-list', 'html-list'] },
  paging:  { classes: ['ListManager'], patterns: ['jsp-list'] },
  ajax:    { classes: ['Json', 'Form'], patterns: ['jsp-ajax'] },
  restapi: { classes: ['RestAPI', 'Json'], patterns: ['jsp-restapi'] },
  upload:  { classes: ['Form', 'FileManager'], patterns: ['jsp-insert'] },
  auth:    { classes: ['Auth'], patterns: [] }
};

export class ContextService {
  constructor(env) {
    this.kvService = new KvService(env);
  }

  async buildContext(body) {
    // features로부터 필요 데이터 자동 결정
    const neededClasses = new Set();
    const neededPatterns = new Set();

    for (const feature of (body.features || [])) {
      const map = FEATURE_MAP[feature];
      if (map) {
        map.classes.forEach(c => neededClasses.add(c));
        map.patterns.forEach(p => neededPatterns.add(p));
      }
    }

    // 명시적 요청 클래스 추가
    for (const cls of (body.include_class_info || [])) {
      neededClasses.add(cls);
    }

    // KV 병렬 조회
    const classKeys = [...neededClasses].map(c => `class:${c}`);
    const patternKeys = body.include_patterns !== false
      ? [...neededPatterns].map(p => `pattern:${p}`)
      : [];

    const allKeys = [...classKeys, ...patternKeys];
    const results = await this.kvService.getMultiple(allKeys);

    // 결과 분리
    const classData = {};
    [...neededClasses].forEach((name, i) => {
      if (results[i]) classData[name] = results[i];
    });

    const patternData = {};
    [...neededPatterns].forEach((type, i) => {
      const idx = classKeys.length + i;
      if (results[idx]) patternData[type] = results[idx];
    });

    // 규칙은 코드 내장이므로 KV 조회 불필요
    const rules = body.include_rules !== false
      ? await this.kvService.getRules('all')
      : null;

    return {
      task: body.task,
      context: {
        rules: rules ? this.extractRules(rules, body.features) : undefined,
        patterns: body.include_patterns !== false ? patternData : undefined,
        class_info: this.simplifyClassInfo(classData),
        checklist: this.buildChecklist(body)
      }
    };
  }

  extractRules(allRules, features) {
    if (!allRules) return null;
    return {
      critical: (allRules.rules || [])
        .filter(r => r.severity === 'error')
        .slice(0, 10)
        .map(r => r.rule),
      relevant: (allRules.rules || [])
        .filter(r => r.severity === 'warning')
        .slice(0, 5)
        .map(r => r.rule)
    };
  }

  simplifyClassInfo(classData) {
    const result = {};
    for (const [name, data] of Object.entries(classData)) {
      if (!data) continue;
      result[name] = {
        description: data.description,
        key_methods: (data.methods || [])
          .map(m => `${m.signature} - ${m.description}`)
      };
    }
    return result;
  }

  buildChecklist(body) {
    const checklist = [
      'JSP 시작: <%@ page contentType="text/html; charset=utf-8" %><%@ include file="/init.jsp" %><%',
      'JSP/HTML 완전 분리: JSP에 HTML 절대 금지',
      'Page 순서: setLayout→setBody→setVar→setLoop→display'
    ];

    if (body.table_name) {
      const daoVar = body.table_name.replace('tb_', '');
      const daoClass = daoVar.charAt(0).toUpperCase() + daoVar.slice(1) + 'Dao';
      checklist.unshift(`DAO 변수명: ${daoClass} ${daoVar}`);
    }

    return checklist;
  }
}
```

### 5.7 라우트 예시 (`src/routes/classes.js`)

```javascript
import { Hono } from 'hono';
import { KvService } from '../services/kvService.js';

const classes = new Hono();

// GET /classes
classes.get('/', async (c) => {
  const kvService = new KvService(c.env);
  const index = await kvService.getClassIndex();

  if (!index) {
    return c.json({ error: '클래스 데이터가 아직 로드되지 않았습니다.' }, 503);
  }

  const category = c.req.query('category');
  if (category && index.categories[category]) {
    return c.json({
      total: index.categories[category].length,
      classes: index.classes.filter(cls => cls.category === category)
    });
  }

  return c.json(index);
});

// GET /classes/:name
classes.get('/:name', async (c) => {
  const name = c.req.param('name');
  const kvService = new KvService(c.env);
  const classInfo = await kvService.getClass(name);

  if (!classInfo) {
    return c.json({ error: `클래스 '${name}'를 찾을 수 없습니다.` }, 404);
  }

  // ?method= 필터
  const methodFilter = c.req.query('method');
  if (methodFilter) {
    classInfo.methods = classInfo.methods.filter(
      m => m.name.toLowerCase().includes(methodFilter.toLowerCase())
    );
  }

  return c.json(classInfo);
});

export default classes;
```

### 5.8 라우트 예시 (`src/routes/validate.js`)

```javascript
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
```

### 5.9 라우트 예시 (`src/routes/context.js`)

```javascript
import { Hono } from 'hono';
import { ContextService } from '../services/contextService.js';

const context = new Hono();

// POST /context
context.post('/', async (c) => {
  const body = await c.req.json();

  if (!body.task) {
    return c.json({ error: 'task는 필수입니다.' }, 400);
  }

  const contextService = new ContextService(c.env);
  const result = await contextService.buildContext(body);

  return c.json(result);
});

export default context;
```

---

## 6. 데이터 준비 및 KV 업로드

### 6.1 데이터 소스

| 데이터 | 소스 | KV 키 접두사 |
|--------|------|-------------|
| 클래스/메소드 정보 | `docs/*.md` + JAR 분석 결과 | `class:` |
| 프레임워크 문서 | `docs/*.md` (33개) | `doc:` |
| 코딩 규칙 | `GUIDE.md` + rules 파일 | `rules:` |
| 코드 패턴 | `GUIDE.md` + 수동 작성 | `pattern:` |

### 6.2 JSON 파일 준비

`data/` 디렉토리에 JSON 파일을 수동 또는 스크립트로 준비합니다.

```
data/
├── classes/
│   ├── _index.json           # 클래스 인덱스
│   ├── Malgn.json            # 각 클래스 상세
│   ├── Form.json
│   └── ...
├── docs/
│   ├── _index.json           # 문서 인덱스
│   ├── introduction.json     # 각 문서
│   └── ...
├── rules/
│   └── all.json              # 전체 규칙
└── patterns/
    ├── _index.json           # 패턴 인덱스
    ├── jsp-list.json         # 각 패턴
    └── ...
```

### 6.3 KV 업로드 스크립트 (`scripts/upload-kv.sh`)

```bash
#!/bin/bash
# KV 네임스페이스 ID (wrangler kv:namespace create MALGN_DATA 출력값)
KV_ID="<your-kv-namespace-id>"

echo "=== Uploading class data ==="
for f in data/classes/*.json; do
  name=$(basename "$f" .json)
  key="class:${name}"
  echo "  ${key}"
  npx wrangler kv:key put --namespace-id="$KV_ID" "$key" --path="$f"
done

echo "=== Uploading doc data ==="
for f in data/docs/*.json; do
  name=$(basename "$f" .json)
  key="doc:${name}"
  echo "  ${key}"
  npx wrangler kv:key put --namespace-id="$KV_ID" "$key" --path="$f"
done

echo "=== Uploading rules ==="
for f in data/rules/*.json; do
  name=$(basename "$f" .json)
  key="rules:${name}"
  echo "  ${key}"
  npx wrangler kv:key put --namespace-id="$KV_ID" "$key" --path="$f"
done

echo "=== Uploading patterns ==="
for f in data/patterns/*.json; do
  name=$(basename "$f" .json)
  key="pattern:${name}"
  echo "  ${key}"
  npx wrangler kv:key put --namespace-id="$KV_ID" "$key" --path="$f"
done

echo "=== Done ==="
```

---

## 7. MCP 클라이언트 설정

배포 후, 맑은프레임워크 프로젝트에서 MCP 서버를 등록합니다.

### Claude Code (`.claude/settings.json`)

```json
{
  "mcpServers": {
    "malgn-framework": {
      "type": "http",
      "url": "https://malgn-mcp.<your-subdomain>.workers.dev"
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "malgn-framework": {
      "url": "https://malgn-mcp.<your-subdomain>.workers.dev",
      "type": "http"
    }
  }
}
```

---

## 8. 보안

### 8.1 API 토큰 인증 (선택)

```bash
# 프로덕션에서 API_TOKEN 설정
npx wrangler secret put API_TOKEN --env production

# 로컬 개발: .dev.vars에 추가
# API_TOKEN=your-token-here
```

설정하지 않으면 인증 없이 공개 접근 가능합니다.

### 8.2 CORS

Hono의 `cors()` 미들웨어로 전체 허용. 필요시 특정 도메인만 허용하도록 변경 가능합니다.

---

## 9. 구현 순서

### Phase 1: 기반 구축

1. 프로젝트 초기화 (wrangler.toml, package.json 수정)
2. `src/index.js` 리팩토링 (JWT/Swagger 제거, MCP 라우트 등록)
3. `src/middleware/errorHandler.js` 유지
4. `src/services/kvService.js` 구현
5. `GET /`, `GET /health` 구현

### Phase 2: 핵심 데이터 API

6. `POST /validate` — 안티패턴 규칙 내장, KV 불필요
7. `GET /rules`, `GET /rules/checklist` — 규칙 데이터
8. `GET /classes`, `GET /classes/:name` — 클래스 정보
9. 클래스 데이터 JSON 파일 작성 + KV 업로드

### Phase 3: 문서/패턴/컨텍스트

10. `GET /docs`, `GET /docs/:slug`, `POST /docs/search` — 문서
11. `GET /patterns`, `GET /patterns/:type` — 패턴
12. `POST /context` — 통합 컨텍스트
13. 전체 데이터 JSON 준비 + KV 업로드

### Phase 4: 마무리

14. 프로덕션 배포 + MCP 클라이언트 설정
15. API 토큰 설정 (필요시)

---

## 부록 A: 핵심 클래스 요약

KV에 저장할 클래스 데이터의 핵심 내용입니다.

### Malgn (변수명: m)
- **초기화**: `Malgn m = new Malgn(request, response, out);` (init.jsp)
- **GET 파라미터**: `m.rs(key)` → String, `m.ri(key)` → int (XSS 자동 필터)
- **POST 여부**: `m.isPost()` → boolean
- **리다이렉트**: `m.redirect(url)`, `m.jsReplace(url)`, `m.jsError(msg)`, `m.jsAlert(msg)`
- **시간**: `m.time()`, `m.time(format)`, `m.time(format, dateStr)`
- **암호화**: `Malgn.sha256(str)` (static)

### Form (변수명: f)
- **초기화**: `Form f = new Form();` (init.jsp)
- **필드 설정**: `f.addElement(name, defaultValue, rules)`
- **POST 데이터**: `f.get(key)` → String, `f.getInt(key)` → int
- **검증**: `f.validate()` → boolean
- **스크립트**: `f.getScript()` → 클라이언트 검증 JS

### Page (변수명: p)
- **초기화**: `Page p = new Page();` (init.jsp)
- **순서 엄수**: `setLayout()` → `setBody()` → `setVar()` → `setLoop()` → `display()`
- **레이아웃**: `p.setLayout("default")` → `layout_default.html`
- **본문**: `p.setBody("main.user_list")` → `/html/main/user_list.html`

### DataObject (DAO 기반)
- **상속**: `public class UserDao extends DataObject { this.table = "tb_user"; }`
- **조회**: `find()`, `find(where, params)`, `get(id)`
- **등록**: `item(key, value)` + `insert()` → boolean
- **수정**: `item(key, value)` + `update(where, params)` → boolean
- **삭제**: `delete(where, params)` → boolean

### DataSet
- **커서**: `next()` → boolean (**반드시 호출!**)
- **문자열**: `s(key)` → String (null 대신 빈 문자열)
- **정수**: `i(key)` → int
- **추가**: `put(key, value)`

### ListManager
- **설정**: `setRequest(request)`, `setListNum(n)`, `setTable(table)`
- **검색**: `addSearch(fields, value, type)` → 빈 값 자동 무시
- **결과**: `getDataSet()`, `getTotalNum()`, `getPaging()`

### Json (변수명: j)
- **성공**: `j.success(message)`, `j.success(message, data)`
- **에러**: `j.error(message)`, `j.error(code, message)`
- **데이터**: `j.put(key, value)`

### Auth
- **확인**: `auth.isValid()` → boolean
- **읽기**: `auth.getInt(key)`, `auth.getString(key)`
- **저장**: `auth.put(key, value)` + `auth.save()`

### RestAPI
- **라우팅**: `api.get(path, handler)`, `api.post()`, `api.put()`, `api.delete()`
- **파라미터**: `api.paramInt(name)`, `api.paramString(name)`

---

## 부록 B: 템플릿 문법

```
변수 출력:   {{변수명}}, {{list.필드명}}
조건(true):  <!--@if(boolVar)-->...<!--/if(boolVar)-->
조건(false): <!--@nif(boolVar)-->...<!--/nif(boolVar)-->
반복:        <!--@loop(list)-->...<!--/loop(list)-->
포함:        <!--@include(/path/file.html)-->
실행:        <!--@execute(/path/file.jsp)-->
본문:        <!--@include(BODY)-->

주의: 조건문에 비교연산자 사용 불가! JSP에서 boolean 변수로 변환 필수
```
