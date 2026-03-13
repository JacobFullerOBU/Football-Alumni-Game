#!/usr/bin/env python3
"""
Enrich NFL player CSV with position_group using Wikipedia.

Broad position groups:
  QB, RB, WR, TE, OL, DL, LB, DB, ST

Updates the input CSV in place (backs up original first).

Usage:
    pip install requests
    python enrich_position.py
"""

# ─── SET YOUR FILE PATH HERE ──────────────────────────────────────────────────
INPUT_FILE = "players_with_images.csv"
# ─────────────────────────────────────────────────────────────────────────────

import csv
import os
import re
import shutil
import time
from pathlib import Path
import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php"

# ─── POSITION → GROUP MAPPING ─────────────────────────────────────────────────
# Maps any specific position mention to a broad group

POSITION_MAP = {
    # Quarterback
    "QB": "QB", "quarterback": "QB",

    # Running Back
    "RB": "RB", "running back": "RB", "halfback": "RB", "HB": "RB",
    "FB": "RB", "fullback": "RB",

    # Wide Receiver
    "WR": "WR", "wide receiver": "WR", "flanker": "WR", "split end": "WR",

    # Tight End
    "TE": "WR", "tight end": "WR",  # grouped with WR as pass-catchers

    # Offensive Line
    "OL": "OL", "offensive line": "OL", "offensive lineman": "OL",
    "LT": "OL", "left tackle": "OL",
    "RT": "OL", "right tackle": "OL",
    "LG": "OL", "left guard": "OL",
    "RG": "OL", "right guard": "OL",
    "C":  "OL", "center": "OL",
    "OT": "OL", "offensive tackle": "OL",
    "OG": "OL", "offensive guard": "OL",

    # Defensive Line
    "DL": "DL", "defensive line": "DL", "defensive lineman": "DL",
    "DE": "DL", "defensive end": "DL",
    "DT": "DL", "defensive tackle": "DL",
    "NT": "DL", "nose tackle": "DL", "nose guard": "DL",

    # Linebacker
    "LB": "LB", "linebacker": "LB",
    "OLB": "LB", "outside linebacker": "LB",
    "ILB": "LB", "inside linebacker": "LB",
    "MLB": "LB", "middle linebacker": "LB",
    "SLB": "LB", "strongside linebacker": "LB",
    "WLB": "LB", "weakside linebacker": "LB",

    # Defensive Back
    "DB": "DB", "defensive back": "DB",
    "CB": "DB", "cornerback": "DB",
    "SS": "DB", "strong safety": "DB",
    "FS": "DB", "free safety": "DB",
    "S":  "DB", "safety": "DB",
    "NCB": "DB", "nickelback": "DB",

    # Special Teams
    "K":  "ST", "kicker": "ST", "placekicker": "ST",
    "P":  "ST", "punter": "ST",
    "LS": "ST", "long snapper": "ST",
    "KR": "ST", "kick returner": "ST",
    "PR": "ST", "punt returner": "ST",
}

VALID_GROUPS = {"QB", "RB", "WR", "OL", "DL", "LB", "DB", "ST"}


def parse_position_from_content(content: str) -> str | None:
    """
    Try to extract position from Wikipedia wikitext.
    Returns a broad group string or None.
    """
    # Pattern 1: infobox position field  |position = Quarterback
    m = re.search(r"\|\s*position\s*=\s*([^\n\|]+)", content, re.IGNORECASE)
    if m:
        raw = m.group(1).strip().rstrip("}").strip()
        # Clean wikitext markup like [[Quarterback|QB]]
        raw = re.sub(r"\[\[.*?\|(.+?)\]\]", r"\1", raw)
        raw = re.sub(r"\[\[(.+?)\]\]", r"\1", raw)
        raw = re.sub(r"[{}]", "", raw).strip()
        group = map_to_group(raw)
        if group:
            return group

    # Pattern 2: "plays as a quarterback", "is an American football quarterback"
    m = re.search(
        r"(is an?|plays as an?|played as an?)\s+(?:American football\s+)?([a-zA-Z ]+?)(?:\s+for|\s+who|\s+in|\.|,)",
        content, re.IGNORECASE
    )
    if m:
        group = map_to_group(m.group(2).strip())
        if group:
            return group

    # Pattern 3: scan first 500 chars for position keywords
    snippet = content[:500]
    for key, group in POSITION_MAP.items():
        if re.search(rf"\b{re.escape(key)}\b", snippet, re.IGNORECASE):
            return group

    return None


def map_to_group(raw: str) -> str | None:
    """Map a raw position string to a broad group."""
    raw = raw.strip()
    # Try exact match first
    if raw in POSITION_MAP:
        return POSITION_MAP[raw]
    # Try case-insensitive
    raw_lower = raw.lower()
    for key, group in POSITION_MAP.items():
        if key.lower() == raw_lower:
            return group
    # Try partial match (e.g. "Wide receiver / Return specialist")
    for key, group in POSITION_MAP.items():
        if key.lower() in raw_lower:
            return group
    return None


def search_wikipedia_title(player_name: str) -> str | None:
    params = {
        "action": "query",
        "list": "search",
        "srsearch": f"{player_name} NFL football",
        "srlimit": 3,
        "format": "json",
    }
    try:
        resp = requests.get(WIKIPEDIA_API_URL, params=params, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        results = resp.json().get("query", {}).get("search", [])
        if not results:
            return None
        for r in results:
            if player_name.lower() in r["title"].lower():
                return r["title"]
        return results[0]["title"]
    except Exception:
        return None


def get_page_content(title: str) -> str:
    params = {
        "action": "query",
        "titles": title,
        "prop": "revisions",
        "rvprop": "content",
        "rvslots": "main",
        "format": "json",
    }
    try:
        resp = requests.get(WIKIPEDIA_API_URL, params=params, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        pages = resp.json().get("query", {}).get("pages", {})
        page = next(iter(pages.values()))
        return page.get("revisions", [{}])[0].get("slots", {}).get("main", {}).get("*", "")
    except Exception:
        return ""


def lookup_position(player_name: str) -> tuple[str | None, str]:
    """Returns (position_group, note)."""
    title = search_wikipedia_title(player_name)
    if not title:
        return None, "no Wikipedia page found"

    content = get_page_content(title)
    if not content:
        return None, f"found '{title}' but couldn't read content"

    group = parse_position_from_content(content)
    if group:
        return group, f"Wikipedia: {title}"
    return None, f"position not found in '{title}'"


def main():
    input_path = Path(INPUT_FILE)
    if not input_path.exists():
        print(f"❌ File not found: {INPUT_FILE}")
        print("   Check INPUT_FILE at the top of the script.")
        return

    # ── Backup ────────────────────────────────────────────────────
    backup_path = input_path.parent / (input_path.stem + "_backup.csv")
    shutil.copy(input_path, backup_path)
    print(f"💾 Backup saved to: {backup_path}")

    # ── Load ──────────────────────────────────────────────────────
    with open(input_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    if "position" not in fieldnames:
        # Insert after name column
        insert_at = fieldnames.index("name") + 1 if "name" in fieldnames else len(fieldnames)
        fieldnames.insert(insert_at, "position")

    needs_position = [r for r in rows if not r.get("position", "").strip()]
    print(f"\n📂 {len(rows)} players loaded.")
    print(f"   Need position : {len(needs_position)}")
    print(f"   Already set   : {len(rows) - len(needs_position)}\n")

    if not needs_position:
        print("✅ All players already have a position. Nothing to do.")
        return

    print(f"🔍 Looking up {len(needs_position)} players on Wikipedia...\n")

    found = failed = 0

    for i, row in enumerate(rows, 1):
        if row.get("position", "").strip():
            continue

        name = row.get("name", "").strip()
        print(f"[{found+failed+1}/{len(needs_position)}] {name:30s} ", end="", flush=True)

        group, note = lookup_position(name)

        if group:
            row["position"] = group
            found += 1
            print(f"✅ {group:4s} | {note}")
        else:
            row["position"] = ""
            failed += 1
            print(f"❌ unknown | {note}")

        time.sleep(0.35)

    # ── Write back in place ───────────────────────────────────────
    with open(input_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    # ── Summary ───────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("📊 POSITION BREAKDOWN")
    print("=" * 60)

    counts = {}
    for r in rows:
        p = r.get("position", "").strip() or "unknown"
        counts[p] = counts.get(p, 0) + 1

    for group in ["QB", "RB", "WR", "OL", "DL", "LB", "DB", "ST", "unknown"]:
        if group in counts:
            bar = "█" * counts[group]
            print(f"   {group:8s} {bar} ({counts[group]})")

    still_missing = sum(1 for r in rows if not r.get("position", "").strip())
    print(f"\n   ✅ Found    : {found}")
    print(f"   ❌ Missing  : {still_missing}")
    print(f"\n✅ Updated in place : {input_path}")
    print(f"   Backup at         : {backup_path}")

    if still_missing:
        print(f"\n⚠  {still_missing} players still missing position — fill in manually.")
        print("   Valid values: QB, RB, WR, OL, DL, LB, DB, ST")


if __name__ == "__main__":
    print("Script started.\n")
    main()