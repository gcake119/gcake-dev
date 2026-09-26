import snapshot from '../data/external/ithome-2026.generated.json';
/** Durable public snapshot, carried forward by each successful Pages deployment. */
export function GET() { return Response.json(snapshot); }
