import { DataService } from './dataService.js';

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

const dataService = new DataService();

export class ContextService {
  buildContext(body) {
    const neededClasses = new Set();
    const neededPatterns = new Set();

    for (const feature of (body.features || [])) {
      const map = FEATURE_MAP[feature];
      if (map) {
        map.classes.forEach(c => neededClasses.add(c));
        map.patterns.forEach(p => neededPatterns.add(p));
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
