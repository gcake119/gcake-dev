/** Publication dates are normalized to an exact instant; legacy dates begin at Taipei midnight. */
export function taipeiDay(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(date);
}

export function isPublishedDate(date?: Date, now = new Date()): boolean {
  return !date || (Number.isFinite(date.getTime()) && date.getTime() <= now.getTime());
}

export interface ParsedPublicationTime {
  readonly representation: 'legacy-date' | 'offset-date-time';
  readonly source: string;
  readonly instant: Date;
}

const LEGACY_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const OFFSET_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export function parsePublicationTime(source: string): ParsedPublicationTime {
  const legacy = LEGACY_DATE.exec(source);
  const representation = legacy ? 'legacy-date' : OFFSET_DATE_TIME.test(source) ? 'offset-date-time' : undefined;
  if (!representation) throw new Error('INVALID_PUBLICATION_TIME');
  const normalized = representation === 'legacy-date' ? `${source}T00:00:00+08:00` : source;
  const instant = new Date(normalized);
  if (!Number.isFinite(instant.getTime())) throw new Error('INVALID_PUBLICATION_TIME');
  if (legacy) {
    const [year, month, day] = legacy.slice(1).map(Number);
    if (taipeiDay(instant) !== `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`) {
      throw new Error('INVALID_PUBLICATION_TIME');
    }
  }
  return { representation, source, instant };
}

export function serializeTaipeiSchedule(date: string, time: string): string {
  const value = `${date}T${time}:00+08:00`;
  parsePublicationTime(value);
  return value;
}

export function isPublicPost(
  post: { readonly status: string; readonly publishedAt?: Date },
  now = new Date(),
): boolean {
  return post.status === 'published' && isPublishedDate(post.publishedAt, now);
}

export function publicationStatus(
  editorial: string,
  publication?: { status: 'active' | 'completed' | 'paused'; endsAt?: string },
  now = new Date(),
): 'active' | 'completed' | 'paused' {
  if (publication) {
    if (publication.status === 'paused') return 'paused';
    if (publication.endsAt) return publication.endsAt <= taipeiDay(now) ? 'completed' : 'active';
    return publication.status;
  }
  return editorial === 'active' ? 'active' : 'completed';
}
