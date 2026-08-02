export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function serializeBigInt<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item) =>
    typeof item === "bigint" ? item.toString() : item
  )) as T;
}

export function microsToUsd(value: bigint | number | string | null | undefined): number {
  return Number(value ?? 0) / 1_000_000;
}
