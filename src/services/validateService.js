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
  { pattern: /=\s*\w+\.(find|get|query)\([^)]*\)\s*;\s*\n[^\n]*\w+\.s\(/, code: 'MISSING_NEXT', severity: 'error',
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
