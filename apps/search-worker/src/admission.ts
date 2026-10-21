export type Units = {
    requests: number;
    tokens: number;
    units: number;
    vectorQueries: number;
    worker: number;
    admission: number;
    storage: number;
};
export const unitNames = ['requests', 'tokens', 'units', 'vectorQueries', 'worker', 'admission', 'storage'] as const;
const validReservation = (cost: Units, limits: Units) => unitNames.every(k => Number.isFinite(cost[k]) && cost[k] >= 0 && Number.isFinite(limits[k]) && limits[k] > 0 && cost[k] <= limits[k]);
export interface Admission {
    reserve(window: string, key: string, cost: Units, limits: Units, now: number): Promise<boolean>;
}
/** Offline fixture only. Production always requires durable atomic storage. */
export class MemoryAdmission implements Admission {
    available = true;
    private used = new Map<string, Units>();
    private clients = new Map<string, {
        count: number;
        expires: number;
    }>();
    async reserve(window: string, key: string, cost: Units, limits: Units, now: number) {
        if (!this.available)
            throw new Error('ADMISSION_UNAVAILABLE');
        if (!validReservation(cost, limits)) return false;
        for (const [k, v] of this.clients)
            if (v.expires < now)
                this.clients.delete(k);
        const used = this.used.get(window) ?? { requests: 0, tokens: 0, units: 0, vectorQueries: 0, worker: 0, admission: 0, storage: 0 }, client = this.clients.get(key);
        if ((client?.count ?? 0) >= 10)
            return false;
        if ((Object.keys(cost) as (keyof Units)[]).some(k => !Number.isFinite(limits[k]) || limits[k] <= 0 || used[k] + cost[k] > limits[k]))
            return false;
        this.used.set(window, Object.fromEntries(Object.keys(cost).map(k => [k, used[k as keyof Units] + cost[k as keyof Units]])) as Units);
        this.clients.set(key, { count: (client?.count ?? 0) + 1, expires: now + 600000 });
        return true;
    }
}
export interface Prepared {
    bind(...values: unknown[]): Prepared;
    first<T>(): Promise<T | null>;
    run(): Promise<unknown>;
}
export interface AdmissionDatabase {
    prepare(sql: string): Prepared;
}
/** One INSERT plus transactional SQLite triggers covers quota + throttle together. */
export class D1Admission implements Admission {
    constructor(private db: AdmissionDatabase) { }
    async reserve(window: string, key: string, cost: Units, limits: Units, now: number) {
        if (!validReservation(cost, limits)) return false;
        // Limits come only from a previously verified durable window, never a request.
        await this.db.prepare('DELETE FROM discovery_clients WHERE expires < ?').bind(now).run();
        await this.db.prepare('DELETE FROM discovery_reservations WHERE created < ?').bind(now - 30 * 86400000).run();
        try {
            return !!await this.db.prepare(`INSERT INTO discovery_reservations (id,window,client,created,requests,tokens,units,vectorQueries,worker,admission,storage)
                SELECT ?,?,?,?,?,?,?,?,?,?,? FROM discovery_windows WHERE window=?
                AND requests<=? AND tokens<=? AND units<=? AND vectorQueries<=? AND worker<=? AND admission<=? AND storage<=? RETURNING id`)
                .bind(crypto.randomUUID(), window, key, now, cost.requests, cost.tokens, cost.units, cost.vectorQueries, cost.worker, cost.admission, cost.storage, window, ...unitNames.map(k => limits[k])).first();
        }
        catch (e) {
            if (String(e).includes('QUOTA_EXCEEDED'))
                return false;
            throw e;
        }
    }
}
