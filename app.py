from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import jwt
import datetime
import os
import hashlib
from functools import wraps
from werkzeug.utils import secure_filename
import pandas as pd
import pyodbc

app = Flask(__name__)
CORS(app)

SECRET_KEY = "hospital_secret_key_change_in_production"
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf', 'dcm', 'xlsx', 'xls', 'csv'}

# Create upload folder if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(os.path.join(UPLOAD_FOLDER, 'medical_files'), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_FOLDER, 'patient_imports'), exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

# Database connection
def get_db_connection():
    server = r"LAPTOP-OGJ9GR0I\SQLEXPRESS"  # Update with your server
    database = "HospitalManagementSystem"
    driver = "{ODBC Driver 17 for SQL Server}"
    
    try:
        connection_string = (
            f"DRIVER={driver};"
            f"SERVER={server};"
            f"DATABASE={database};"
            f"Trusted_Connection=yes;"
            f"autocommit=False;"
        )
        conn = pyodbc.connect(connection_string)
        if conn.autocommit:
            conn.autocommit = False
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        raise Exception("Unable to connect to database")


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def hash_password(password):
    # Simple hash for demo - use bcrypt in production
    return hashlib.sha256(password.encode()).hexdigest()


# =================================================
# TOKEN DECORATOR
# =================================================
def token_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization")
        if not header:
            return jsonify({"error": "Token missing"}), 401
        
        try:
            token = header.split(" ")[1]
            request.user = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        except Exception as e:
            return jsonify({"error": "Invalid token"}), 401
        
        return f(*args, **kwargs)
    return wrapper


# =================================================
# HOME
# =================================================
@app.route("/")
def home():
    return jsonify({
        "message": "🏥 Hospital Management System API",
        "version": "2.0",
        "status": "Running"
    })


# =================================================
# AUTHENTICATION
# =================================================

# Login
@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT UserID, Username, PasswordHash, Email, Role, 
                   PatientID, DoctorID, PharmacistID, IsActive
            FROM Users
            WHERE Username = ? AND IsActive = 1
        """, data["username"])
        
        user = cur.fetchone()
        
        if not user or user.PasswordHash != data["password"]:
            return jsonify({"error": "Invalid credentials"}), 401
        
        token = jwt.encode({
            "user_id": user.UserID,
            "username": user.Username,
            "email": user.Email,
            "role": user.Role,
            "patient_id": user.PatientID,
            "doctor_id": user.DoctorID,
            "pharmacist_id": user.PharmacistID,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8)
        }, SECRET_KEY, algorithm="HS256")
        
        # Update last login
        cur.execute("UPDATE Users SET LastLogin = GETDATE() WHERE UserID = ?", user.UserID)
        conn.commit()
        
        return jsonify({
            "token": token,
            "user": {
                "username": user.Username,
                "email": user.Email,
                "role": user.Role
            }
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# Patient Registration
@app.route("/api/auth/register", methods=["POST"])
def register_patient():
    data = request.json
    
    required_fields = ["username", "password", "email", "name", "gender", "dob", "phone", "address", "blood_group"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Check if username or email already exists
        cur.execute("SELECT UserID FROM Users WHERE Username = ? OR Email = ?", 
                   (data["username"], data["email"]))
        if cur.fetchone():
            return jsonify({"error": "Username or email already exists"}), 400
        
        # Insert patient
        cur.execute("""
            INSERT INTO Patients (PatientName, Email, Gender, DateOfBirth, PhoneNumber, Address, BloodGroup,
                                 EmergencyContact, EmergencyContactName)
            OUTPUT INSERTED.PatientID
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (data["name"], data["email"], data["gender"], data["dob"], data["phone"], 
              data["address"], data["blood_group"], 
              data.get("emergency_contact", ""), data.get("emergency_contact_name", "")))
        
        patient_id = cur.fetchone()[0]
        
        # Create user account
        cur.execute("""
            INSERT INTO Users (Username, PasswordHash, Email, Role, PatientID)
            VALUES (?, ?, ?, 'Patient', ?)
        """, (data["username"], data["password"], data["email"], patient_id))
        
        conn.commit()
        
        return jsonify({
            "message": "Registration successful! Please login.",
            "patient_id": patient_id
        }), 201
    
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# =================================================
# DASHBOARD STATS
# =================================================
@app.route("/api/dashboard/stats", methods=["GET"])
@token_required
def get_dashboard_stats():
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("SELECT * FROM vw_DashboardStats")
        row = cur.fetchone()
        
        stats = {
            "total_patients": row[0] if row else 0,
            "total_doctors": row[1] if row else 0,
            "today_visits": row[2] if row else 0,
            "pending_prescriptions": row[3] if row else 0,
            "pending_tests": row[4] if row else 0
        }
        
        return jsonify(stats)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# =================================================
# PATIENT ENDPOINTS
# =================================================

# Get all patients (Admin/Doctor)
@app.route("/api/patients", methods=["GET"])
@token_required
def get_patients():
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT PatientID, PatientName, Email, Gender, DateOfBirth, PhoneNumber, 
                   Address, BloodGroup, EmergencyContact, EmergencyContactName, CreatedAt
            FROM Patients
            WHERE IsActive = 1
            ORDER BY CreatedAt DESC
        """)
        
        rows = cur.fetchall()
        cols = [c[0] for c in cur.description]
        
        patients = []
        for row in rows:
            patient = {}
            for i, col in enumerate(cols):
                val = row[i]
                if isinstance(val, (datetime.datetime, datetime.date)):
                    val = val.isoformat()
                patient[col] = val
            patients.append(patient)
        
        return jsonify(patients)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# Get patient profile
@app.route("/api/patients/<int:pid>", methods=["GET"])
@token_required
def get_patient(pid):
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT PatientID, PatientName, Email, Gender, DateOfBirth, PhoneNumber, 
                   Address, BloodGroup, EmergencyContact, EmergencyContactName, CreatedAt
            FROM Patients
            WHERE PatientID = ? AND IsActive = 1
        """, pid)
        
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Patient not found"}), 404
        
        cols = [c[0] for c in cur.description]
        patient = {}
        for i, col in enumerate(cols):
            val = row[i]
            if isinstance(val, (datetime.datetime, datetime.date)):
                val = val.isoformat()
            patient[col] = val
        
        return jsonify(patient)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# Update patient
@app.route("/api/patients/<int:pid>", methods=["PUT"])
@token_required
def update_patient(pid):
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            UPDATE Patients
            SET PatientName=?, PhoneNumber=?, Address=?, EmergencyContact=?, EmergencyContactName=?
            WHERE PatientID=?
        """, (data.get("name"), data.get("phone"), data.get("address"), 
              data.get("emergency_contact"), data.get("emergency_contact_name"), pid))
        
        conn.commit()
        
        return jsonify({"message": "Patient updated successfully"})
    
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# =================================================
# DOCTOR ENDPOINTS
# =================================================

# Get all doctors
@app.route("/api/doctors", methods=["GET"])
@token_required
def get_doctors():
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT DoctorID, DoctorName, Email, Specialty, PhoneNumber, 
                   LicenseNumber, YearsOfExperience
            FROM Doctors
            WHERE IsActive = 1
            ORDER BY DoctorName
        """)
        
        rows = cur.fetchall()
        cols = [c[0] for c in cur.description]
        
        doctors = []
        for row in rows:
            doctor = {}
            for i, col in enumerate(cols):
                doctor[col] = row[i]
            doctors.append(doctor)
        
        return jsonify(doctors)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# =================================================
# VISIT ENDPOINTS
# =================================================

# Get all visits
@app.route("/api/visits", methods=["GET"])
@token_required
def get_visits():
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT v.VisitID, v.PatientID, p.PatientName, v.DoctorID, d.DoctorName,
                   v.VisitDate, v.ReasonForVisit, v.VitalSigns, v.Notes, v.Status
            FROM Visits v
            JOIN Patients p ON v.PatientID = p.PatientID
            JOIN Doctors d ON v.DoctorID = d.DoctorID
            ORDER BY v.VisitDate DESC
        """)
        
        rows = cur.fetchall()
        cols = [c[0] for c in cur.description]
        
        visits = []
        for row in rows:
            visit = {}
            for i, col in enumerate(cols):
                val = row[i]
                if isinstance(val, (datetime.datetime, datetime.date)):
                    val = val.isoformat()
                visit[col] = val
            visits.append(visit)
        
        return jsonify(visits)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# Create visit
@app.route("/api/visits", methods=["POST"])
@token_required
def create_visit():
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO Visits (PatientID, DoctorID, ReasonForVisit, VitalSigns, Notes, Status)
            OUTPUT INSERTED.VisitID
            VALUES (?, ?, ?, ?, ?, ?)
        """, (data["patient_id"], data["doctor_id"], data.get("reason", ""), 
              data.get("vital_signs", ""), data.get("notes", ""), data.get("status", "Scheduled")))
        
        visit_id = cur.fetchone()[0]
        conn.commit()
        
        return jsonify({"message": "Visit created", "visit_id": visit_id}), 201
    
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# =================================================
# DIAGNOSIS ENDPOINTS
# =================================================

# Get all records (Doctor)
@app.route("/api/records/all", methods=["GET"])
@token_required
def get_all_records():
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("EXEC sp_GetAllRecords")
        
        rows = cur.fetchall()
        cols = [c[0] for c in cur.description]
        
        records = []
        for row in rows:
            record = {}
            for i, col in enumerate(cols):
                val = row[i]
                if isinstance(val, (datetime.datetime, datetime.date)):
                    val = val.isoformat()
                record[col] = val
            records.append(record)
        
        return jsonify(records)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# Get patient records (Patient)
@app.route("/api/records/my", methods=["GET"])
@token_required
def get_my_records():
    patient_id = request.user.get("patient_id")
    if not patient_id:
        return jsonify({"error": "Not a patient account"}), 403
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("EXEC sp_GetPatientRecords ?", patient_id)
        
        rows = cur.fetchall()
        cols = [c[0] for c in cur.description]
        
        records = []
        for row in rows:
            record = {}
            for i, col in enumerate(cols):
                val = row[i]
                if isinstance(val, (datetime.datetime, datetime.date)):
                    val = val.isoformat()
                record[col] = val
            records.append(record)
        
        return jsonify(records)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# Add diagnosis
@app.route("/api/diagnosis", methods=["POST"])
@token_required
def add_diagnosis():
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO Diagnoses (VisitID, DiagnosisName, Description, IsChronic, Severity)
            OUTPUT INSERTED.DiagnosisID
            VALUES (?, ?, ?, ?, ?)
        """, (data["visit_id"], data["name"], data.get("description", ""), 
              data.get("is_chronic", False), data.get("severity", "Mild")))
        
        diagnosis_id = cur.fetchone()[0]
        conn.commit()
        
        return jsonify({"message": "Diagnosis added", "diagnosis_id": diagnosis_id}), 201
    
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# Update diagnosis
@app.route("/api/diagnosis/<int:did>", methods=["PUT"])
@token_required
def update_diagnosis(did):
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            UPDATE Diagnoses
            SET DiagnosisName=?, Description=?, IsChronic=?, Severity=?
            WHERE DiagnosisID=?
        """, (data["name"], data.get("description", ""), 
              data.get("is_chronic", False), data.get("severity", "Mild"), did))
        
        conn.commit()
        
        return jsonify({"message": "Diagnosis updated"})
    
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# Delete diagnosis
@app.route("/api/diagnosis/<int:did>", methods=["DELETE"])
@token_required
def delete_diagnosis(did):
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("DELETE FROM Diagnoses WHERE DiagnosisID=?", did)
        conn.commit()
        
        return jsonify({"message": "Diagnosis deleted"})
    
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# =================================================
# PRESCRIPTION ENDPOINTS
# =================================================

# Get prescriptions for pharmacy
@app.route("/api/prescriptions", methods=["GET"])
@token_required
def get_prescriptions():
    only_pending = request.args.get('pending', '0') == '1'
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("EXEC sp_GetPrescriptionsForPharmacy ?", only_pending)
        
        rows = cur.fetchall()
        cols = [c[0] for c in cur.description]
        
        prescriptions = []
        for row in rows:
            prescription = {}
            for i, col in enumerate(cols):
                val = row[i]
                if isinstance(val, (datetime.datetime, datetime.date)):
                    val = val.isoformat()
                prescription[col] = val
            prescriptions.append(prescription)
        
        return jsonify(prescriptions)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# Add prescription
@app.route("/api/prescriptions", methods=["POST"])
@token_required
def add_prescription():
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO Prescriptions (VisitID, MedicineName, Dosage, Frequency, Duration, Instructions)
            OUTPUT INSERTED.PrescriptionID
            VALUES (?, ?, ?, ?, ?, ?)
        """, (data["visit_id"], data["medicine"], data.get("dosage", ""), 
              data.get("frequency", ""), data.get("duration", ""), data.get("instructions", "")))
        
        prescription_id = cur.fetchone()[0]
        conn.commit()
        
        return jsonify({"message": "Prescription added", "prescription_id": prescription_id}), 201
    
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# Mark prescription as dispensed
@app.route("/api/prescriptions/<int:pid>/dispense", methods=["POST"])
@token_required
def dispense_prescription(pid):
    pharmacist_id = request.user.get("pharmacist_id")
    if not pharmacist_id:
        return jsonify({"error": "Only pharmacists can dispense"}), 403
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            UPDATE Prescriptions
            SET IsDispensed = 1, DispensedBy = ?, DispensedDate = GETDATE()
            WHERE PrescriptionID = ?
        """, (pharmacist_id, pid))
        
        conn.commit()
        
        return jsonify({"message": "Prescription dispensed"})
    
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# =================================================
# FILE UPLOAD ENDPOINTS
# =================================================

# Upload medical file
@app.route("/api/files/upload", methods=["POST"])
@token_required
def upload_medical_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed"}), 400
    
    patient_id = request.form.get('patient_id')
    visit_id = request.form.get('visit_id', None)
    file_type = request.form.get('file_type', 'Other')
    description = request.form.get('description', '')
    
    if not patient_id:
        return jsonify({"error": "Patient ID required"}), 400
    
    filename = secure_filename(file.filename)
    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    unique_filename = f"{timestamp}_{filename}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], 'medical_files', unique_filename)
    
    file.save(filepath)
    file_size = os.path.getsize(filepath)
    file_ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO MedicalFiles (PatientID, VisitID, UploadedBy, FileType, FileName, 
                                     FileExtension, FilePath, FileSize, Description)
            OUTPUT INSERTED.FileID
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (patient_id, visit_id if visit_id else None, request.user['user_id'], 
              file_type, filename, file_ext, filepath, file_size, description))
        
        file_id = cur.fetchone()[0]
        conn.commit()
        
        return jsonify({
            "message": "File uploaded successfully",
            "file_id": file_id,
            "filename": unique_filename
        }), 201
    
    except Exception as e:
        conn.rollback()
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# Get patient files
@app.route("/api/files/patient/<int:pid>", methods=["GET"])
@token_required
def get_patient_files(pid):
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("EXEC sp_GetPatientFiles ?", pid)
        
        rows = cur.fetchall()
        cols = [c[0] for c in cur.description]
        
        files = []
        for row in rows:
            file_info = {}
            for i, col in enumerate(cols):
                val = row[i]
                if isinstance(val, (datetime.datetime, datetime.date)):
                    val = val.isoformat()
                file_info[col] = val
            files.append(file_info)
        
        return jsonify(files)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# Download file
@app.route("/api/files/download/<int:fid>", methods=["GET"])
@token_required
def download_file(fid):
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("SELECT FilePath, FileName FROM MedicalFiles WHERE FileID = ?", fid)
        result = cur.fetchone()
        
        if not result:
            return jsonify({"error": "File not found"}), 404
        
        filepath, filename = result
        
        if not os.path.exists(filepath):
            return jsonify({"error": "File not found on server"}), 404
        
        return send_file(filepath, as_attachment=True, download_name=filename)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# =================================================
# EXCEL IMPORT (ADMIN)
# =================================================

@app.route("/api/admin/import-patients", methods=["POST"])
@token_required
def import_patients():
    if request.user.get("role") != "Admin":
        return jsonify({"error": "Admin access required"}), 403
    
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        return jsonify({"error": "Only Excel/CSV files allowed"}), 400
    
    filename = secure_filename(file.filename)
    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    unique_filename = f"{timestamp}_{filename}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], 'patient_imports', unique_filename)
    
    file.save(filepath)
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    total_records = 0
    successful_records = 0
    failed_records = 0
    error_log = []
    
    try:
        # Read Excel/CSV file
        if filepath.endswith('.csv'):
            df = pd.read_csv(filepath)
        else:
            df = pd.read_excel(filepath)
        
        total_records = len(df)
        
        # Expected columns: Name, Email, Gender, DOB, Phone, Address, BloodGroup
        required_cols = ['Name', 'Email', 'Gender', 'DOB', 'Phone', 'Address', 'BloodGroup']
        missing_cols = [col for col in required_cols if col not in df.columns]
        
        if missing_cols:
            return jsonify({"error": f"Missing columns: {', '.join(missing_cols)}"}), 400
        
        for index, row in df.iterrows():
            try:
                # Check if patient already exists
                cur.execute("SELECT PatientID FROM Patients WHERE Email = ?", row['Email'])
                if cur.fetchone():
                    error_log.append(f"Row {index+2}: Email {row['Email']} already exists")
                    failed_records += 1
                    continue
                
                # Insert patient
                cur.execute("""
                    INSERT INTO Patients (PatientName, Email, Gender, DateOfBirth, PhoneNumber, Address, BloodGroup)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (row['Name'], row['Email'], row['Gender'], row['DOB'], 
                      row['Phone'], row['Address'], row['BloodGroup']))
                
                successful_records += 1
            
            except Exception as e:
                error_log.append(f"Row {index+2}: {str(e)}")
                failed_records += 1
        
        conn.commit()
        
        # Log import history
        cur.execute("""
            INSERT INTO ImportHistory (ImportedBy, FileName, TotalRecords, SuccessfulRecords, FailedRecords, ErrorLog)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (request.user['user_id'], filename, total_records, successful_records, failed_records, '\n'.join(error_log)))
        
        conn.commit()
        
        return jsonify({
            "message": "Import completed",
            "total": total_records,
            "successful": successful_records,
            "failed": failed_records,
            "errors": error_log
        })
    
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# =================================================
# RUN
# =================================================
if __name__ == "__main__":
    print("🏥 Hospital Management System API Starting...")
    print("📝 Endpoints configured:")
    print("   - Authentication: /api/auth/*")
    print("   - Patients: /api/patients/*")
    print("   - Doctors: /api/doctors/*")
    print("   - Visits: /api/visits/*")
    print("   - Records: /api/records/*")
    print("   - Prescriptions: /api/prescriptions/*")
    print("   - Files: /api/files/*")
    print("   - Admin: /api/admin/*")
    print("✅ Ready!")
    app.run(debug=True, host='0.0.0.0', port=5000)