# Changelog

## [0.9.0] - 2026-07-31

### Added
- 18-table canonical SQLite schema
- Atomic v0.8.0 → v0.9.0 database rebuild
- Dry-run, backup, migration report, rollback sidecar and DB doctor
- Canonical Mission, Organization, Workflow, Review, Approval, Council, Artifact and Event services
- Integrated Command Center, Mission Workspace, approval inbox, Council and database settings UI
- Dependency-free schema, migration, static, adversarial and syntax verification

### Changed
- Product package renamed to `ai-work-automation-os`
- Organization tables unified into `org_unit`, `role`, `agent`
- Evaluation and failure records unified into `review`
- Multiple approval types unified into `approval`
- Runtime events unified into `event_log`
- Cost representation standardized to integer micros
- Local runtime directly uses the 18 physical tables

### Removed
- Duplicate generations of Company/Graph/Organization service and API routes
- Dual Core DB / Runtime Ledger design
- Active Supabase runtime dependency
- User-facing ProofGraph naming

### Compatibility
- v0.8.0 physical schema requires the supplied rebuild script.
- The original v0.8.0 DB is automatically preserved before swap.
