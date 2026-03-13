#!/usr/bin/env python3
"""
Enrich NFL player CSV with draft_year (and auto-derive time_period) via Wikipedia.

- Drafted players: draft_year = e.g. 2017, time_period = "2010s"
- Undrafted free agents: draft_year = "UDFA", time_period still set from rookie year
- Updates the input CSV in place (backs up original first)

Usage:
    pip install requests
    python enrich_draft_year.py
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

HEADERS = {"User-Agent": "NFLCollegeGame/1.0 (educational project)"}
WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php"


def year_to_period(year: int) -> str:
    if year < 1980: return "1970s"
    if year < 1990: return "1980s"
    if year < 2000: return "1990s"
    if year < 2010: return "2000s"
    if year < 2020: return "2010s"
    return "2020s"


def search_wikipedia_title(player_name: str) -> str | None:
    """Find the best Wikipedia page title for an NFL player."""
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
    """Fetch raw wikitext for a Wikipedia page."""
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


def parse_draft_info(content: str) -> tuple[str, int | None]:
    """
    Parse wikitext and return (draft_year_str, nfl_debut_year).

    draft_year_str: "2017", "UDFA", or None if unknown
    nfl_debut_year: int year for deriving time_period (even for UDFAs)
    """
    # ── Drafted: infobox draft_year field ─────────────────────────
    m = re.search(r"\|\s*draft_year\s*=\s*(\d{4})", content)
    if m:
        year = int(m.group(1))
        return str(year), year

    # ── Drafted: [[20XX NFL Draft]] wikilink ──────────────────────
    m = re.search(r"\[\[(\d{4}) NFL Draft\]\]", content)
    if m:
        year = int(m.group(1))
        return str(year), year

    # ── Drafted: prose "selected in the 20XX NFL Draft" ──────────
    m = re.search(r"selected.*?(\d{4}) NFL Draft", content, re.IGNORECASE)
    if m:
        year = int(m.group(1))
        return str(year), year

    # ── Drafted: prose "drafted ... 20XX" ─────────────────────────
    m = re.search(r"drafted[^.]*?(\d{4})", content, re.IGNORECASE)
    if m:
        year = int(m.group(1))
        if 1960 <= year <= 2030:
            return str(year), year

    # ── Undrafted: explicit UDFA / undrafted mention ──────────────
    is_udfa = bool(re.search(
        r"(undrafted free agent|signed as an undrafted|went undrafted|UDFA)",
        content, re.IGNORECASE
    ))

    # Try to find rookie / debut year for time_period even for UDFAs
    debut_year = None

    m = re.search(r"\|\s*career_start\s*=\s*(\d{4})", content)
    if m:
        debut_year = int(m.group(1))

    if not debut_year:
        m = re.search(r"signed.*?(\d{4})", content, re.IGNORECASE)
        if m:
            year = int(m.group(1))
            if 1960 <= year <= 2030:
                debut_year = year

    if is_udfa:
        return "UDFA", debut_year

    return None, debut_year  # unknown


def lookup_player(player_name: str) -> tuple[str | None, str | None, str]:
    """
    Returns (draft_year_str, time_period, note).
    draft_year_str: "2017", "UDFA", or None
    time_period: "2010s" etc, or None
    note: human-readable explanation
    """
    title = search_wikipedia_title(player_name)
    if not title:
        return None, None, "no Wikipedia page found"

    content = get_page_content(title)
    if not content:
        return None, None, f"found page '{title}' but couldn't read content"

    draft_str, debut_year = parse_draft_info(content)

    time_period = year_to_period(debut_year) if debut_year else None

    if draft_str == "UDFA":
        note = f"UDFA (Wikipedia: {title})" + (f", debut ~{debut_year}" if debut_year else "")
    elif draft_str:
        note = f"drafted {draft_str} (Wikipedia: {title})"
    else:
        note = f"draft year not found (Wikipedia: {title})"

    return draft_str, time_period, note


def main():
    input_path = Path(INPUT_FILE)
    if not input_path.exists():
        print(f"❌ File not found: {INPUT_FILE}")
        return

    # ── Backup original ───────────────────────────────────────────
    backup_path = input_path.parent / (input_path.stem + "_backup.csv")
    shutil.copy(input_path, backup_path)
    print(f"💾 Backup saved to: {backup_path}")

    # ── Load CSV ──────────────────────────────────────────────────
    with open(input_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    # Ensure new columns exist in the right order
    if "draft_year" not in fieldnames:
        # Insert draft_year right after name
        insert_at = fieldnames.index("name") + 1 if "name" in fieldnames else 0
        fieldnames.insert(insert_at, "draft_year")
    if "time_period" not in fieldnames:
        fieldnames.append("time_period")

    print(f"\n📂 {len(rows)} players loaded.")

    needs_draft = [r for r in rows if not r.get("draft_year", "").strip()]
    needs_period = [r for r in rows if not r.get("time_period", "").strip()]
    print(f"   Need draft_year  : {len(needs_draft)}")
    print(f"   Need time_period : {len(needs_period)}\n")

    # ── Derive time_period from existing draft_year where possible ─
    for row in rows:
        dy = row.get("draft_year", "").strip()
        if dy and dy != "UDFA" and not row.get("time_period", "").strip():
            try:
                row["time_period"] = year_to_period(int(dy))
            except ValueError:
                pass

    # ── Fetch missing draft_year from Wikipedia ───────────────────
    to_fetch = [r for r in rows if not r.get("draft_year", "").strip()]
    if not to_fetch:
        print("✅ All players already have draft_year.")
    else:
        print(f"🔍 Looking up {len(to_fetch)} players on Wikipedia...\n")

    fetched = skipped = failed = 0

    for i, row in enumerate(rows, 1):
        if row.get("draft_year", "").strip():
            continue  # already has draft_year

        name = row.get("name", "").strip()
        print(f"[{fetched+skipped+failed+1}/{len(to_fetch)}] {name:30s} ", end="", flush=True)

        draft_str, time_period, note = lookup_player(name)

        if draft_str is not None:
            row["draft_year"] = draft_str
            fetched += 1
        else:
            row["draft_year"] = ""
            failed += 1

        if time_period and not row.get("time_period", "").strip():
            row["time_period"] = time_period

        # Status icon
        if draft_str == "UDFA":
            icon = "🔵"
        elif draft_str:
            icon = "✅"
        else:
            icon = "❌"

        dy_display = draft_str or "unknown"
        tp_display = row.get("time_period", "") or "unknown"
        print(f"{icon} draft={dy_display:6s} era={tp_display:6s} | {note}")

        time.sleep(0.35)

    # ── Write back to original file ───────────────────────────────
    with open(input_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    # ── Summary ───────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    print(f"   ✅ Draft year found : {fetched}")
    print(f"   🔵 Tagged as UDFA  : {sum(1 for r in rows if r.get('draft_year') == 'UDFA')}")
    print(f"   ❌ Not found       : {failed}")

    still_missing = sum(1 for r in rows if not r.get("draft_year", "").strip())
    print(f"   Still missing      : {still_missing}")

    print(f"\n✅ Updated in place: {input_path}")
    print(f"   Original backed up: {backup_path}")

    if still_missing:
        print(f"\n⚠  {still_missing} players still missing draft_year.")
        print("   Open the CSV and fill these in manually.")


if __name__ == "__main__":
    print("Script started.\n")
    main()