import pandas as pd
import random
from datetime import datetime, timedelta
import numpy as np

# --- Configuration ---
NUM_STUDENTS = 1000
ADVISOR_COUNT = 4
PRIMARY_MAJOR = 'Computer Science'
NUM_HIGH_RISK = 107  # 10.7% of 1000 students for controlled dropout cohort

# Lists to simulate Faker functionality
COMMON_FIRST_NAMES = ['Aarav', 'Liam', 'Noah', 'Oliver', 'Elijah', 'William', 'James', 'Benjamin', 'Lucas', 'Henry', 'Alexander', 'Maya', 'Olivia', 'Emma', 'Ava', 'Sophia', 'Isabella', 'Charlotte', 'Amelia', 'Mia']
COMMON_LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Garcia', 'Clark']
PHONE_PREFIXES = ['314', '319', '575', '437', '619', '399'] 

# Courses
CS_COURSES = [
    ('CS101', 'Principles of Programming'), ('CS110', 'Object-Oriented Programming'),
    ('CS210', 'Data Structures and Algorithms'), ('CS220', 'Programming Practicum'),
    ('CS340', 'Computer Networks'), ('CS350', 'Database Systems'),
    ('CS360', 'Object-Oriented Software Design'), ('CS401', 'Web Programming'),
    ('CS415', 'Big Data'), ('CS420', 'Computer Vision'),
    ('CS430', 'Parallel Programming'), ('CS440', 'Distributed System'),
    ('CS450', 'Operating Systems'), ('CS460', 'Artificial Intelligence (AI)'),
    ('CS470', 'Applied Machine Learning (ML)'), ('CS471', 'Machine Learning'),
    ('CS480', 'Computer Graphics'), ('CS481', 'Natural Language Processing'),
    ('CS485', 'Autonomous Driving'), ('CS495', 'Internship with Industry'),
    ('CS498', 'Special Topics'), ('CS499', 'Computing and Society')
]
COURSE_COUNT = len(CS_COURSES)
TERMS_COUNT = 4

# --- Static Data and Logic for Customization (Including Advisor Load) ---
STATIC_ADVISORS_DATA = [
    (1, 'Abhinay', 'Gundamani', 'abhinaygundamani@gmail.com', '+1-314-319-0555', 'Computer Science', 500),
    (2, 'Yamini Devi', 'Kadiyam', 'yaminidevi.kadiyam@slu.edu', '(314) 399-6948', 'Computer Science', 500),
    (3, 'Gowtham', 'Kalamandalapadu', 'gowtham.Kalamandalapadu@slu.edu', '+1-314-575-7371', 'Computer Science', 500),
    (4, 'Harshitha', 'Thota', 'harshitha.thota@slu.edu', '+1 317-993-1107', 'Computer Science', 500)
]

STATIC_STUDENTS_DATA = [
    {'first_name': 'Devi Srikanth', 'last_name': 'Jaina', 'email': 'devisrikanthjaina@gmail.com', 'phone': '314-437-9839', 'student_id': 999990},
    {'first_name': 'Siddartha', 'last_name': 'Basam', 'email': 'Siddartha.basam@slu.edu', 'phone': '+1-314-619-7619', 'student_id': 999991}
]
NUM_SYNTHETIC_STUDENTS = NUM_STUDENTS - len(STATIC_STUDENTS_DATA)


# --- Helper Functions ---
def generate_phone():
    return f'+1-{random.choice(PHONE_PREFIXES)}-{random.randint(100, 999)}-{random.randint(1000, 9999)}'

def generate_birth_date():
    start_date = datetime.now() - timedelta(days=365 * 25)
    end_date = datetime.now() - timedelta(days=365 * 18)
    return (start_date + (end_date - start_date) * random.random()).strftime('%Y-%m-%d')

def generate_paragraph():
    words = "This is a synthetic description for a course topic based on computer science principles and applications for machine learning data structures".split()
    return ' '.join(random.choices(words, k=random.randint(5, 10)))

def get_advisor_id(last_name):
    first_letter = last_name[0].upper()
    if 'A' <= first_letter <= 'F':
        return 1
    elif 'G' <= first_letter <= 'M':
        return 2
    elif 'N' <= first_letter <= 'T':
        return 3
    elif 'U' <= first_letter <= 'Z':
        return 4
    return random.randint(1, ADVISOR_COUNT)

# --- Core Student Profile Generation with Controlled Risk ---
def create_student_profile(i, is_forced_high_risk=False):
    student_id = 100000 + i
    first_name = random.choice(COMMON_FIRST_NAMES)
    last_name = random.choice(COMMON_LAST_NAMES)
    year = random.choice(['First Year', 'Second Year', 'Third Year', 'Fourth Year'])
    major = PRIMARY_MAJOR
    
    # Base Logical Links (credits based on year)
    if year == 'First Year': max_credits = 30
    elif year == 'Second Year': max_credits = 60
    elif year == 'Third Year': max_credits = 90
    else: max_credits = 120
    credits_earned = random.randint(max(0, max_credits - 20), max_credits)

    # 1. GPA distribution (Normal Distribution, mean=3.1, std=0.45, clipped)
    gpa = np.random.normal(loc=3.1, scale=0.45)
    gpa = max(1.0, min(4.0, gpa)) 

    # 5. Attendance realism (Poisson distribution with λ = 2.5)
    attendance_absences = np.random.poisson(lam=2.5)

    # 7. Tuition-balance amounts (Log-normal distribution: μ=8, σ=0.4)
    fee_balance = np.random.lognormal(mean=8, sigma=0.4)
    fee_balance = round(max(0, fee_balance), 2)
    
    # 6. Financial-aid distribution (40% Aid, 60% No Aid)
    financial_aid_status = random.choices(['On Financial Aid', 'No Financial Aid'], weights=[0.40, 0.60], k=1)[0]
    
    # --- RULE #10 & #11: Combined Risk Logic and Advisor Load ---
    
    # Default values
    course_load = random.choice([3, 4, 5])
    is_at_risk_combined = False
    
    # 12. Financial stress correlation: 70% of students with fee_balance > 1000 get GPA penalty
    if fee_balance > 1000 and random.random() < 0.70:
        gpa = max(1.0, gpa - random.uniform(0.2, 0.3)) # mild GPA penalty
        gpa = round(gpa, 2)

    # Check Combined Risk (GPA < 2.5 and Debt > $1,000)
    if gpa < 2.5 and fee_balance > 1000:
        is_at_risk_combined = True

    # --- FORCING HIGH RISK FOR 10.7% COHORT ---
    if is_forced_high_risk:
        # 10. Force GPA to trigger high risk
        gpa = round(random.uniform(1.0, 2.4)) 
        # 7/8. Force Fee Balance > 1000 AND Overdue > 180 days (will be enforced in financial_data.csv)
        fee_balance = random.randint(3000, 15000) 
        # 5. Force attendance to high risk
        attendance_absences = random.randint(4, 10) 
        # Force Course Overload
        course_load = 6
        # Force combined risk flag
        is_at_risk_combined = True
    
    # 2. Low-GPA dropout: Set historical dropout based on a 10.7% chance (if GPA < 3.0)
    dropout_status_2024 = 'Retained'
    if gpa < 3.0 and random.random() < 0.107:
        dropout_status_2024 = 'Dropped'
    

    # Final object
    advisor_id = get_advisor_id(last_name)
    current_time = datetime.now().isoformat()
    
    return {
        'student_id': student_id, 'first_name': first_name, 'last_name': last_name, 
        'email': f"{first_name.lower()}.{last_name.lower()}{random.randint(1,99)}@cs.horizoneu.edu",
        'phone': generate_phone(), 'major': major, 'year': year, 'birth_date': generate_birth_date(),
        'enrollment_status': 'Enrolled', 
        'dropout_status_2024': dropout_status_2024,
        'gpa': gpa, 'credits_earned': credits_earned,
        'attendance_absences': attendance_absences, 'fee_balance': fee_balance,
        'financial_aid_status': financial_aid_status, 
        'housing_status': random.choices(['On-campus', 'Off-campus'], weights=[0.85, 0.15], k=1)[0], # Rule 9: 85/15 Housing mix
        'advisor_id': advisor_id, 'created_at': current_time, 'updated_at': current_time,
        'course_load': course_load, # Helper field for enrollment generation
        'at_risk_combined': is_at_risk_combined # Helper flag for validation
    }

# --- GENERATE CORE STUDENT DATA ---
students_data = []

# 1. Generate 107 High Risk Students (Guaranteed failure/high-risk criteria)
for i in range(NUM_HIGH_RISK):
    students_data.append(create_student_profile(i, is_forced_high_risk=True))

# 2. Generate 893 Low Risk Students
for i in range(NUM_HIGH_RISK, NUM_SYNTHETIC_STUDENTS):
    students_data.append(create_student_profile(i, is_forced_high_risk=False))

# 3. Add static students
static_student_index = 0
for static_student in STATIC_STUDENTS_DATA:
    profile = create_student_profile(NUM_SYNTHETIC_STUDENTS + static_student_index, is_forced_high_risk=True) # Set custom students as high risk
    profile.update(static_student) 
    profile['advisor_id'] = get_advisor_id(profile['last_name'])
    
    students_data.append(profile)
    static_student_index += 1

master_df = pd.DataFrame(students_data)

# --- SPLIT AND SAVE CSV FILES ---

# 1. students.csv
students_df = master_df[['student_id', 'first_name', 'last_name', 'email', 'phone', 'major', 'year', 'birth_date', 'enrollment_status', 'dropout_status_2024', 'advisor_id', 'created_at', 'updated_at']]
students_df.to_csv('students.csv', index=False)
print("Generated students.csv (1000 rows)")

# 2. academic_records.csv
academic_df = master_df[['student_id', 'gpa', 'credits_earned', 'attendance_absences']]
academic_df['record_id'] = academic_df.index + 1
academic_df['last_updated'] = datetime.now().isoformat()
academic_df.to_csv('academic_records.csv', index=False)
print("Generated academic_records.csv (1000 rows)")

# 3. financial_data.csv
financial_df = master_df[['student_id', 'fee_balance', 'financial_aid_status']]
financial_df['financial_id'] = financial_df.index + 1
financial_df['last_updated'] = datetime.now().isoformat()

# Rule 8: 15% with overdue > 180 days
def generate_payment_date_and_overdue(row):
    balance = row['fee_balance']
    # 15% chance to be seriously overdue IF they have a high balance
    if balance > 1000 and random.random() < 0.15: 
        overdue_days = random.randint(181, 365) # > 180 days
        payment_date = (datetime.now() - timedelta(days=overdue_days)).strftime('%Y-%m-%d')
        return payment_date, overdue_days
    else:
        # Paid or low balance: Recent date
        return (datetime.now() - timedelta(days=random.randint(1, 90))).strftime('%Y-%m-%d'), 0

financial_data_temp = financial_df.apply(generate_payment_date_and_overdue, axis=1, result_type='expand')
financial_df['last_payment_date'] = financial_data_temp[0]
financial_df['days_overdue'] = financial_data_temp[1]
financial_df.to_csv('financial_data.csv', index=False)
print("Generated financial_data.csv (1000 rows)")

# 4. housing.csv
housing_df = master_df[['student_id', 'housing_status']]
housing_df['housing_id'] = housing_df.index + 1
# Rule 9: Leave building_name/room_number empty for off-campus records.
housing_df['building_name'] = housing_df['housing_status'].apply(lambda x: random.choice(['CS Hall', 'Tech Tower']) if x == 'On-campus' else None)
housing_df['room_number'] = housing_df['housing_status'].apply(lambda x: random.randint(100, 500) if x == 'On-campus' else None)
housing_df['last_updated'] = datetime.now().isoformat()
housing_df.to_csv('housing.csv', index=False)
print("Generated housing.csv (1000 rows)")

# 5. advisors.csv
advisor_data = []
for id, first, last, email, phone, dept, max_students in STATIC_ADVISORS_DATA:
    advisor_data.append([id, first, last, email, phone, dept, max_students, datetime.now().isoformat()])

advisors_df = pd.DataFrame(advisor_data, columns=['advisor_id', 'first_name', 'last_name', 'email', 'phone', 'department', 'max_students', 'created_at'])
advisors_df.to_csv('advisors.csv', index=False)
print("Generated advisors.csv (4 rows)")

# 6. courses.csv
courses_data = []
for i, (code, title) in enumerate(CS_COURSES):
    courses_data.append([i+1, code, title, random.choice([3, 4]), 'Computer Science', generate_paragraph()])

courses_df = pd.DataFrame(courses_data, columns=['course_id', 'course_code', 'course_title', 'credits', 'department', 'description'])
courses_df.to_csv('courses.csv', index=False)
print(f"Generated courses.csv ({COURSE_COUNT} rows)")

# 7. terms.csv
terms_data = [
    [1, 'Fall 2024', '2024-09-01', '2024-12-15', '2024', False], 
    [2, 'Spring 2025', '2025-01-10', '2025-05-15', '2025', False],
    [3, 'Fall 2025', '2025-09-01', '2025-12-15', '2025', True], # Current term is Active
    [4, 'Spring 2026', '2026-01-10', '2026-05-15', '2026', False]
]
terms_df = pd.DataFrame(terms_data, columns=['term_id', 'term_name', 'start_date', 'end_date', 'academic_year', 'is_active'])
terms_df.to_csv('terms.csv', index=False)
print("Generated terms.csv (4 rows)")

# 8. enrollments.csv
enrollments_data = []
cs101_id = courses_df[courses_df['course_code'] == 'CS101']['course_id'].iloc[0]
cs110_id = courses_df[courses_df['course_code'] == 'CS110']['course_id'].iloc[0]

for index, student_row in master_df.iterrows():
    student_id = student_row['student_id']
    course_load = student_row['course_load'] # Use the helper field generated earlier
    
    for term_id in terms_df['term_id']:
        # Set course load based on the profile
        num_courses_enrolled = course_load 
        
        enrolled_courses_temp = random.sample(courses_df['course_id'].tolist(), min(num_courses_enrolled, COURSE_COUNT))
        
        # Ensure CS101/CS110 are in early terms
        if term_id < 3 and cs101_id not in enrolled_courses_temp:
             enrolled_courses_temp.append(cs101_id)
        if term_id < 3 and cs110_id not in enrolled_courses_temp:
             enrolled_courses_temp.append(cs110_id)
        
        enrolled_courses = list(set(enrolled_courses_temp))

        for course_id in enrolled_courses:
            
            status = 'In Progress'
            grade_value = round(random.uniform(2.5, 4.0), 1)
            
            # Rule 3: Intro-programming failure (28%)
            if term_id < 3 and course_id in [cs101_id, cs110_id] and random.random() < 0.28:
                 status = random.choice(['Failed', 'Withdrawn'])
                 grade_value = round(random.uniform(1.0, 1.9), 1)
            elif term_id < 3:
                status = 'Completed'

            enrollments_data.append([
                len(enrollments_data) + 1,
                student_id,
                course_id,
                term_id,
                grade_value if status != 'In Progress' else 'IP',
                status,
                (datetime.now() - timedelta(days=random.randint(90, 365))).isoformat()
            ])

enrollments_df = pd.DataFrame(enrollments_data, columns=['enrollment_id', 'student_id', 'course_id', 'term_id', 'grade', 'status', 'enrolled_date'])
enrollments_df.to_csv('enrollments.csv', index=False)
print(f"Generated enrollments.csv ({len(enrollments_df)} rows)")

print("\n--- Final Data Generation Summary ---")
print(f"Total students: {NUM_STUDENTS}")
print(f"High-Risk (10.7%): {NUM_HIGH_RISK} students are flagged by all core EWS rules.")
print("The dataset is ready for your Flask API and MongoDB integration.")