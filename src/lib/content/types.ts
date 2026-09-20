export type SeriesStatus = 'planned' | 'active' | 'completed' | 'archived';
export type SectionStatus = 'planned' | 'active' | 'completed';
export type PlannedPostStatus = 'planned' | 'draft' | 'ready' | 'published';

export interface SeriesPostRef {
  slug: string;
  status: PlannedPostStatus;
  workingTitle?: string;
}

export interface SeriesSection {
  id: string;
  title: string;
  description?: string;
  status: SectionStatus;
  posts: SeriesPostRef[];
}

export interface EditorialState {
  currentPost?: string;
  nextPost?: string;
}

export interface SeriesManifest {
  slug: string;
  title: string;
  description?: string;
  status: SeriesStatus;
  startedAt?: string;
  endedAt?: string;
  featured?: boolean;
  editorial?: EditorialState;
  source?: {
    type: 'local' | 'external';
    provider?: string;
    repository?: string;
  };
  canonical?: {
    mode: 'local' | 'external';
  };
  sections: SeriesSection[];
}

export interface ExternalPost {
  slug: string;
  title: string;
  description?: string;
  publishedAt?: string;
  canonicalUrl: string;
  body: string;
  source: string;
}
