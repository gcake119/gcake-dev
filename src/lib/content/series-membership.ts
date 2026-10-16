export interface SeriesMembershipManifest {
  readonly slug: string;
  readonly sections: readonly { readonly posts: readonly { readonly slug: string }[] }[];
}

export function seriesMembership(manifests: readonly SeriesMembershipManifest[]) {
  const membership = new Map<string, string>();
  for (const manifest of manifests) {
    for (const post of manifest.sections.flatMap((section) => section.posts)) {
      if (!membership.has(post.slug)) membership.set(post.slug, manifest.slug);
    }
  }
  return membership;
}
