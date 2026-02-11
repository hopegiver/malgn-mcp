import _index from './patterns/_index.json';
import daoBasic from './patterns/dao-basic.json';
import daoCustom from './patterns/dao-custom.json';
import htmlForm from './patterns/html-form.json';
import htmlLayout from './patterns/html-layout.json';
import htmlList from './patterns/html-list.json';
import htmlView from './patterns/html-view.json';
import jspAjax from './patterns/jsp-ajax.json';
import jspDelete from './patterns/jsp-delete.json';
import jspInsert from './patterns/jsp-insert.json';
import jspList from './patterns/jsp-list.json';
import jspModify from './patterns/jsp-modify.json';
import jspRestapi from './patterns/jsp-restapi.json';
import jspView from './patterns/jsp-view.json';

export const patternIndex = _index;

export const patternItems = {
  'dao-basic': daoBasic,
  'dao-custom': daoCustom,
  'html-form': htmlForm,
  'html-layout': htmlLayout,
  'html-list': htmlList,
  'html-view': htmlView,
  'jsp-ajax': jspAjax,
  'jsp-delete': jspDelete,
  'jsp-insert': jspInsert,
  'jsp-list': jspList,
  'jsp-modify': jspModify,
  'jsp-restapi': jspRestapi,
  'jsp-view': jspView
};
