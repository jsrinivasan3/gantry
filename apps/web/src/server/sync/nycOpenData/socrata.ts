const SOCRATA_BASE = "https://data.cityofnewyork.us/resource";
const PAGE_SIZE = 1000;

export interface SocrataQuery {
  where?: string;
  order?: string;
}

/**
 * Pages through a Socrata (SODA) dataset with $limit/$offset, applying an
 * optional $where/$order. Sends X-App-Token when NYC_OPEN_DATA_APP_TOKEN is
 * set (raises the anonymous rate limit; not required for demo volumes).
 */
export async function fetchAllSocrataRows<T>(
  datasetId: string,
  query: SocrataQuery = {}
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  for (;;) {
    const url = new URL(`${SOCRATA_BASE}/${datasetId}.json`);
    url.searchParams.set("$limit", String(PAGE_SIZE));
    url.searchParams.set("$offset", String(offset));
    if (query.where) url.searchParams.set("$where", query.where);
    if (query.order) url.searchParams.set("$order", query.order);

    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.NYC_OPEN_DATA_APP_TOKEN) {
      headers["X-App-Token"] = process.env.NYC_OPEN_DATA_APP_TOKEN;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(
        `NYC Open Data request failed: ${res.status} ${res.statusText} — ${url.toString()}`
      );
    }

    const page = (await res.json()) as T[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

/** Builds a SoQL `in(...)` list, quoting each value. */
export function soqlInList(values: readonly string[]): string {
  return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(",");
}
