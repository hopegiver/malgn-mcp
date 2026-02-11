import { Hono } from 'hono';
import { DataService } from '../services/dataService.js';

const docs = new Hono();
const dataService = new DataService();

// GET /docs
docs.get('/', (c) => {
  const index = dataService.getDocIndex();
  return c.json(index);
});

// GET /docs/:slug
docs.get('/:slug', (c) => {
  const slug = c.req.param('slug');
  const doc = dataService.getDoc(slug);

  if (!doc) {
    return c.json({ error: `문서 '${slug}'를 찾을 수 없습니다.` }, 404);
  }

  return c.json(doc);
});

// POST /docs/search
docs.post('/search', async (c) => {
  const body = await c.req.json();

  if (!body.query) {
    return c.json({ error: 'query는 필수입니다.' }, 400);
  }

  const limit = body.limit || 10;
  const index = dataService.getDocIndex();

  // 모든 카테고리의 문서를 평탄화
  const allDocs = [];
  for (const [category, docList] of Object.entries(index.categories || {})) {
    for (const doc of docList) {
      allDocs.push({ ...doc, category });
    }
  }

  // 키워드로 필터 (제목 매칭)
  const query = body.query.toLowerCase();
  const matched = allDocs.filter(d =>
    d.title.toLowerCase().includes(query) ||
    d.slug.toLowerCase().includes(query)
  );

  // 매칭된 문서의 상세 내용을 조회하여 excerpt 추출
  const results = matched.slice(0, limit).map(d => {
    const detail = dataService.getDoc(d.slug);
    return {
      slug: d.slug,
      title: d.title,
      category: d.category,
      excerpt: detail
        ? (detail.content || '').substring(0, 200) + '...'
        : ''
    };
  });

  return c.json({
    query: body.query,
    total: matched.length,
    results
  });
});

export default docs;
