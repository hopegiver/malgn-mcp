import { DataService } from './dataService.js';

// feature → 필요한 클래스/패턴/규칙 매핑
const FEATURE_MAP = {
  list:    { classes: ['ListManager', 'DataObject', 'Form'], patterns: ['jsp-list', 'html-list'],
             rule_categories: ['naming', 'data', 'style', 'template', 'structure'] },
  insert:  { classes: ['DataObject', 'Form', 'Page'], patterns: ['jsp-insert', 'html-form', 'dao-basic'],
             rule_categories: ['naming', 'postback', 'parameter', 'structure', 'security', 'template'] },
  modify:  { classes: ['DataObject', 'Form', 'Page'], patterns: ['jsp-modify', 'html-form'],
             rule_categories: ['naming', 'postback', 'parameter', 'structure', 'security', 'template'] },
  delete:  { classes: ['DataObject'], patterns: ['jsp-delete'],
             rule_categories: ['naming', 'data', 'security'] },
  view:    { classes: ['DataObject', 'Page'], patterns: ['jsp-view', 'html-view'],
             rule_categories: ['naming', 'data', 'template', 'structure'] },
  search:  { classes: ['ListManager', 'Form'], patterns: ['jsp-list', 'html-list'],
             rule_categories: ['naming', 'data', 'style', 'parameter'] },
  paging:  { classes: ['ListManager'], patterns: ['jsp-list'],
             rule_categories: ['data', 'style'] },
  ajax:    { classes: ['Json', 'Form'], patterns: ['jsp-ajax'],
             rule_categories: ['ajax', 'parameter', 'security'] },
  restapi: { classes: ['RestAPI', 'Json'], patterns: ['jsp-restapi'],
             rule_categories: ['ajax', 'security', 'parameter'] },
  upload:  { classes: ['Form', 'FileManager'], patterns: ['jsp-insert'],
             rule_categories: ['parameter', 'security', 'postback'] },
  auth:    { classes: ['Auth'], patterns: [],
             rule_categories: ['security'] }
};

const dataService = new DataService();

export class ContextService {
  buildContext(body) {
    const neededClasses = new Set();
    const neededPatterns = new Set();
    const neededRuleCategories = new Set();

    for (const feature of (body.features || [])) {
      const map = FEATURE_MAP[feature];
      if (map) {
        map.classes.forEach(c => neededClasses.add(c));
        map.patterns.forEach(p => neededPatterns.add(p));
        (map.rule_categories || []).forEach(c => neededRuleCategories.add(c));
      }
    }

    for (const cls of (body.include_class_info || [])) {
      neededClasses.add(cls);
    }

    const classData = {};
    for (const name of neededClasses) {
      const data = dataService.getClass(name);
      if (data) classData[name] = data;
    }

    const patternData = {};
    if (body.include_patterns !== false) {
      for (const type of neededPatterns) {
        const data = dataService.getPattern(type);
        if (data) patternData[type] = data;
      }
    }

    const rules = body.include_rules !== false
      ? dataService.getRules('all')
      : null;

    return {
      task: body.task,
      context: {
        rules: rules ? this.extractRules(rules, neededRuleCategories) : undefined,
        patterns: body.include_patterns !== false ? patternData : undefined,
        class_info: this.simplifyClassInfo(classData),
        checklist: this.buildChecklist(body)
      }
    };
  }

  extractRules(allRules, neededCategories) {
    if (!allRules) return null;

    const rules = allRules.rules || [];
    // feature가 지정되면 관련 카테고리만, 아니면 전체
    const filtered = neededCategories.size > 0
      ? rules.filter(r => neededCategories.has(r.category))
      : rules;

    const mapRule = r => ({
      id: r.id,
      rule: r.rule,
      correct: r.correct || null,
      incorrect: r.incorrect || null
    });

    return {
      critical: filtered.filter(r => r.severity === 'error').map(mapRule),
      relevant: filtered.filter(r => r.severity === 'warning').map(mapRule)
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
