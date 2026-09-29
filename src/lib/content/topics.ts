import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

export interface TopicDefinition {
  id: string;
  label: string;
  labelEn: string;
}

interface TopicFile {
  topics?: TopicDefinition[];
}

const topicFile = path.resolve('src/data/topics.yaml');

export async function loadTopicTaxonomy(): Promise<TopicDefinition[]> {
  const raw = await fs.readFile(topicFile, 'utf8');
  const parsed = YAML.parse(raw) as TopicFile;
  return parsed.topics ?? [];
}

export async function topicMap(): Promise<Map<string, TopicDefinition>> {
  return new Map((await loadTopicTaxonomy()).map((topic) => [topic.id, topic]));
}
