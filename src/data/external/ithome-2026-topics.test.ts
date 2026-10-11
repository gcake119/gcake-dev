import assert from 'node:assert/strict';
import test from 'node:test';
import { ithome2026Topics } from './ithome-2026-topics';
import { loadTopicTaxonomy } from '../../lib/content/topics';

test('all 30 fixed Ironman articles have 1-3 curated topics from the shared taxonomy', async () => {
  const expectedSlugs = Array.from({ length: 30 }, (_, index) => `day-${String(index + 1).padStart(2, '0')}`);
  assert.deepEqual(Object.keys(ithome2026Topics).sort(), expectedSlugs);

  const allowed = new Set((await loadTopicTaxonomy()).map((topic) => topic.id));
  for (const slug of expectedSlugs) {
    const topics = ithome2026Topics[slug];
    assert.ok(topics.length >= 1 && topics.length <= 3, `${slug} must have 1-3 topics`);
    assert.equal(new Set(topics).size, topics.length, `${slug} must not repeat topics`);
    for (const topic of topics) assert.ok(allowed.has(topic), `${slug} uses unknown topic: ${topic}`);
  }
});

test("all local finalized manuscripts use existing topic taxonomy without rewriting prose", async () => {
  const { listLocalPostFiles } = await import("../../lib/content/local-posts");
  const fs = await import("node:fs/promises");
  const { default: matter } = await import("gray-matter");
  const allowed = new Set((await loadTopicTaxonomy()).map((t) => t.id));
  for (const file of await listLocalPostFiles("src/content/posts")) {
    const frontmatter = matter(await fs.readFile(file.path, "utf8")).data;
    for (const topic of frontmatter.topics ?? [])
      assert.ok(allowed.has(topic), `${file.slug} unknown topic ${topic}`);
  }
});
