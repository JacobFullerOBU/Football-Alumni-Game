#!/usr/bin/env python3
"""
Complete validation + repair script for NFL player CSV.

Checks for:
  - Duplicate players
  - Missing school, time_period, difficulty, image_url
  - Fetches missing images from Wikipedia automatically

Usage:
    pip install requests
    python validate_players.py
"""

# ─── SET YOUR FILE PATH HERE ──────────────────────────────────────────────────
INPUT_FILE = "players_with_images.csv"
# ─────────────────────────────────────────────────────────────────────────────

import csv
import os
import time
import requests

WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; FootballAlumniGameBot/1.0)"}

REQUIRED_FIELDS = ["college", "time_period", "difficulty", "image_url"]
VALID_DIFFICULTIES = {"easy", "medium", "hard", "extreme"}
VALID_PERIODS = {"1970s", "1980s", "1990s", "2000s", "2010s", "2020s"}


# ─── IMAGE FETCH ──────────────────────────────────────────────────────────────

def get_wikipedia_image(player_name: str) -> str:
    params = {
        "action": "query",
        "format": "json",
        "prop": "pageimages",
        "piprop": "original",
        "titles": player_name,
    }
    try:
        response = requests.get(WIKIPEDIA_API_URL, params=params, headers=HEADERS, timeout=10)
        response.raise_for_status()
        try:
            data = response.json()
        except Exception:
            print(f"    [WARN] Could not decode JSON for {player_name}")
            return ""
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            if "original" in page:
                return page["original"]["source"]
    except Exception as e:
        print(f"    [ERROR] Failed to fetch image for {player_name}: {e}")
    return ""


# ─── VALIDATION ───────────────────────────────────────────────────────────────

def check_row(row: dict, row_num: int) -> list[str]:
    """Return a list of issue strings for a single row."""
    issues = []
    name = row.get("name", f"Row {row_num}").strip()

    for field in REQUIRED_FIELDS:
        if not row.get(field, "").strip():
            issues.append(f"missing {field}")

    diff = row.get("difficulty", "").strip().lower()
    if diff and diff not in VALID_DIFFICULTIES:
        issues.append(f"invalid difficulty '{diff}' (must be: {', '.join(sorted(VALID_DIFFICULTIES))})")

    period = row.get("time_period", "").strip().lower()
    if period and period not in VALID_PERIODS:
        issues.append(f"invalid time_period '{period}' (must be: {', '.join(sorted(VALID_PERIODS))})")

    return issues


def main():
    if not os.path.exists(INPUT_FILE):
        print(f"❌ File not found: {INPUT_FILE}")
        print("   Check that INPUT_FILE at the top of the script is correct.")
        return

    print(f"📂 Loading {INPUT_FILE}...\n")

    with open(INPUT_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    if "image_url" not in fieldnames:
        fieldnames.append("image_url")

    total = len(rows)
    print(f"   {total} players loaded.")
    print(f"   Columns: {', '.join(fieldnames)}\n")
    print("=" * 60)

    # ── 1. DUPLICATE CHECK ────────────────────────────────────────
    print("\n🔍 CHECKING FOR DUPLICATES...")
    seen_names = {}
    duplicates = []
    for i, row in enumerate(rows, 1):
        name = row.get("name", "").strip().lower()
        if name in seen_names:
            duplicates.append((i, row.get("name"), seen_names[name]))
            print(f"   ⚠  Row {i}: '{row.get('name')}' is a duplicate of row {seen_names[name]}")
        else:
            seen_names[name] = i

    if not duplicates:
        print("   ✅ No duplicates found.")

    # ── 2. FIELD VALIDATION ───────────────────────────────────────
    print("\n🔍 CHECKING REQUIRED FIELDS...")
    all_issues = {}
    for i, row in enumerate(rows, 1):
        issues = check_row(row, i)
        if issues:
            all_issues[i] = (row.get("name", f"Row {i}"), issues)

    if not all_issues:
        print("   ✅ All players have valid fields.")
    else:
        for row_num, (name, issues) in all_issues.items():
            print(f"   ⚠  Row {row_num} '{name}': {', '.join(issues)}")

    # ── 3. IMAGE FETCH FOR MISSING IMAGES ────────────────────────
    missing_images = [row for row in rows if not row.get("image_url", "").strip()]
    print(f"\n🖼  FETCHING MISSING IMAGES ({len(missing_images)} players)...")

    if not missing_images:
        print("   ✅ All players already have images.")
    else:
        fetched, failed = 0, []
        for i, row in enumerate(rows, 1):
            if row.get("image_url", "").strip():
                continue
            name = row.get("name", "").strip()
            print(f"   [{fetched+1}/{len(missing_images)}] {name}...", end=" ", flush=True)
            url = get_wikipedia_image(name)
            if url:
                row["image_url"] = url
                print(f"✅ found")
                fetched += 1
            else:
                print(f"❌ not found")
                failed.append(name)
            time.sleep(0.5)

        print(f"\n   Fetched: {fetched} | Still missing: {len(failed)}")
        if failed:
            print("   Players still missing images (add manually):")
            for name in failed:
                print(f"     - {name}")

    # ── 4. SUMMARY ────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    print(f"   Total players   : {total}")
    print(f"   Duplicates      : {len(duplicates)}")
    print(f"   Field issues    : {len(all_issues)}")

    still_missing_img = sum(1 for r in rows if not r.get("image_url", "").strip())
    print(f"   Missing images  : {still_missing_img}")

    diff_counts = {}
    for r in rows:
        d = r.get("difficulty", "unknown").strip() or "unknown"
        diff_counts[d] = diff_counts.get(d, 0) + 1
    print(f"\n   Difficulty breakdown:")
    for d in ["easy", "medium", "hard", "extreme", "unknown"]:
        if d in diff_counts:
            bar = "█" * diff_counts[d]
            print(f"     {d:8s} {bar} ({diff_counts[d]})")

    era_counts = {}
    for r in rows:
        e = r.get("time_period", "unknown").strip() or "unknown"
        era_counts[e] = era_counts.get(e, 0) + 1
    print(f"\n   Era breakdown:")
    for e in sorted(era_counts):
        bar = "█" * era_counts[e]
        print(f"     {e:8s} {bar} ({era_counts[e]})")

    # ── 5. WRITE OUTPUT ───────────────────────────────────────────
    input_path_stem = INPUT_FILE.replace(".csv", "")
    out_path = f"{input_path_stem}_validated.csv"

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n✅ Validated CSV saved to: {out_path}")

    if duplicates or all_issues or still_missing_img > 0:
        print("\n⚠  Some issues remain — review the items flagged above.")
        print("   Fix them in the output CSV, then re-run to confirm clean.")
    else:
        print("\n🎉 All checks passed! Your data is clean.")


if __name__ == "__main__":
    print("Script started.\n")
    main()