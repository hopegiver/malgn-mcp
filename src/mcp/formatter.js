// 도구 결과를 LLM 친화적 마크다운 텍스트로 변환

export function formatToolResult(toolName, result) {
  // 에러 응답 공통 처리
  if (result && result.error) {
    return `[ERROR] ${result.error}`;
  }

  switch (toolName) {
    case 'get_context': return formatContext(result);
    case 'validate_code': return formatValidation(result);
    case 'get_class': return formatClass(result);
    case 'get_rules': return formatRules(result);
    case 'get_pattern': return formatPattern(result);
    case 'get_doc': return formatDoc(result);
    case 'search_docs': return formatSearchDocs(result);
    default: return JSON.stringify(result, null, 2);
  }
}

// ── get_context ──

function formatContext(result) {
  const lines = [];
  lines.push(`# 작업 컨텍스트: ${result.task}`);
  const ctx = result.context || {};

  // 규칙
  if (ctx.rules) {
    if (ctx.rules.critical && ctx.rules.critical.length > 0) {
      lines.push('', '## 필수 규칙 (error)');
      for (const r of ctx.rules.critical) {
        lines.push(`- **[${r.id}]** ${r.rule}`);
        if (r.correct) lines.push(`  - O: \`${r.correct}\``);
        if (r.incorrect) lines.push(`  - X: \`${r.incorrect}\``);
      }
    }
    if (ctx.rules.relevant && ctx.rules.relevant.length > 0) {
      lines.push('', '## 참고 규칙 (warning)');
      for (const r of ctx.rules.relevant) {
        lines.push(`- **[${r.id}]** ${r.rule}`);
        if (r.correct) lines.push(`  - O: \`${r.correct}\``);
        if (r.incorrect) lines.push(`  - X: \`${r.incorrect}\``);
      }
    }
  }

  // 클래스 정보
  if (ctx.class_info && Object.keys(ctx.class_info).length > 0) {
    lines.push('', '## 클래스 정보');
    for (const [name, info] of Object.entries(ctx.class_info)) {
      lines.push('', `### ${name}`);
      if (info.description) lines.push(`> ${info.description}`);
      if (info.key_methods && info.key_methods.length > 0) {
        lines.push('');
        for (const m of info.key_methods) {
          lines.push(`- \`${m}\``);
        }
      }
    }
  }

  // 패턴
  if (ctx.patterns && Object.keys(ctx.patterns).length > 0) {
    lines.push('', '## 코드 패턴');
    for (const [type, pat] of Object.entries(ctx.patterns)) {
      lines.push('', `### ${type}: ${pat.title || type}`);
      if (pat.variables) {
        lines.push('', '**변수:**');
        for (const [k, v] of Object.entries(pat.variables)) {
          lines.push(`- \`${k}\`: ${v.description} (예: ${v.example})`);
        }
      }
      if (pat.jsp_template) {
        lines.push('', '**JSP:**', '```jsp', pat.jsp_template, '```');
      }
      if (pat.html_template) {
        lines.push('', '**HTML:**', '```html', pat.html_template, '```');
      }
      if (pat.code) {
        lines.push('', '**코드:**', '```java', pat.code, '```');
      }
      if (pat.notes && pat.notes.length > 0) {
        lines.push('', '**참고:**');
        for (const n of pat.notes) {
          lines.push(`- ${n}`);
        }
      }
    }
  }

  // 체크리스트
  if (ctx.checklist && ctx.checklist.length > 0) {
    lines.push('', '## 체크리스트');
    for (const item of ctx.checklist) {
      lines.push(`- [ ] ${item}`);
    }
  }

  return lines.join('\n');
}

// ── validate_code ──

function formatValidation(result) {
  const lines = [];
  const status = result.status === 'ok' ? 'OK' : 'ERROR';
  lines.push(`# 코드 검증 결과: ${status}`);

  const s = result.summary || {};
  const parts = [];
  if (s.errors) parts.push(`errors: ${s.errors}`);
  if (s.warnings) parts.push(`warnings: ${s.warnings}`);
  if (s.info) parts.push(`info: ${s.info}`);
  lines.push(`총 ${result.total_issues}건 (${parts.join(', ')})`);

  if (!result.issues || result.issues.length === 0) {
    lines.push('', '위반 사항 없음.');
    return lines.join('\n');
  }

  // severity별 그룹핑
  const errors = result.issues.filter(i => i.severity === 'error');
  const warnings = result.issues.filter(i => i.severity === 'warning');
  const infos = result.issues.filter(i => i.severity === 'info');

  if (errors.length > 0) {
    lines.push('', '## ERRORS');
    for (const i of errors) {
      formatIssue(lines, i);
    }
  }

  if (warnings.length > 0) {
    lines.push('', '## WARNINGS');
    for (const i of warnings) {
      formatIssue(lines, i);
    }
  }

  if (infos.length > 0) {
    lines.push('', '## INFO');
    for (const i of infos) {
      formatIssue(lines, i);
    }
  }

  return lines.join('\n');
}

function formatIssue(lines, i) {
  lines.push(`- Line ${i.line}:${i.column || ''} [${i.ruleId}] ${i.message}`);
  if (i.fix && i.matched) {
    lines.push(`  fix: \`${i.matched}\` -> \`${i.fix}\``);
  } else if (i.suggestion) {
    lines.push(`  -> ${i.suggestion}`);
  }
}

// ── get_class ──

function formatClass(result) {
  // 상세 모드: methods 필드 존재
  if (result.methods) {
    return formatClassDetail(result);
  }
  // 목록 모드
  return formatClassList(result);
}

function formatClassDetail(cls) {
  const lines = [];
  lines.push(`# ${cls.name}${cls.fullClassName ? ` (${cls.fullClassName})` : ''}`);
  if (cls.description) lines.push(`> ${cls.description}`);
  lines.push('');

  const meta = [];
  if (cls.variable_name) meta.push(`변수명: \`${cls.variable_name}\``);
  if (cls.initialization) meta.push(`초기화: \`${cls.initialization}\``);
  if (cls.initialized_in) meta.push(`초기화 위치: ${cls.initialized_in}`);
  if (meta.length > 0) lines.push(meta.join(' | '));

  if (cls.methods && cls.methods.length > 0) {
    lines.push('', `## 메소드 (${cls.methods.length}개)`);
    for (const m of cls.methods) {
      lines.push('', `### ${m.signature || m.name}`);
      if (m.description) lines.push(m.description);
      if (m.usage) lines.push(`- 사용: \`${m.usage}\``);
      if (m.notes) lines.push(`- 참고: ${m.notes}`);
      if (m.related && m.related.length > 0) {
        lines.push(`- 관련: ${m.related.join(', ')}`);
      }
    }
  }

  return lines.join('\n');
}

function formatClassList(result) {
  const lines = [];
  lines.push(`# 맑은프레임워크 클래스 목록 (${result.total || ''}개)`);

  if (result.categories) {
    // 카테고리별로 표시
    for (const [cat, names] of Object.entries(result.categories)) {
      lines.push('', `## ${cat} (${names.length}개)`);
      const classesInCat = (result.classes || []).filter(c => c.category === cat);
      for (const c of classesInCat) {
        lines.push(`- \`${c.name}\` (${c.variable_name}) - ${c.description} [${c.method_count}개 메소드]`);
      }
    }
  } else if (result.classes) {
    // 카테고리 필터 적용된 경우
    for (const c of result.classes) {
      lines.push(`- \`${c.name}\` (${c.variable_name}) - ${c.description} [${c.method_count}개 메소드]`);
    }
  }

  lines.push('', '상세 조회: get_class(name: "클래스명")');
  return lines.join('\n');
}

// ── get_rules ──

function formatRules(result) {
  // 체크리스트 모드
  if (result.sections) {
    return formatChecklist(result);
  }
  // 일반 규칙
  return formatRuleList(result);
}

function formatChecklist(result) {
  const lines = [];
  lines.push('# 코드리뷰 체크리스트');

  for (const section of result.sections) {
    lines.push('', `## ${section.title}`);
    for (const item of section.items) {
      const tag = item.severity === 'error' ? 'MUST' : item.severity === 'warning' ? 'SHOULD' : 'TIP';
      lines.push(`- [${tag}] ${item.text}`);
    }
  }

  return lines.join('\n');
}

function formatRuleList(result) {
  const lines = [];
  const total = result.total || (result.rules || []).length;
  lines.push(`# 코딩 규칙 (${total}개)`);

  if (!result.rules || result.rules.length === 0) {
    lines.push('', '규칙 없음.');
    return lines.join('\n');
  }

  for (const r of result.rules) {
    const sev = r.severity === 'error' ? 'ERROR' : r.severity === 'warning' ? 'WARN' : 'INFO';
    lines.push('', `## [${sev}] ${r.title} (${r.id})`);
    lines.push(`- 규칙: ${r.rule}`);
    if (r.correct) lines.push(`- 올바른 예: \`${r.correct}\``);
    if (r.incorrect) lines.push(`- 잘못된 예: \`${r.incorrect}\``);
  }

  return lines.join('\n');
}

// ── get_pattern ──

function formatPattern(result) {
  // 목록 모드: categories 존재
  if (result.categories) {
    return formatPatternList(result);
  }
  // 상세 모드
  return formatPatternDetail(result);
}

function formatPatternList(result) {
  const lines = [];
  lines.push(`# 코드 패턴 목록 (${result.total || ''}개)`);

  for (const [cat, items] of Object.entries(result.categories)) {
    lines.push('', `## ${cat.toUpperCase()}`);
    for (const p of items) {
      lines.push(`- \`${p.type}\` - ${p.title}: ${p.description}`);
    }
  }

  lines.push('', '상세 조회: get_pattern(type: "패턴타입")');
  return lines.join('\n');
}

function formatPatternDetail(pat) {
  const lines = [];
  lines.push(`# 패턴: ${pat.type} (${pat.title || ''})`);

  if (pat.variables) {
    lines.push('', '## 변수');
    for (const [k, v] of Object.entries(pat.variables)) {
      lines.push(`- \`${k}\`: ${v.description} (예: ${v.example})`);
    }
  }

  if (pat.jsp_template) {
    lines.push('', '## JSP 템플릿', '```jsp', pat.jsp_template, '```');
  }

  if (pat.html_template) {
    lines.push('', '## HTML 템플릿', '```html', pat.html_template, '```');
  }

  if (pat.code) {
    lines.push('', '## 코드', '```java', pat.code, '```');
  }

  if (pat.notes && pat.notes.length > 0) {
    lines.push('', '## 참고');
    for (const n of pat.notes) {
      lines.push(`- ${n}`);
    }
  }

  return lines.join('\n');
}

// ── get_doc ──

function formatDoc(result) {
  // 목록 모드
  if (result.categories) {
    return formatDocList(result);
  }
  // 상세 모드: content 존재
  return formatDocDetail(result);
}

function formatDocList(result) {
  const lines = [];
  lines.push(`# 맑은프레임워크 문서 목록 (${result.total || ''}개)`);

  for (const [cat, docs] of Object.entries(result.categories)) {
    lines.push('', `## ${cat}`);
    for (const d of docs) {
      lines.push(`- \`${d.slug}\` - ${d.title}`);
    }
  }

  lines.push('', '상세 조회: get_doc(slug: "문서slug")');
  return lines.join('\n');
}

function formatDocDetail(doc) {
  const lines = [];
  lines.push(`[slug: ${doc.slug} | category: ${doc.category || ''}]`);

  if (doc.content) {
    lines.push('', doc.content);
  } else {
    lines.push('', `# ${doc.title || doc.slug}`);
    if (doc.sections && doc.sections.length > 0) {
      for (const s of doc.sections) {
        lines.push('', `## ${s.heading}`, s.content);
      }
    }
  }

  return lines.join('\n');
}

// ── search_docs ──

function formatSearchDocs(result) {
  const lines = [];
  const showing = (result.results || []).length;
  lines.push(`# 문서 검색결과: "${result.query}" (${showing}건 / 총 ${result.total}건)`);

  if (!result.results || result.results.length === 0) {
    lines.push('', '검색 결과 없음.');
    return lines.join('\n');
  }

  for (let i = 0; i < result.results.length; i++) {
    const r = result.results[i];
    lines.push('', `${i + 1}. **${r.title}** [slug: \`${r.slug}\`, category: ${r.category}]`);
    if (r.excerpt) {
      lines.push(`   > ${r.excerpt}`);
    }
  }

  lines.push('', '상세 조회: get_doc(slug: "slug값")');
  return lines.join('\n');
}
