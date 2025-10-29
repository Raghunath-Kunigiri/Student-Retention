import pandas as pd
import numpy as np
import os
import argparse
import logging
from datetime import datetime
import glob
from collections import defaultdict

# --- Setup Logging ---
def setup_logging(debug_mode, output_dir):
    log_file_path = os.path.join(output_dir, 'retention_script.log')
    
    # Ensure log directory exists
    os.makedirs(output_dir, exist_ok=True)

    log_level = logging.DEBUG if debug_mode else logging.INFO
    logging.basicConfig(level=log_level,
                        format='%(asctime)s - %(levelname)s - %(message)s',
                        handlers=[
                            logging.FileHandler(log_file_path, mode='w'),
                            logging.StreamHandler()
                        ])
    logging.info(f"Logging configured. Log file: {log_file_path}")

# --- Data Loading and Cleaning ---

def read_enrollment_file(file_path, file_format):
    """Reads a single enrollment file (CSV or Excel) into a DataFrame."""
    try:
        if file_format == 'csv':
            df = pd.read_csv(file_path)
        elif file_format in ['xls', 'xlsx']:
            df = pd.read_excel(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_format}")
        logging.info(f"Successfully read {len(df)} rows from {file_path}")
        df['source_file'] = os.path.basename(file_path)
        return df
    except Exception as e:
        logging.error(f"Error reading file {file_path}: {e}")
        return pd.DataFrame() # Return empty DataFrame on error

def standardize_columns(df):
    """Standardizes common student ID, enrollment year, and date column names."""
    col_mapping = {
        # Student ID variations
        'student_id': 'student_id', 'id': 'student_id', 'sid': 'student_id',
        'student id': 'student_id', 'student_no': 'student_id',

        # Enrollment Year variations
        'enrollment_year': 'enrollment_year', 'year': 'enrollment_year',
        'academic_year': 'enrollment_year', 'start_year': 'enrollment_year',

        # Enrollment Date variations
        'enrollment_date': 'enrollment_date', 'date': 'enrollment_date',
        'start_date': 'enrollment_date', 'effective_date': 'enrollment_date',

        # Optional fields
        'institution': 'institution', 'program': 'program',
        'enrollment_status': 'enrollment_status', 'status': 'enrollment_status',
        'transfer_status': 'transfer_status', 'is_transfer': 'transfer_status'
    }

    df.columns = df.columns.str.lower().str.strip().str.replace(' ', '_')
    standardized_df = pd.DataFrame()
    
    for old_col, new_col in col_mapping.items():
        if old_col in df.columns and new_col not in standardized_df.columns:
            standardized_df[new_col] = df[old_col]
        elif new_col not in standardized_df.columns:
            standardized_df[new_col] = np.nan # Ensure column exists even if missing

    # Add any remaining columns that weren't standardized, if desired
    # For this script, we only keep standardized or explicitly mapped columns
    
    return standardized_df

def clean_enrollment_data(df):
    """Cleans and normalizes student enrollment data."""
    if df.empty:
        return pd.DataFrame(), pd.DataFrame()

    initial_rows = len(df)
    
    # Initialize record quality flag
    df['record_quality_flag'] = 'ok'
    excluded_records = pd.DataFrame()

    # Convert student_id to string to prevent mixed types
    if 'student_id' in df.columns:
        df['student_id'] = df['student_id'].astype(str).str.strip()

    # --- Handle Enrollment Year and Date ---
    
    # Attempt to convert enrollment_date to datetime
    if 'enrollment_date' in df.columns:
        df['enrollment_date'] = pd.to_datetime(df['enrollment_date'], errors='coerce')
    else:
        df['enrollment_date'] = pd.NaT # If no date column, create with NaT

    # Fill missing enrollment_year from enrollment_date
    if 'enrollment_year' in df.columns:
        # Convert existing year to float first to handle mixed types gracefully, then to Int64 (nullable integer)
        df['enrollment_year'] = pd.to_numeric(df['enrollment_year'], errors='coerce').astype('Int64')
        
        missing_year_mask = df['enrollment_year'].isna()
        if 'enrollment_date' in df.columns:
            df.loc[missing_year_mask & df['enrollment_date'].notna(), 'enrollment_year'] = \
                df.loc[missing_year_mask & df['enrollment_date'].notna(), 'enrollment_date'].dt.year.astype('Int64')
            
            df.loc[missing_year_mask & df['enrollment_date'].notna(), 'record_quality_flag'] = 'year_extracted_from_date'
            logging.debug(f"Filled {len(df.loc[missing_year_mask & df['enrollment_date'].notna()])} missing enrollment years from dates.")
    else:
        # If no enrollment_year column initially, create it from date
        df['enrollment_year'] = df['enrollment_date'].dt.year.astype('Int64')
        df.loc[df['enrollment_year'].notna(), 'record_quality_flag'] = 'year_extracted_from_date'


    # Handle records where both student_id and enrollment_year are missing
    invalid_records_mask = df['student_id'].isna() | df['enrollment_year'].isna()
    if invalid_records_mask.any():
        excluded = df[invalid_records_mask].copy()
        excluded['exclusion_reason'] = 'Missing student_id or enrollment_year'
        excluded_records = pd.concat([excluded_records, excluded])
        df = df[~invalid_records_mask]
        logging.warning(f"Excluded {len(excluded)} records due to missing student_id or enrollment_year.")
        logging.debug(f"Excluded records sample:\n{excluded.head()}")

    # Deduplicate: Keep earliest enrollment date for same student_id and enrollment_year
    # If enrollment_date is missing, try to use other criteria, here we'll keep the first encountered.
    df = df.sort_values(by=['student_id', 'enrollment_year', 'enrollment_date'])
    
    initial_unique_enrollments = len(df)
    df_deduplicated = df.drop_duplicates(subset=['student_id', 'enrollment_year'], keep='first')
    
    num_duplicates = initial_unique_enrollments - len(df_deduplicated)
    if num_duplicates > 0:
        logging.info(f"Removed {num_duplicates} duplicate enrollments (same student, same year), keeping earliest date or first record.")
        # Mark duplicates in record_quality_flag for original records if they were kept
        original_duplicates_mask = df.duplicated(subset=['student_id', 'enrollment_year'], keep=False)
        df_deduplicated.loc[df_deduplicated.duplicated(subset=['student_id', 'enrollment_year'], keep='first'), 'record_quality_flag'] = 'duplicate_resolved_kept_first'
        
        # Add the duplicates that were removed to excluded_records if you want to track them explicitly
        removed_duplicates = df[~df.index.isin(df_deduplicated.index)].copy()
        removed_duplicates['exclusion_reason'] = 'Duplicate enrollment (same student, same year) - removed'
        excluded_records = pd.concat([excluded_records, removed_duplicates])


    # Normalize enrollment_date to ISO format
    if 'enrollment_date' in df_deduplicated.columns:
        df_deduplicated['enrollment_date'] = df_deduplicated['enrollment_date'].dt.strftime('%Y-%m-%d').replace({np.nan: None})
    
    logging.info(f"Cleaned data from {initial_rows} rows down to {len(df_deduplicated)} valid unique enrollments.")
    return df_deduplicated, excluded_records

def get_first_enrollment_year(df):
    """Calculates the cohort year for each student."""
    if df.empty:
        return pd.DataFrame()

    # Ensure enrollment_year is sortable
    df['enrollment_year'] = pd.to_numeric(df['enrollment_year'], errors='coerce')
    
    # Find the minimum enrollment year for each student to define their cohort
    cohort_years = df.groupby('student_id')['enrollment_year'].min().rename('cohort_year')
    df = df.merge(cohort_years, on='student_id', how='left')
    
    df['cohort_year'] = df['cohort_year'].astype('Int64') # Ensure it's nullable integer
    
    logging.info("Calculated cohort year for each student based on their earliest enrollment.")
    return df

# --- Retention Calculation ---

def calculate_retention(canonical_df, min_year, max_year, exclude_transfers):
    """Calculates retention rates for each cohort."""
    if canonical_df.empty:
        return pd.DataFrame()

    if exclude_transfers and 'transfer_status' in canonical_df.columns:
        initial_count = len(canonical_df)
        canonical_df = canonical_df[canonical_df['transfer_status'].isna() | (canonical_df['transfer_status'].astype(str).str.lower() != 'transferred_in')]
        logging.info(f"Excluded {initial_count - len(canonical_df)} records due to transfer_in status (if present and flagged).")

    summary_data = []

    # Get unique cohort years within the specified range
    valid_cohort_years = canonical_df['cohort_year'].dropna().unique()
    valid_cohort_years = [y for y in valid_cohort_years if min_year <= y <= max_year]
    valid_cohort_years.sort()

    for cohort_year in valid_cohort_years:
        cohort_members_df = canonical_df[
            (canonical_df['cohort_year'] == cohort_year) &
            (canonical_df['enrollment_year'] == cohort_year)
        ]
        cohort_size = cohort_members_df['student_id'].nunique()

        if cohort_size == 0:
            logging.warning(f"Cohort {cohort_year} has size 0 after filtering; skipping.")
            continue
        
        # Students from this cohort who enrolled in the next year (Y+1)
        retained_next_year = canonical_df[
            (canonical_df['cohort_year'] == cohort_year) &
            (canonical_df['enrollment_year'] == cohort_year + 1)
        ]['student_id'].nunique()

        retention_rate_1yr = (retained_next_year / cohort_size) * 100 if cohort_size > 0 else 0

        # Students from this cohort who enrolled two years later (Y+2)
        retained_two_years = canonical_df[
            (canonical_df['cohort_year'] == cohort_year) &
            (canonical_df['enrollment_year'] == cohort_year + 2)
        ]['student_id'].nunique()

        retention_rate_2yr = (retained_two_years / cohort_size) * 100 if cohort_size > 0 else 0

        summary_data.append({
            'cohort_year': cohort_year,
            'cohort_size': cohort_size,
            'retained_next_year_count': retained_next_year,
            'retention_rate_percent': round(retention_rate_1yr, 2),
            'retained_two_years_count': retained_two_years,
            'retention_2yr_percent': round(retention_rate_2yr, 2)
        })
    
    logging.info(f"Calculated retention rates for {len(summary_data)} cohorts.")
    return pd.DataFrame(summary_data).sort_values('cohort_year')

# --- Main Processing Function ---

def process_enrollment_data(input_paths, output_dir, file_formats, min_year, max_year, exclude_transfers):
    all_enrollments = []
    all_excluded_records = []
    
    processed_files_count = 0

    for path in input_paths:
        if os.path.isdir(path):
            logging.info(f"Processing files in directory: {path}")
            for ext in file_formats:
                for file_path in glob.glob(os.path.join(path, f'*.{ext}')):
                    processed_files_count += 1
                    df_raw = read_enrollment_file(file_path, ext)
                    if not df_raw.empty:
                        df_standardized = standardize_columns(df_raw)
                        df_cleaned, df_excluded = clean_enrollment_data(df_standardized)
                        all_enrollments.append(df_cleaned)
                        all_excluded_records.append(df_excluded)
        elif os.path.isfile(path):
            processed_files_count += 1
            file_name, file_extension = os.path.splitext(path)
            file_format = file_extension[1:].lower() # Remove the dot
            if file_format in file_formats:
                df_raw = read_enrollment_file(path, file_format)
                if not df_raw.empty:
                    df_standardized = standardize_columns(df_raw)
                    df_cleaned, df_excluded = clean_enrollment_data(df_standardized)
                    all_enrollments.append(df_cleaned)
                    all_excluded_records.append(df_excluded)
            else:
                logging.warning(f"Skipping file {path}: format '{file_format}' not in allowed formats {file_formats}")
        else:
            logging.error(f"Input path not found or invalid: {path}")

    if not all_enrollments:
        logging.error("No valid enrollment data was processed from inputs.")
        return

    # Concatenate all cleaned enrollments
    combined_enrollments = pd.concat(all_enrollments, ignore_index=True)
    logging.info(f"Combined {len(all_enrollments)} dataframes into {len(combined_enrollments)} total clean records.")

    # Calculate cohort years
    canonical_enrollments = get_first_enrollment_year(combined_enrollments)

    # Filter by min_year and max_year for relevant enrollment years
    canonical_enrollments = canonical_enrollments[
        (canonical_enrollments['enrollment_year'] >= min_year) &
        (canonical_enrollments['enrollment_year'] <= max_year)
    ]
    logging.info(f"Filtered canonical enrollments to {len(canonical_enrollments)} records between years {min_year} and {max_year}.")

    # Calculate retention
    retention_summary = calculate_retention(canonical_enrollments, min_year, max_year, exclude_transfers)

    # --- Write Outputs ---
    os.makedirs(output_dir, exist_ok=True)
    
    canonical_output_path = os.path.join(output_dir, 'canonical_enrollments.csv')
    retention_output_path = os.path.join(output_dir, 'cohort_retention_summary.csv')
    excluded_output_path = os.path.join(output_dir, 'excluded_records.csv')

    canonical_enrollments.to_csv(canonical_output_path, index=False)
    logging.info(f"Canonical enrollment data written to: {canonical_output_path}")

    retention_summary.to_csv(retention_output_path, index=False)
    logging.info(f"Cohort retention summary written to: {retention_output_path}")

    if all_excluded_records:
        combined_excluded = pd.concat(all_excluded_records, ignore_index=True)
        if not combined_excluded.empty:
            combined_excluded.to_csv(excluded_output_path, index=False)
            logging.info(f"Excluded records written to: {excluded_output_path} ({len(combined_excluded)} records)")
        else:
            logging.info("No records were explicitly excluded during processing.")
    else:
        logging.info("No records were explicitly excluded during processing.")
    
    logging.info(f"Processing complete. Total files processed: {processed_files_count}")

# --- CLI Argument Parsing ---
def main():
    parser = argparse.ArgumentParser(description="Clean student enrollment data and calculate retention rates.")
    parser.add_argument('--input', nargs='+', required=True,
                        help='One or more paths to input files (CSV, Excel) or directories containing them.')
    parser.add_argument('--output-dir', type=str, default='output',
                        help='Directory to save the output files.')
    parser.add_argument('--formats', nargs='+', default=['csv', 'xlsx', 'xls'],
                        choices=['csv', 'xls', 'xlsx'],
                        help='List of file formats to process (e.g., csv xlsx).')
    parser.add_argument('--min-year', type=int, default=2000,
                        help='Minimum enrollment year to consider for retention calculations.')
    parser.add_argument('--max-year', type=int, default=datetime.now().year,
                        help='Maximum enrollment year to consider for retention calculations.')
    parser.add_argument('--exclude-transfers', action='store_true',
                        help='Exclude students explicitly marked as "transferred_in" from retention calculations.')
    parser.add_argument('--debug', action='store_true',
                        help='Enable debug logging.')

    args = parser.parse_args()

    setup_logging(args.debug, args.output_dir)

    logging.info(f"Script started with arguments: {vars(args)}")
    
    process_enrollment_data(args.input, args.output_dir, args.formats,
                            args.min_year, args.max_year, args.exclude_transfers)

if __name__ == "__main__":
    main()