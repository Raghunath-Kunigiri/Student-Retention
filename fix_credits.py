import csv
import os

# File path
csv_file = 'Datasets/academic_records.csv'
backup_file = 'Datasets/academic_records_backup.csv'

# Min and max credits
MIN_CREDITS = 9
MAX_CREDITS = 33

# Read the CSV file
rows = []
header = None
updated_count = 0

print(f"Reading {csv_file}...")
with open(csv_file, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)  # Read header
    rows.append(header)
    
    # Find the index of credits_earned column
    credits_index = header.index('credits_earned')
    
    for row in reader:
        if len(row) > credits_index:
            try:
                credits = int(row[credits_index])
                original_credits = credits
                
                # Clamp values to min/max range
                if credits < MIN_CREDITS:
                    credits = MIN_CREDITS
                    updated_count += 1
                    print(f"  Student ID {row[0]}: {original_credits} -> {credits} (too low)")
                elif credits > MAX_CREDITS:
                    credits = MAX_CREDITS
                    updated_count += 1
                    print(f"  Student ID {row[0]}: {original_credits} -> {credits} (too high)")
                
                row[credits_index] = str(credits)
            except ValueError:
                print(f"  Warning: Invalid credits value for student ID {row[0]}: {row[credits_index]}")
        
        rows.append(row)

# Create backup first
print(f"\nCreating backup: {backup_file}...")
with open(backup_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    with open(csv_file, 'r', encoding='utf-8') as original:
        reader = csv.reader(original)
        writer.writerows(reader)

# Write the updated data
print(f"Writing updated data to {csv_file}...")
with open(csv_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    writer.writerows(rows)

print(f"\nDone!")
print(f"  - Backup saved to: {backup_file}")
print(f"  - Total records processed: {len(rows) - 1}")
print(f"  - Records updated: {updated_count}")
print(f"  - Credits range: {MIN_CREDITS} - {MAX_CREDITS}")

