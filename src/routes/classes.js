import { Hono } from 'hono';
import { DataService } from '../services/dataService.js';

const classes = new Hono();
const dataService = new DataService();

// GET /classes
classes.get('/', (c) => {
  const index = dataService.getClassIndex();

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
classes.get('/:name', (c) => {
  const name = c.req.param('name');
  const classInfo = dataService.getClass(name);

  if (!classInfo) {
    return c.json({ error: `클래스 '${name}'를 찾을 수 없습니다.` }, 404);
  }

  // ?method= 필터 (원본 데이터 보호를 위해 복사)
  const methodFilter = c.req.query('method');
  if (methodFilter) {
    const filtered = { ...classInfo };
    filtered.methods = classInfo.methods.filter(
      m => m.name.toLowerCase().includes(methodFilter.toLowerCase())
    );
    return c.json(filtered);
  }

  return c.json(classInfo);
});

export default classes;
