# Installation and Run — JM Personal Data OS v0.1.0

## Requirements
- Python 3.12+
- Docker with Compose, or PostgreSQL 17+
- `pg_dump`, `pg_restore`, `sha256sum`

## Local database
```bash
docker compose up -d postgres
export DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/jm_data_os'
```

## Install
```bash
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
```

## Run
```bash
uvicorn app.api:app --host 127.0.0.1 --port 8765
```

## Validate
```bash
ruff check .
mypy app
pytest -q --cov=app --cov-report=term-missing
```

## Import local/NAS text files
NAS must already be mounted locally. The scanner treats the configured path as a hard security boundary.

```bash
curl -X POST http://127.0.0.1:8765/v1/ingest/filesystem \
  -H 'content-type: application/json' \
  -d '{"path":"/mnt/data"}'
```

## Import AI export
```bash
curl -X POST http://127.0.0.1:8765/v1/ingest/ai-export \
  -H 'content-type: application/json' \
  -d '{"path":"/path/to/export","provider":"chatgpt"}'
```

Supported provider labels: `chatgpt`, `claude`, `gemini`.

## Search
```bash
curl 'http://127.0.0.1:8765/v1/search?q=SIEM'
```

## Backup
```bash
chmod +x scripts/*.sh
scripts/backup.sh backups
```

## Restore
Restore is destructive to the target database. Use a clean or intentionally replaceable DB.
```bash
scripts/restore.sh backups/<file>.dump
```

## OAuth connectors
v0.1.0 connector code accepts access tokens but deliberately does not embed or invent OAuth client credentials. Production credentials must be supplied through environment/secret management. Gmail permission must be read-only. Microsoft Graph mail/calendar permissions must be read-only. Live OAuth onboarding remains an environment-specific pilot gate.
