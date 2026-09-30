"""One-off: unify the in-UI brand wordmark on "Side View".

The store listing and manifest already say "Side View" (extName), but the
settings page, the detail frame title and several messages still said
"side-view". Chrome i18n has no interpolation, so the brand is written
literally into each composed message, plus one standalone `brand` key for the
wordmark element in App.tsx which needs it on its own.

Run from the repo root: python scripts/unify-brand-wordmark.py
"""

import json
import os

LOCALES = ["en", "zh_CN", "zh_TW", "ja"]

# Old lowercase form -> the product wordmark.
OLD = "side-view"
NEW = "Side View"


def walk(node, path, hits):
    """Replace OLD with NEW in every string, in place. str.replace returns a new
    string, so the dict value has to be written back explicitly."""
    if isinstance(node, dict):
        for k, v in node.items():
            if isinstance(v, str) and OLD in v:
                hits.append(f"{path}.{k}" if path else k)
                node[k] = v.replace(OLD, NEW)
            else:
                walk(v, f"{path}.{k}" if path else k, hits)


for loc in LOCALES:
    path = os.path.join("src", "locales", f"{loc}.json")
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)

    hits: list[str] = []
    walk(data, "", hits)

    # Standalone key for the wordmark, placed next to the other manifest-facing
    # strings so the branding lives in one obvious block.
    rebuilt = {}
    for k, v in data.items():
        rebuilt[k] = v
        if k == "extDescription":
            rebuilt["brand"] = NEW
    assert "brand" in rebuilt, loc

    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(rebuilt, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print(f"{loc}: {len(hits)} messages -> {', '.join(hits)}")
