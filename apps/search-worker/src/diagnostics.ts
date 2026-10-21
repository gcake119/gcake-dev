export type FailureStage = 'request' | 'configuration' | 'policy' | 'source_initial' | 'admission' | 'embedding' | 'vector' | 'ranking' | 'source_final';
export type FailureReason = 'failure' | 'timeout' | 'invalid_response' | 'ineligible';

/** Only locally assigned codes cross the response boundary; never serialize an upstream error. */
export class SearchFailure extends Error {
    constructor(readonly reason: FailureReason, message: string = reason) { super(message); }
}
export function failureReason(error: unknown): FailureReason {
    return error instanceof SearchFailure ? error.reason : 'failure';
}
/** Response-only, with no input-derived ID, logger, storage or external calls. */
export function unavailableResponse(stage: FailureStage, reason: FailureReason, requestId = crypto.randomUUID(), headers?: HeadersInit) {
    const responseHeaders = new Headers(headers);
    responseHeaders.set('X-Search-Request-Id', requestId);
    responseHeaders.set('Cache-Control', 'no-store');
    return Response.json({ code: 'SERVICE_UNAVAILABLE', retryable: true, fallback: 'keyword', diagnostic: { requestId, stage, reason } }, { status: 503, headers: responseHeaders });
}
