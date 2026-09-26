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
  publication?: {
    status: 'active' | 'completed' | 'paused';
    /** Date of final public installment; distinct from manuscript completion. */
    endsAt?: string;
  };
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
  day: number;
  sourceUrl: string;
  markdown: string;
  title: string;
  description?: string;
  publishedAt?: string;
  canonicalUrl: string;
}
