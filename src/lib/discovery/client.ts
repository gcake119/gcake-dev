import { browserDeadlineMs } from './deadlines';
import { normalize, search, tokenize } from './search';
import type { Corpus, Passage, SearchResult } from './types';
export function highlight(node: HTMLElement, text: string, query: string) {
    const terms = [query, ...tokenize(query)].filter(Boolean).sort((a, b) => b.length - a.length);
    const chars = [...text];
    let plain = '';
    const flush = () => {
        if (plain) {
            node.append(document.createTextNode(plain));
            plain = '';
        }
    };
    for (let i = 0; i < chars.length;) {
        const rest = chars.slice(i).join(''), term = terms.find(t => normalize(rest).startsWith(normalize(t)));
        if (term) {
            flush();
            const mark = document.createElement('mark'), len = [...term].length;
            mark.textContent = chars.slice(i, i + len).join('');
            node.append(mark);
            i += len;
        }
        else
            plain += chars[i++];
    }
    flush();
}
export function installSearch() {
    const status = document.querySelector<HTMLElement>('#search-status')!, results = document.querySelector<HTMLElement>('#search-results')!, pagination = document.querySelector<HTMLElement>('#search-pagination')!, retry = document.querySelector<HTMLButtonElement>('#search-retry')!;
    let corpus: Corpus | undefined, manifest: {
        corpusId: string;
        assets: Record<string, {
            href: string;
            digest: string;
        }>;
    } | undefined, request = 0, abort: AbortController | undefined;
    const read = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
        const r = await fetch(url, { signal });
        if (!r.ok)
            throw new Error('INDEX_UNAVAILABLE');
        return r.json();
    };
    const readCorpus = async (signal: AbortSignal) => {
        const nextManifest = await read<NonNullable<typeof manifest>>(results.dataset.manifest!, signal);
        const nextCorpus = await read<Corpus>(nextManifest.assets.index.href, signal);
        const passages = await read<Passage[]>(nextManifest.assets.passages.href, signal);
        if (nextCorpus.corpusId !== nextManifest.corpusId)
            throw new Error('CORPUS_MISMATCH');
        nextCorpus.passages = passages;
        return { manifest: nextManifest, corpus: nextCorpus };
    };
    const change = (key: string, value: string) => {
        const u = new URL(location.href);
        u.searchParams.set(key, value);
        if (key !== 'page')
            u.searchParams.set('page', '1');
        history.pushState(null, '', u);
        void run();
    };
    window.addEventListener('popstate', () => void run());
    retry.addEventListener('click', () => void run());
    function render(rows: SearchResult[], q: string) {
        results.replaceChildren();
        for (const row of rows) {
            const item = document.createElement('li');
            item.className = 'post-row';
            const heading = document.createElement('h2');
            heading.className = 'search-result-title';
            const a = document.createElement('a');
            a.href = row.readingHref;
            highlight(a, row.title, q);
            heading.append(a);
            const context = document.createElement('p');
            context.className = 'series-label';
            const base=results.dataset.manifest!.replace('/discovery-manifest.json','');
            const article=corpus?.articles.find(a=>a.articleId===row.articleId);
            if(article?.series){const link=document.createElement('a');link.href=`${base}/series/${encodeURIComponent(article.series)}/`;link.textContent=row.series;context.append(link);}else context.textContent=row.series;
            const excerpt = document.createElement('p');
            highlight(excerpt, row.excerpt, q);
            item.append(heading, context, excerpt);
            results.append(item);
        }
    }
    function renderPagination(found: ReturnType<typeof search>) {
        pagination.replaceChildren();
        for (const [label, page] of [['上一頁', found.page - 1], ['下一頁', found.page + 1]] as const)
            if (page >= 1 && page <= Math.ceil(found.total / 10)) {
                const a = document.createElement('a'), u = new URL(location.href);
                u.searchParams.set('page', String(page));
                a.href = u.href;
                a.textContent = label;
                a.addEventListener('click', e => { e.preventDefault(); change('page', String(page)); });
                pagination.append(a);
            }
    }
    async function run() {
        const current = ++request;
        abort?.abort();
        abort = new AbortController();
        const signal = abort.signal;
        results.replaceChildren();
        pagination.replaceChildren();
        retry.hidden = true;
        const params = new URLSearchParams(location.search), q = (params.get('q') ?? '').trim();
        let corrected = false;
        try {
            decodeURIComponent(location.search.replace(/\+/g, ' '));
        }
        catch {
            corrected = true;
        }
        for (const key of ['topic', 'series', 'sort']) if (params.has(key)) { params.delete(key); corrected = true; }
        if (corrected) history.replaceState(null, '', '?' + params);
        const input = document.querySelector<HTMLInputElement>('.nav-search input');
        if (input)
            input.value = q;
        if (!q) {
            status.textContent = '在導覽列輸入關鍵字，搜尋已公開的文章。';
            return;
        }
        if ([...q].length > 200) {
            status.textContent = '請將搜尋內容縮短至 200 個字以內。';
            return;
        }
        status.textContent = '搜尋中…';
        try {
            if (!corpus) {
                const loaded = await readCorpus(signal);
                if (current !== request || signal.aborted) return;
                manifest = loaded.manifest;
                corpus = loaded.corpus;
            }
            if (current !== request)
                return;
            const options = { topic: '', series: '', page: Number(params.get('page') ?? 1), sort: 'relevance' };
            const lexical = search(corpus, q, options);
            let found = lexical, notice = '', semanticSucceeded = false;
            render(lexical.results, q);
            status.textContent = lexical.total ? `找到 ${lexical.total} 篇文章${lexical.partial ? '（部分符合）' : ''}，第 ${lexical.page} 頁。` : '找不到相關文章，試試其他關鍵字或說法。';
            renderPagination(lexical);
            if (results.dataset.semantic || results.dataset.localSemantic === 'true' || params.get('mode') === 'semantic') {
                notice = '依意思搜尋暫時無法使用，已顯示關鍵字結果。';
                if (results.dataset.semantic) {
                    let timer: ReturnType<typeof setTimeout> | undefined;
                    let releaseConflict = false;
                    try {
                        const activeAbort = abort!;
                        timer = setTimeout(() => activeAbort.abort(), browserDeadlineMs);
                        const r = await fetch(results.dataset.semantic, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q, corpusId: corpus.corpusId, ...options, sort: options.sort, limit: 10 }), signal });
                        if (r.status === 409) releaseConflict = true;
                        if (!r.ok)
                            throw new Error('SEMANTIC_UNAVAILABLE');
                        const remote = await r.json();
                        if (current !== request || signal.aborted)
                            return;
                        const latest = await read<{
                            corpusId: string;
                        }>(results.dataset.manifest!, signal);
                        if (latest.corpusId !== corpus.corpusId || remote.corpusId !== corpus.corpusId) {
                            releaseConflict = true;
                            throw new Error('CORPUS_MISMATCH');
                        }
                        const ids = new Set(corpus.articles.filter(a => (!options.topic || a.topics.includes(options.topic)) && (!options.series || a.series === options.series)).map(a => a.articleId));
                        if (remote.mode !== 'hybrid' || !Number.isSafeInteger(remote.total) || remote.total < 0 || remote.total > 50
                            || !Number.isSafeInteger(remote.page) || remote.page < 1 || remote.page > Math.max(1, Math.ceil(remote.total / 10))
                            || !Array.isArray(remote.results) || remote.results.length !== Math.min(10, Math.max(0, remote.total - (remote.page - 1) * 10))
                            || remote.results.some((r: SearchResult) => !r || !ids.has(r.articleId))
                            || new Set(remote.results.map((r: SearchResult) => r.articleId)).size !== remote.results.length)
                            throw new Error('INVALID_RESULT');
                        const checked = remote.results.map((r: SearchResult) => { const a = corpus!.articles.find(a => a.articleId === r.articleId)!, p = corpus!.passages.find(p => p.passageId === r.passageId && p.articleId === a.articleId && p.revision === a.sourceRevision); return { ...r, title: a.title, readingHref: p?.href ?? a.href, excerpt: [...(p?.text ?? a.description)].slice(0, 120).join(''), series: a.seriesTitle, topics: a.topics }; });
                        found = { ...lexical, ...remote, results: checked.slice(0, 10), partial: false };
                        semanticSucceeded = true;
                        notice = results.dataset.localSemantic === 'true' ? '' : '依意思搜尋結果。';
                    }
                    catch {
                        if (current !== request) return;
                        if (releaseConflict) {
                            // A known release change makes the old rows unsafe as fallback.
                            corpus = undefined;
                            manifest = undefined;
                            results.replaceChildren();
                            pagination.replaceChildren();
                            const loaded = await readCorpus(signal);
                            if (current !== request || signal.aborted) return;
                            manifest = loaded.manifest;
                            corpus = loaded.corpus;
                            found = search(corpus, q, options);
                        }
                    }
                    finally {
                        clearTimeout(timer);
                    }
                }
                retry.hidden = semanticSucceeded;
            }
            if (current !== request)
                return;
            render(found.results, q);
            if (found.page !== options.page) {
                params.set('page', String(found.page));
                corrected = true;
            }
            if (corrected)
                history.replaceState(null, '', '?' + params);
            status.textContent = notice + (found.total ? `找到 ${found.total} 篇文章${found.partial ? '（部分符合）' : ''}，第 ${found.page} 頁。` : '找不到相關文章，試試其他關鍵字或說法。');
            renderPagination(found);
        }
        catch {
            if (current === request) {
                results.replaceChildren();
                pagination.replaceChildren();
                manifest = undefined;
                status.textContent = '搜尋暫時無法載入，請重試，或前往系列與主題總覽。';
                retry.hidden = false;
                corpus = undefined;
            }
        }
    }
    void run();
}
