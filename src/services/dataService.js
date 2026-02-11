import { classIndex, classItems } from '../data/classes.js';
import { docIndex, docItems } from '../data/docs.js';
import { ruleItems } from '../data/rules.js';
import { patternIndex, patternItems } from '../data/patterns.js';

export class DataService {
  getClassIndex() {
    return classIndex;
  }

  getClass(name) {
    return classItems[name] || null;
  }

  getDocIndex() {
    return docIndex;
  }

  getDoc(slug) {
    return docItems[slug] || null;
  }

  getRules(category = 'all') {
    return ruleItems[category] || null;
  }

  getPatternIndex() {
    return patternIndex;
  }

  getPattern(type) {
    return patternItems[type] || null;
  }

  getMultiple(keys) {
    return keys.map(key => {
      const [prefix, id] = key.split(':');
      switch (prefix) {
        case 'class': return this.getClass(id);
        case 'doc': return this.getDoc(id);
        case 'rules': return this.getRules(id);
        case 'pattern': return this.getPattern(id);
        default: return null;
      }
    });
  }
}
