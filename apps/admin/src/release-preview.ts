/** Keep only the current article/date preview, including out-of-order failures. */
export function createPreviewRequests() {
  let generation = 0;
  return {
    invalidate() { generation++; },
    async run<T>(request: () => Promise<T>): Promise<T | undefined> {
      const current = ++generation;
      try {
        const result = await request();
        return current === generation ? result : undefined;
      } catch (error) {
        if (current === generation) throw error;
        return undefined;
      }
    },
  };
}
