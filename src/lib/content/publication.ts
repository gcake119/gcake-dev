/** Publication dates are compared as calendar days in the publishing timezone. */
export function taipeiDay(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(date);
}

export function isPublishedDate(date?: Date, now = new Date()): boolean {
  return !date || (Number.isFinite(date.getTime()) && taipeiDay(date) <= taipeiDay(now));
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
