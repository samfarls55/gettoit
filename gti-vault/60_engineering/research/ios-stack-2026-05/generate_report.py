#!/usr/bin/env python3
"""Generate report.md from results/*.json + fields.yaml."""

import json
import re
from pathlib import Path

import yaml

HERE = Path(__file__).parent
FIELDS_PATH = HERE / "fields.yaml"
RESULTS_DIR = HERE / "results"
REPORT_PATH = HERE / "report.md"

PRETTY_CATEGORY = {
    "basic_info": "Basic Info",
    "category_fit": "Category Fit",
    "onboarding_invite_friction": "Onboarding & Invite Friction",
    "velocity": "Velocity",
    "operational": "Operational / Cost",
    "apple_platform_alignment": "Apple Platform Alignment",
    "food_vertical_fit": "Food Vertical Fit",
    "push_notification_ux": "Push & Notification UX",
    "risk_longevity": "Risk & Longevity",
}

CATEGORY_MAPPING = {
    pretty: [snake, pretty] for snake, pretty in PRETTY_CATEGORY.items()
}

TOC_SUMMARY_FIELDS = [
    ("time_to_first_prototype", "TTFP"),
    ("cost_per_DAU_first_1k", "Cost @ 1k DAU"),
    ("perf_per_dollar", "Perf / $"),
    ("vendor_lockin_risk", "Lock-in"),
]

UNCERTAIN_MARKER = "[uncertain]"
INTERNAL_KEYS = {"_source_file", "uncertain"}


def load_fields():
    with FIELDS_PATH.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)
    categories = []
    field_info = {}
    for cat in data.get("field_categories", []):
        cat_name = cat["category"]
        field_names = [f["name"] for f in cat.get("fields", [])]
        categories.append((cat_name, field_names))
        for fld in cat.get("fields", []):
            field_info[fld["name"]] = {
                "category": cat_name,
                "description": fld.get("description", ""),
                "required": fld.get("required", False),
            }
    return categories, field_info


def find_field_value(data, field_name, category):
    if field_name in data and field_name not in INTERNAL_KEYS:
        return data[field_name]
    keys = CATEGORY_MAPPING.get(category, [category])
    for k in keys:
        if k in data and isinstance(data[k], dict) and field_name in data[k]:
            return data[k][field_name]
    stack = [data]
    seen = []
    while stack:
        node = stack.pop()
        if id(node) in seen:
            continue
        seen.append(id(node))
        if isinstance(node, dict):
            for k, v in node.items():
                if k == field_name:
                    return v
                if isinstance(v, (dict, list)):
                    stack.append(v)
        elif isinstance(node, list):
            stack.extend(node)
    return None


def is_uncertain(value, field_name, uncertain_list):
    if field_name in uncertain_list:
        return True
    if value is None:
        return True
    if isinstance(value, str):
        if not value.strip():
            return True
        if UNCERTAIN_MARKER in value:
            return True
    return False


def format_value(value):
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        if not value:
            return ""
        if all(isinstance(x, dict) for x in value):
            return "\n" + "\n".join(
                "  - " + " | ".join(f"{k}: {v}" for k, v in item.items())
                for item in value
            )
        joined = ", ".join(str(x) for x in value)
        if len(joined) > 120:
            return "\n" + "\n".join(f"  - {x}" for x in value)
        return joined
    if isinstance(value, dict):
        parts = [f"{k}: {v}" for k, v in value.items()]
        joined = "; ".join(parts)
        if len(joined) > 120:
            return "\n" + "\n".join(f"  - {p}" for p in parts)
        return joined
    return str(value)


def slug_anchor(name):
    s = name.lower()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s


def extract_toc_value(data, field_name):
    value = data.get(field_name)
    if value is None:
        for v in data.values():
            if isinstance(v, dict) and field_name in v:
                value = v[field_name]
                break
    if value is None:
        return "—"
    if isinstance(value, str):
        s = value.strip()
        if UNCERTAIN_MARKER in s:
            return "—"
        for sep in [". ", "; ", " — ", ", "]:
            if sep in s:
                s = s.split(sep)[0]
                break
        if len(s) > 70:
            s = s[:67] + "..."
        return s.replace("|", "\\|")
    return str(value)


def render_field_bullet(fname, formatted):
    if formatted.startswith("\n"):
        return [f"- **{fname}**:"] + [
            ln for ln in formatted.split("\n") if ln.strip()
        ]
    return [f"- **{fname}** — {formatted}"]


def main():
    categories, field_info = load_fields()

    items = []
    for path in sorted(RESULTS_DIR.glob("*.json")):
        with path.open(encoding="utf-8") as f:
            items.append((path.stem, json.load(f)))

    lines = []
    lines.append("# iOS Tech Stack Research — GetToIt v1")
    lines.append("")
    lines.append(
        "_Generated from `results/*.json` via `generate_report.py`. "
        "See `_index.md` for scope, `outline.yaml` for items, `fields.yaml` for field framework._"
    )
    lines.append("")
    lines.append(f"**Topic:** optimal iOS tech stack for group-decision / food-discovery apps  ")
    lines.append(f"**Priority lens:** balanced — ship v1 fastest without painting into corner  ")
    lines.append(f"**Stacks evaluated:** {len(items)}  ")
    lines.append("")

    # TOC table
    lines.append("## Stacks at a glance")
    lines.append("")
    header_cols = ["#", "Stack"] + [label for _, label in TOC_SUMMARY_FIELDS]
    lines.append("| " + " | ".join(header_cols) + " |")
    lines.append("|" + "|".join(["---"] * len(header_cols)) + "|")
    for idx, (stem, data) in enumerate(items, start=1):
        name = data.get("name", stem)
        anchor = slug_anchor(stem)
        link = f"[{name}](#{anchor})"
        summary = [extract_toc_value(data, fld) for fld, _ in TOC_SUMMARY_FIELDS]
        row = [str(idx), link] + summary
        lines.append("| " + " | ".join(row) + " |")
    lines.append("")

    # Detail
    for stem, data in items:
        name = data.get("name", stem)
        anchor = slug_anchor(stem)
        lines.append(f"## {name}")
        lines.append(f'<a id="{anchor}"></a>')
        lines.append("")
        uncertain_list = data.get("uncertain") or []

        for cat_snake, field_names in categories:
            cat_pretty = PRETTY_CATEGORY.get(cat_snake, cat_snake)
            cat_body = []
            for fname in field_names:
                value = find_field_value(data, fname, cat_pretty)
                if is_uncertain(value, fname, uncertain_list):
                    continue
                formatted = format_value(value)
                if not formatted:
                    continue
                cat_body.extend(render_field_bullet(fname, formatted))
            if cat_body:
                lines.append(f"### {cat_pretty}")
                lines.extend(cat_body)
                lines.append("")

        defined = set(field_info.keys()) | INTERNAL_KEYS
        nested_keys = {k for keys in CATEGORY_MAPPING.values() for k in keys}
        extras = {}
        for k, v in data.items():
            if k in defined or k in nested_keys:
                continue
            extras[k] = v
        extra_body = []
        for k, v in extras.items():
            if is_uncertain(v, k, uncertain_list):
                continue
            formatted = format_value(v)
            if formatted:
                extra_body.extend(render_field_bullet(k, formatted))
        if extra_body:
            lines.append("### Other Info")
            lines.extend(extra_body)
            lines.append("")

        if uncertain_list:
            lines.append("### Uncertain fields")
            for f in uncertain_list:
                lines.append(f"- {f}")
            lines.append("")

    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {REPORT_PATH} ({len(items)} stacks, {sum(1 for _ in lines)} lines)")


if __name__ == "__main__":
    main()
