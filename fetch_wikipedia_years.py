#!/usr/bin/env python3
"""
Enrich an NFL player CSV with time_period using the Wikipedia API.
No API key needed — Wikipedia is free and open.

Just set INPUT_FILE below to your CSV path and run:
    python enrich_wikipedia.py
"""

# ─── SET YOUR FILE PATH HERE ──────────────────────────────────────────────────
INPUT_FILE = "players_needing_years.csv"   # <- change this to your file path
# ─────────────────────────────────────────────────────────────────────────────

import csv
import re
import sys
import time
from pathlib import Path
import requests

VALID_PERIODS = {"1970s", "1980s", "1990s", "2000s", "2010s", "2020s"}
UNKNOWN = "unknown"
HEADERS = {"User-Agent": "NFLCollegeGame/1.0 (educational project; contact@example.com)"}


def draft_year_to_period(year: int) -> str:
    if year < 1980: return "1970s"
    if year < 1990: return "1980s"
    if year < 2000: return "1990s"
    if year < 2010: return "2000s"
    if year < 2020: return "2010s"
    return "2020s"


def search_wikipedia(player_name: str) -> str | None:
    """Return the best-matching Wikipedia page title for an NFL player."""
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "list": "search",
        "srsearch": f"{player_name} NFL football",
        "srlimit": 3,
        "format": "json",
    }
    resp = requests.get(url, params=params, headers=HEADERS, timeout=10)
    resp.raise_for_status()
    results = resp.json().get("query", {}).get("search", [])
    if not results:
        return None
    # Prefer exact name match in title
    for r in results:
        if player_name.lower() in r["title"].lower():
            return r["title"]
    return results[0]["title"]


def get_draft_year_from_page(title: str) -> int | None:
    """Fetch Wikipedia page content and extract NFL draft year."""
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "titles": title,
        "prop": "revisions",
        "rvprop": "content",
        "rvslots": "main",
        "format": "json",
    }
    resp = requests.get(url, params=params, headers=HEADERS, timeout=10)
    resp.raise_for_status()
    pages = resp.json().get("query", {}).get("pages", {})
    page = next(iter(pages.values()))
    content = page.get("revisions", [{}])[0].get("slots", {}).get("main", {}).get("*", "")

    if not content:
        return None

    # Pattern 1: Infobox draft_year field  |draft_year = 2018
    m = re.search(r"\|\s*draft_year\s*=\s*(\d{4})", content)
    if m:
        return int(m.group(1))

    # Pattern 2: NFL Draft wikilink  [[2018 NFL Draft]]
    m = re.search(r"\[\[(\d{4}) NFL Draft\]\]", content)
    if m:
        return int(m.group(1))

    # Pattern 3: "selected in the 2018 NFL Draft"
    m = re.search(r"selected.*?(\d{4}) NFL Draft", content, re.IGNORECASE)
    if m:
        return int(m.group(1))

    # Pattern 4: "drafted.*2018"
    m = re.search(r"drafted.*?(\d{4})", content, re.IGNORECASE)
    if m:
        year = int(m.group(1))
        if 1960 <= year <= 2030:
            return year

    # Pattern 5: Undrafted — look for debut year via "signed" or "career start"
    m = re.search(r"\|\s*career_start\s*=\s*(\d{4})", content)
    if m:
        return int(m.group(1))

    return None


def lookup_player(player_name: str) -> tuple[str, str]:
    """
    Returns (time_period, source) where source is 'wikipedia' or 'unknown'.
    """
    try:
        title = search_wikipedia(player_name)
        if not title:
            return UNKNOWN, "no search results"

        year = get_draft_year_from_page(title)
        if not year:
            return UNKNOWN, f"found page '{title}' but no draft year"

        if not (1960 <= year <= 2030):
            return UNKNOWN, f"implausible year {year}"

        period = draft_year_to_period(year)
        return period, f"wikipedia ({title}, {year})"

    except requests.RequestException as e:
        return UNKNOWN, f"network error: {e}"
    except Exception as e:
        return UNKNOWN, f"error: {e}"


def main():
    input_path = Path(INPUT_FILE)
    if not input_path.exists():
        print(f"File not found: {input_path}")
        print("Check that INPUT_FILE at the top of the script is correct.")
        sys.exit(1)

    with open(input_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    if "time_period" not in fieldnames:
        fieldnames.append("time_period")

    needs_enrichment = [r for r in rows if not r.get("time_period", "").strip()]
    print(f"Total players       : {len(rows)}")
    print(f"Already have period : {len(rows) - len(needs_enrichment)}")
    print(f"Need enrichment     : {len(needs_enrichment)}\n")

    if not needs_enrichment:
        print("Nothing to enrich. Exiting.")
        return

    review_rows = []

    for i, row in enumerate(rows):
        if row.get("time_period", "").strip():
            continue  # skip already filled

        name = row["name"]
        print(f"[{i+1}/{len(rows)}] {name:30s} ", end="", flush=True)

        period, source = lookup_player(name)
        row["time_period"] = period

        if period == UNKNOWN:
            print(f"⚠  unknown  ({source})")
            review_rows.append({**row, "_note": source})
        else:
            print(f"✓  {period:8s} ({source})")

        # Be polite to Wikipedia — don't hammer their servers
        time.sleep(2.5)

    # Write enriched CSV
    out_path = input_path.parent / (input_path.stem + "_enriched.csv")
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"\n✅ Saved: {out_path}")

    # Write review CSV
    if review_rows:
        review_path = input_path.parent / (input_path.stem + "_review.csv")
        with open(review_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames + ["_note"])
            writer.writeheader()
            writer.writerows(review_rows)
        print(f"⚠  {len(review_rows)} need manual review: {review_path}")
    else:
        print("🎉 All players resolved!")

    filled = sum(1 for r in rows if r.get("time_period", "") not in ("", UNKNOWN))
    print(f"\nSummary: {filled} filled · {len(review_rows)} unknown · {len(rows)} total")


if __name__ == "__main__":
    main()