/** Fail-closed compatibility tombstone. D1 is the sole operational queue. */
console.error('GIT_JOURNAL_RETIRED：請使用 CMS D1 發文佇列；舊 journal 若存在，先人工對帳並保留證據。此命令不讀寫檔案、不連線。');
process.exitCode = 1;
