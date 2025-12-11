import csv
import requests
import urllib.parse

WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php"

def get_wikipedia_image(player_name):
    params = {
        "action": "query",
        "format": "json",
        "prop": "pageimages",
        "piprop": "original",
        "titles": player_name
    }
    headers = {"User-Agent": "Mozilla/5.0 (compatible; FootballAlumniGameBot/1.0)"}
    try:
        response = requests.get(WIKIPEDIA_API_URL, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        try:
            data = response.json()
        except Exception:
            print(f"[WARN] Could not decode JSON for {player_name}")
            return ""
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            if "original" in page:
                return page["original"]["source"]
    except Exception as e:
        print(f"[ERROR] Failed to fetch image for {player_name}: {e}")
    return ""

def main():
    import time
    with open("players_with_images.csv", newline='', encoding='utf-8') as infile, \
         open("players_with_images_checked.csv", 'w', newline='', encoding='utf-8') as outfile:
        reader = csv.DictReader(infile)
        print(f"Fieldnames detected: {reader.fieldnames}")
        fieldnames = reader.fieldnames
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()
        row_count = 0
        no_image_players = []
        for i, row in enumerate(reader, 1):
            print(f"Row {i}: {row}")
            row_count += 1
            player_name = row[reader.fieldnames[0]]  # Assumes first column is name
            image_url = row.get("image_url", "")
            if not image_url:
                print(f"[{i}] Processing: {player_name} (no image, trying to fetch)")
                image_url = get_wikipedia_image(player_name)
                if image_url:
                    print(f"    Found image: {image_url}")
                else:
                    print(f"    No image found.")
                    no_image_players.append(player_name)
                row["image_url"] = image_url
            else:
                print(f"[{i}] {player_name} already has image.")
            writer.writerow(row)
            time.sleep(1)  # polite delay to avoid rate limits
        print(f"Total rows processed: {row_count}")
        if no_image_players:
            print("\nPlayers with no image found:")
            for name in no_image_players:
                print(f" - {name}")
        else:
            print("All players have images.")
    print("Done. Check players_with_images_checked.csv for results.")

if __name__ == "__main__":
    import os
    print("Script started.")
    if not os.path.exists("players_with_images.csv"):
        print("players_with_images.csv not found!")
    else:
        print("players_with_images.csv found, running main().")
        main()
