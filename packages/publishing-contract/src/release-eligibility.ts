/**
 * Pure, fail-closed preparation for the release planner.
 *
 * Input MUST describe the entire local Git snapshot (all series manifests and
 * local Markdown posts), not just items that appear eligible.
 * This layer never changes Git or a release attempt in D1.
 */
import type { PendingArticle } from "./release-queue.js";

export interface ReleasePostSnapshot {
  slug: string;
  status: "draft" | "ready" | "published";
  readyAt?: string; // durable ingestion timestamp, never filesystem mtime
}
export interface ReleaseSeriesSnapshot {
  slug: string;
  paused?: boolean;
  external?: boolean;
  sections: readonly {
    posts: readonly {
      slug: string;
      status: "planned" | "draft" | "ready" | "published";
    }[];
  }[];
}
export interface ReleaseEligibilityResult {
  articles: PendingArticle[];
  blockedSeries: { seriesSlug: string; reasons: string[] }[];
}

/** Never publish local files omitted from the series manifest as a series post. */
export function collectReleaseEligibility(
  posts: readonly ReleasePostSnapshot[],
  manifests: readonly ReleaseSeriesSnapshot[],
): ReleaseEligibilityResult {
  const bySlug = new Map<string, ReleasePostSnapshot>();
  for (const post of posts) {
    if (bySlug.has(post.slug)) throw new Error("Duplicate post: " + post.slug);
    bySlug.set(post.slug, post);
  }
  const memberships = new Set<string>();
  const ownerCounts = new Map<string, number>();
  for (const manifest of manifests)
    for (const section of manifest.sections)
      for (const ref of section.posts) {
        ownerCounts.set(ref.slug, (ownerCounts.get(ref.slug) ?? 0) + 1);
      }
  const blockedSeries: ReleaseEligibilityResult["blockedSeries"] = [];
  const articles: PendingArticle[] = [];
  const seenSeries = new Set<string>();
  for (const manifest of manifests) {
    if (seenSeries.has(manifest.slug))
      throw new Error("Duplicate series: " + manifest.slug);
    seenSeries.add(manifest.slug);
    const references = manifest.sections.flatMap((section) => section.posts);
    const reasons: string[] = [];
    if (manifest.paused) reasons.push("MANIFEST_PAUSED");
    if (manifest.external) reasons.push("EXTERNAL_SERIES");
    const localSlugs = new Set<string>();
    for (const ref of references) {
      if (localSlugs.has(ref.slug))
        reasons.push("Duplicate series post: " + ref.slug);
      localSlugs.add(ref.slug);
      if ((ownerCounts.get(ref.slug) ?? 0) > 1)
        reasons.push("Post referenced multiple times: " + ref.slug);
      memberships.add(ref.slug);
      const file = bySlug.get(ref.slug);
      if (ref.status === "planned" || ref.status === "draft")
        reasons.push("Incomplete post: " + ref.slug);
      if (!file) reasons.push("Missing post file: " + ref.slug);
      else if (file.status !== ref.status)
        reasons.push("Status mismatch: " + ref.slug);
      else if (file.status === "ready" && !file.readyAt)
        reasons.push("Missing durable readyAt: " + ref.slug);
    }
    if (!references.length) reasons.push("Series has no posts");
    if (reasons.length) {
      blockedSeries.push({ seriesSlug: manifest.slug, reasons });
      continue;
    }
    references.forEach((ref, order) => {
      const post = bySlug.get(ref.slug)!;
      if (post.status !== "ready") return; // already published
      articles.push({
        slug: ref.slug,
        kind: "series",
        seriesSlug: manifest.slug,
        order,
        readyAt: post.readyAt!,
      });
    });
  }
  for (const post of posts) {
    if (memberships.has(post.slug) || post.status !== "ready") continue;
    if (!post.readyAt) throw new Error("Missing durable readyAt: " + post.slug);
    articles.push({
      slug: post.slug,
      kind: "standalone",
      readyAt: post.readyAt,
    });
  }
  return { articles, blockedSeries };
}
