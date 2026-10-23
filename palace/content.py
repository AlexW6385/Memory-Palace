"""Loading and saving content files.

content/
  systems/<id>.json   one KnowledgeSystem per file
  crosslinks.json     links between systems
  manifest.json       which plot each system occupies (append-only, so adding a
                      system never moves an existing one)
"""
from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, Field

from palace.schema import CrossLinks, KnowledgeSystem

ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "content"


class Manifest(BaseModel):
    # plot index -> system id, in the order systems were added
    plots: dict[int, str] = Field(default_factory=dict)

    def plot_of(self, system_id: str) -> int | None:
        for idx, sid in self.plots.items():
            if sid == system_id:
                return idx
        return None


class ContentStore:
    def __init__(self, root: Path = CONTENT_DIR):
        self.root = Path(root)

    @property
    def systems_dir(self) -> Path:
        return self.root / "systems"

    # ── systems ────────────────────────────────────────────────────────────
    def load_system(self, system_id: str) -> KnowledgeSystem:
        return load_system_file(self.systems_dir / f"{system_id}.json")

    def load_systems(self) -> dict[str, KnowledgeSystem]:
        systems = {}
        for path in sorted(self.systems_dir.glob("*.json")):
            s = load_system_file(path)
            if s.id != path.stem:
                raise ValueError(f"{path.name}: id {s.id!r} does not match the file name")
            systems[s.id] = s
        return systems

    def save_system(self, system: KnowledgeSystem) -> Path:
        self.systems_dir.mkdir(parents=True, exist_ok=True)
        path = self.systems_dir / f"{system.id}.json"
        _write_json(path, system.model_dump(mode="json"))
        return path

    # ── cross links ────────────────────────────────────────────────────────
    def load_crosslinks(self) -> CrossLinks:
        path = self.root / "crosslinks.json"
        if not path.exists():
            return CrossLinks()
        return CrossLinks.model_validate_json(path.read_text(encoding="utf-8"))

    def save_crosslinks(self, links: CrossLinks) -> None:
        _write_json(self.root / "crosslinks.json", links.model_dump(mode="json"))

    # ── manifest ───────────────────────────────────────────────────────────
    def load_manifest(self) -> Manifest:
        path = self.root / "manifest.json"
        if not path.exists():
            return Manifest()
        return Manifest.model_validate_json(path.read_text(encoding="utf-8"))

    def save_manifest(self, manifest: Manifest) -> None:
        data = {"plots": {str(k): v for k, v in sorted(manifest.plots.items())}}
        _write_json(self.root / "manifest.json", data)


def load_system_file(path: Path) -> KnowledgeSystem:
    return KnowledgeSystem.model_validate_json(Path(path).read_text(encoding="utf-8"))


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
