import type { DeploymentObservation } from '@gcake/admin-contract';

const LEGACY_DATE = /^\d{4}-\d{2}-\d{2}$/;
const OFFSET_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function parsePublicationInstant(source: string): Date {
  const normalized = LEGACY_DATE.test(source) ? `${source}T00:00:00+08:00` : source;
  if (!LEGACY_DATE.test(source) && !OFFSET_DATE_TIME.test(source)) throw new Error('INVALID_PUBLICATION_TIME');
  const instant = new Date(normalized);
  if (!Number.isFinite(instant.getTime())) throw new Error('INVALID_PUBLICATION_TIME');
  const [year, month, day] = source.slice(0, 10).split('-').map(Number);
  if (year !== Number(source.slice(0, 4)) || month < 1 || month > 12 || day < 1 || day > 31) throw new Error('INVALID_PUBLICATION_TIME');
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(instant);
  if (LEGACY_DATE.test(source) && parts !== source) throw new Error('INVALID_PUBLICATION_TIME');
  return instant;
}

export function serializeTaipeiSchedule(date: string, time: string): string {
  const value = `${date}T${time}:00+08:00`;
  const instant = parsePublicationInstant(value);
  const local = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(instant).replace(' ', 'T');
  if (local !== `${date}T${time}`) throw new Error('INVALID_PUBLICATION_TIME');
  return value;
}

export function applyTaipeiSchedule(source: string, date: string, time: string): string {
  const value = serializeTaipeiSchedule(date, time);
  const match = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) throw new Error('INVALID_FRONTMATTER');
  const frontmatter = match[1]!;
  const next = /^publishedAt:/m.test(frontmatter)
    ? frontmatter.replace(/^publishedAt:.*$/m, `publishedAt: ${value}`)
    : `${frontmatter}\npublishedAt: ${value}`;
  return source.replace(match[0], `---\n${next}\n---\n`);
}

export function readScheduleFields(source: string): { date: string; time: string } | undefined {
  const value = source.match(/^publishedAt:\s*["']?([^\s"']+)["']?\s*$/m)?.[1];
  if (!value) return undefined;
  return { date: value.slice(0, 10), time: value.length > 10 ? value.slice(11, 16) : '00:00' };
}

export type ScheduleState = 'scheduled' | 'due-awaiting-build' | 'deployed-visible';

export function schedulePresentation(
  publishedAt: string,
  deployment?: Pick<DeploymentObservation, 'state' | 'completedAt'>,
  now = new Date(),
): { state: ScheduleState; label: string; detail: string } {
  const due = parsePublicationInstant(publishedAt);
  if (due.getTime() > now.getTime()) return {
    state: 'scheduled', label: '已排程', detail: '到達台北時間後，仍要等待一次成功的靜態部署才會出現在公開網站。',
  };
  const deployedAfterDue = deployment?.state === 'deployed'
    && !!deployment.completedAt
    && new Date(deployment.completedAt).getTime() >= due.getTime();
  if (!deployedAfterDue) return {
    state: 'due-awaiting-build', label: '時間已到，等待部署', detail: '排程時間已到，但尚無排程後完成的部署，因此不能視為已公開。',
  };
  return {
    state: 'deployed-visible', label: '排程後部署已完成', detail: '排程時間已到，後續部署也已完成；仍需以公開頁面驗證最終結果。',
  };
}
