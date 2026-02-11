import { Hono } from 'hono';
import { DataService } from '../services/dataService.js';

const rules = new Hono();
const dataService = new DataService();

// 체크리스트 (코드 내장)
const CHECKLIST = {
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

// GET /rules
rules.get('/', (c) => {
  const category = c.req.query('category');

  if (category) {
    const categoryRules = dataService.getRules(category);
    if (!categoryRules) {
      return c.json({ error: `카테고리 '${category}' 규칙을 찾을 수 없습니다.` }, 404);
    }
    return c.json(categoryRules);
  }

  const allRules = dataService.getRules('all');
  return c.json(allRules);
});

// GET /rules/checklist
rules.get('/checklist', (c) => {
  return c.json(CHECKLIST);
});

export default rules;
