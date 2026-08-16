from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class Item:
    source_type: str
    source_id: str
    locator: str
    title: str
    body: str
    project: str = "unclassified"

    @property
    def content_hash(self) -> str:
        return sha256(self.body.encode("utf-8", errors="replace")).hexdigest()


@dataclass(frozen=True)
class ProjectRule:
    project: str
    keywords: tuple[str, ...]
    priority: int = 0


def classify_project(title: str, body: str, rules: Iterable[ProjectRule]) -> tuple[str, float, str]:
    haystack = f"{title}\n{body}".casefold()
    ranked = sorted(rules, key=lambda rule: rule.priority, reverse=True)
    for rule in ranked:
        matched = [keyword for keyword in rule.keywords if keyword.casefold() in haystack]
        if matched:
            confidence = min(1.0, 0.5 + 0.1 * len(matched))
            return rule.project, confidence, f"matched keywords: {', '.join(matched)}"
    return "unclassified", 0.0, "no project rule matched"


def ensure_within_root(root: Path, candidate: Path) -> Path:
    resolved_root = root.resolve(strict=True)
    resolved_candidate = candidate.resolve(strict=True)
    if resolved_candidate != resolved_root and resolved_root not in resolved_candidate.parents:
        raise ValueError("path escapes configured root")
    return resolved_candidate


def read_text_bounded(path: Path, max_bytes: int = 2_000_000) -> str:
    with path.open("rb") as handle:
        raw = handle.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise ValueError("file exceeds extraction limit")
    return raw.decode("utf-8", errors="replace")
