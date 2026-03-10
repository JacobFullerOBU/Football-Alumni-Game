import csv

input_file = 'players_with_images.csv'
output_file = 'players_with_images.csv'  # Overwrite original

with open(input_file, newline='', encoding='utf-8') as f:
    reader = list(csv.reader(f))
    header = reader[0]
    rows = reader[1:]

    # Sort: players with image_url first, missing image_url last
    sorted_rows = sorted(rows, key=lambda row: 0 if row[2].strip() else 1)

with open(output_file, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(header)
    writer.writerows(sorted_rows)

print(f'Sorted {input_file}: players missing photos moved to bottom.')
