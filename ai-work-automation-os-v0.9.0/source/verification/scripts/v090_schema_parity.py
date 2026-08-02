#!/usr/bin/env python3
from pathlib import Path
import re, sqlite3, sys

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = (ROOT / "prisma/schema.prisma").read_text(encoding="utf-8")
SQL_JS = (ROOT / "scripts/db-v090-schema.mjs").read_text(encoding="utf-8")
SCALARS = {"String", "Int", "BigInt", "Float", "Boolean", "DateTime", "Json", "Bytes", "Decimal"}

models = {}
for match in re.finditer(r"model\s+(\w+)\s*\{(.*?)\n\}", SCHEMA, re.S):
    model, body = match.group(1), match.group(2)
    table_match = re.search(r'@@map\("([^"]+)"\)', body)
    if not table_match:
        continue
    table = table_match.group(1)
    columns = []
    for raw in body.splitlines():
        line = raw.strip()
        if not line or line.startswith("//") or line.startswith("@@"):
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        name, type_token = parts[0], parts[1]
        base_type = type_token.rstrip("?[]")
        if base_type not in SCALARS:
            continue
        mapped = re.search(r'@map\("([^"]+)"\)', line)
        columns.append(mapped.group(1) if mapped else name)
    models[table] = sorted(columns)

sql_match = re.search(r"export const V090_SCHEMA_SQL = `(.+?)`;", SQL_JS, re.S)
if not sql_match:
    print("FAIL schema SQL template not found")
    sys.exit(1)
conn = sqlite3.connect(":memory:")
conn.executescript(sql_match.group(1))
actual_tables = sorted(row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"))
failed = []
if sorted(models) != actual_tables:
    failed.append(("tables", sorted(models), actual_tables))
for table, expected in sorted(models.items()):
    actual = sorted(row[1] for row in conn.execute(f'PRAGMA table_info("{table}")'))
    if expected != actual:
        failed.append((table, expected, actual))

if failed:
    for name, expected, actual in failed:
        print(f"FAIL {name}\n  Prisma={expected}\n  SQL={actual}")
    sys.exit(1)
print(f"PASS schema parity: {len(models)} tables, {sum(len(v) for v in models.values())} columns")
