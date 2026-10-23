import assert from 'node:assert/strict';
import test from 'node:test';
import type { Article, Connections } from '../src/lib/discovery/types';
// The RED integration log also proves the old page has no consolidated reading guidance.
import { selectEndingRecommendations } from '../src/lib/discovery/article-ending';
const article = (id: string, href = `/gcake-dev/posts/${id}/`) => ({ articleId: id, href, title: id, description: `About ${id}` }) as Article;
const rec = (id: string) => ({ articleId: id, reason: 'existing evidence', evidence: [], score: 1 });
const group = (further: string[], related: string[] = []) => ({ further: further.map(rec), related: related.map(rec), outgoing: [], incoming: [], external: [] }) as Connections;
test('public stable recommendations exclude self, both neighbors, duplicates and unresolved targets', () => {
  const articles = ['self','next','previous','A','B','C'].map(id => article(id));
  const result = selectEndingRecommendations(articles, group(['self','next','previous','A','A','missing'], ['A','B','C']), ['/gcake-dev/posts/self/','/gcake-dev/posts/previous/','/gcake-dev/posts/next/'], true);
  assert.deepEqual(result.map(x => x.title), ['A','B']);
});
test('without a next article, up to three distinct destinations retain original candidate order', () => {
  const articles = [article('A'),article('alias','/gcake-dev/posts/A/'),article('B'),article('C'),article('D')];
  assert.deepEqual(selectEndingRecommendations(articles,group(['A','alias'],['B','C','D']),[],false).map(x=>x.title), ['A','B','C']);
});
test('missing or insufficient recommendations never pad or expose unavailable metadata', () => {
  assert.deepEqual(selectEndingRecommendations([],group(['secret']),[],false),[]);
  assert.deepEqual(selectEndingRecommendations([article('A')],undefined,[],false),[]);
  assert.deepEqual(selectEndingRecommendations([article('A')],group(['A','unpublished']),[],false).map(x=>x.title),['A']);
});
