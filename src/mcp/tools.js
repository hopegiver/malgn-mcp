import { DataService } from '../services/dataService.js';
import { ContextService } from '../services/contextService.js';
import { ValidateService } from '../services/validateService.js';

const dataService = new DataService();
const contextService = new ContextService();
const validateService = new ValidateService();

// MCP Tool 정의
export const TOOL_DEFINITIONS = [
  {
    name: 'get_context',
    description: '맑은프레임워크 코딩 작업에 필요한 규칙, 패턴, 클래스 정보를 한번에 조회. 작업 시작 시 가장 먼저 호출 권장.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: '작업 설명 (예: "게시판 목록 만들기")' },
        features: {
          type: 'array',
          items: { type: 'string', enum: ['list', 'insert', 'modify', 'delete', 'view', 'search', 'paging', 'ajax', 'restapi', 'upload', 'auth'] },
          description: '필요한 기능 목록'
        },
        table_name: { type: 'string', description: '테이블명 (예: tb_board)' },
        include_class_info: { type: 'array', items: { type: 'string' }, description: '추가로 포함할 클래스명' },
        include_patterns: { type: 'boolean', description: '패턴 포함 여부 (기본: true)' },
        include_rules: { type: 'boolean', description: '규칙 포함 여부 (기본: true)' }
      },
      required: ['task']
    }
  },
  {
    name: 'validate_code',
    description: 'JSP/HTML/DAO 코드의 맑은프레임워크 규칙 위반을 검증.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '검증할 코드' },
        file_type: { type: 'string', enum: ['jsp', 'html', 'dao'], description: '파일 타입' },
        strict: { type: 'boolean', description: '엄격 모드 (기본: false)' }
      },
      required: ['code', 'file_type']
    }
  },
  {
    name: 'get_class',
    description: '맑은프레임워크 클래스의 메소드와 사용법 상세 조회. name 생략 시 전체 클래스 목록 반환.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '클래스명 (예: Malgn, Form, DataObject). 생략 시 목록 반환.' },
        category: { type: 'string', enum: ['core', 'data', 'web', 'util', 'security'], description: '목록 조회 시 카테고리 필터' },
        method_filter: { type: 'string', description: '메소드명 검색 필터' }
      }
    }
  },
  {
    name: 'get_rules',
    description: '맑은프레임워크 코딩 규칙 조회. rule_id로 개별 규칙 조회 가능.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['all', 'naming', 'structure', 'template', 'parameter', 'data', 'postback', 'message', 'ajax', 'security', 'style', 'checklist'],
          description: '규칙 카테고리 (기본: all). checklist는 코드리뷰용 체크리스트.'
        },
        rule_id: {
          type: 'string',
          description: '규칙 ID (예: naming-dao, param-invalid-method). validate_code 결과의 ruleId로 조회.'
        }
      }
    }
  },
  {
    name: 'get_pattern',
    description: '맑은프레임워크 JSP/HTML/DAO 코드 패턴 템플릿 조회. type 생략 시 전체 패턴 목록 반환.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['jsp-list', 'jsp-insert', 'jsp-modify', 'jsp-delete', 'jsp-view', 'jsp-restapi', 'jsp-ajax', 'dao-basic', 'dao-custom', 'html-list', 'html-form', 'html-view', 'html-layout'],
          description: '패턴 타입. 생략 시 목록 반환.'
        }
      }
    }
  },
  {
    name: 'get_doc',
    description: '맑은프레임워크 문서 조회. slug 생략 시 전체 문서 목록 반환.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: '문서 slug (예: database, template). 생략 시 목록 반환.' }
      }
    }
  },
  {
    name: 'search_docs',
    description: '맑은프레임워크 문서 검색.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '검색어' },
        limit: { type: 'number', description: '최대 결과 수 (기본: 10)' }
      },
      required: ['query']
    }
  }
];

// Tool 실행
export function executeTool(name, args = {}) {
  switch (name) {
    case 'get_context':
      return contextService.buildContext(args);

    case 'validate_code':
      return validateService.validate(args.code, args.file_type, args.strict);

    case 'get_class': {
      if (!args.name) {
        const index = dataService.getClassIndex();
        if (args.category && index.categories[args.category]) {
          return {
            total: index.categories[args.category].length,
            classes: index.classes.filter(c => c.category === args.category)
          };
        }
        return index;
      }
      const classInfo = dataService.getClass(args.name);
      if (!classInfo) return { error: `클래스 '${args.name}'를 찾을 수 없습니다.` };
      if (args.method_filter) {
        return {
          ...classInfo,
          methods: classInfo.methods.filter(
            m => m.name.toLowerCase().includes(args.method_filter.toLowerCase())
          )
        };
      }
      return classInfo;
    }

    case 'get_rules': {
      // rule_id로 개별 규칙 조회
      if (args.rule_id) {
        const allRules = dataService.getRules('all');
        const rule = (allRules?.rules || []).find(r => r.id === args.rule_id);
        if (!rule) return { error: `규칙 '${args.rule_id}'를 찾을 수 없습니다.` };
        return { total: 1, rules: [rule] };
      }

      const category = args.category || 'all';
      if (category === 'checklist') {
        return {
          sections: [
            {
              title: '필수 규칙',
              items: [
                { id: 'chk-naming', text: '명명 규칙: UserDao user, DataSet info/list', severity: 'error' },
                { id: 'chk-jsp-start', text: 'JSP 시작: <%@ page contentType...%><%@ include file="/init.jsp"%><%', severity: 'error' },
                { id: 'chk-no-import', text: 'JSP import 금지', severity: 'error' },
                { id: 'chk-separation', text: 'JSP/HTML 완전 분리', severity: 'error' },
                { id: 'chk-no-try-catch', text: 'try-catch 금지 (boolean 체크)', severity: 'error' },
                { id: 'chk-page-order', text: 'Page 순서: setLayout→setBody→setVar→display', severity: 'error' },
                { id: 'chk-dataset-next', text: 'DataSet next() 호출 필수', severity: 'error' }
              ]
            },
            {
              title: '구조 규칙',
              items: [
                { id: 'chk-no-scriptlet', text: 'JSP 표현식 태그 (<%= %>) 사용 금지', severity: 'error' },
                { id: 'chk-template-var', text: 'HTML에서 {{변수명}} 사용', severity: 'error' },
                { id: 'chk-postback', text: '등록/수정은 같은 JSP에서 postback 처리', severity: 'warning' },
                { id: 'chk-form-validate', text: 'f.validate()로 서버 검증', severity: 'warning' },
                { id: 'chk-ajax-json', text: 'AJAX 폼은 j.success()/j.error() 응답', severity: 'error' }
              ]
            },
            {
              title: '데이터 처리',
              items: [
                { id: 'chk-bind-param', text: 'SQL 파라미터 바인딩 사용 (? 플레이스홀더)', severity: 'error' },
                { id: 'chk-null-safe', text: 'DataSet.s()는 null 반환하지 않음 (null 체크 불필요)', severity: 'info' },
                { id: 'chk-listmanager', text: '목록+페이징은 ListManager 사용', severity: 'warning' }
              ]
            }
          ]
        };
      }
      const rules = dataService.getRules(category);
      if (!rules) return { error: `카테고리 '${category}'를 찾을 수 없습니다.` };
      return rules;
    }

    case 'get_pattern': {
      if (!args.type) return dataService.getPatternIndex();
      const pattern = dataService.getPattern(args.type);
      if (!pattern) return { error: `패턴 '${args.type}'를 찾을 수 없습니다.` };
      return pattern;
    }

    case 'get_doc': {
      if (!args.slug) return dataService.getDocIndex();
      const doc = dataService.getDoc(args.slug);
      if (!doc) return { error: `문서 '${args.slug}'를 찾을 수 없습니다.` };
      return doc;
    }

    case 'search_docs': {
      const limit = args.limit || 10;
      const index = dataService.getDocIndex();
      const allDocs = [];
      for (const [category, docList] of Object.entries(index.categories || {})) {
        for (const doc of docList) {
          allDocs.push({ ...doc, category });
        }
      }
      const query = args.query.toLowerCase();
      const matched = allDocs.filter(d =>
        d.title.toLowerCase().includes(query) ||
        d.slug.toLowerCase().includes(query)
      );
      const results = matched.slice(0, limit).map(d => {
        const detail = dataService.getDoc(d.slug);
        return {
          slug: d.slug,
          title: d.title,
          category: d.category,
          excerpt: detail ? (detail.content || '').substring(0, 200) + '...' : ''
        };
      });
      return { query: args.query, total: matched.length, results };
    }

    default:
      return { error: `알 수 없는 도구: ${name}` };
  }
}
