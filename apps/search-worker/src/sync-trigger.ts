/** Operator-only fixed-source step. No caller-supplied URL, corpus, model or policy. */
export async function authorizeIndexTrigger(request: Request, secret?: string) {
    if (request.method!=='POST' || !secret || secret.length<32) return false;
    const supplied=request.headers.get('Authorization');
    if (!supplied || supplied.length>256) return false;
    const enc=new TextEncoder();
    const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(supplied)),crypto.subtle.digest('SHA-256',enc.encode('Bearer '+secret))]);
    const x=new Uint8Array(a),y=new Uint8Array(b);let different=0;
    for(let i=0;i<x.length;i++) different|=x[i]^y[i];
    return different===0;
}
