import React, { useState, useEffect } from 'react';
import { 
  Activity, User, Users, FileText, PlusCircle, Edit2, Trash2, LogOut, 
  Shield, Stethoscope, Heart, Upload, Download, FileImage, UserPlus,
  Pill, CheckCircle, Clock, Calendar, Phone, Mail, MapPin, Droplet
} from 'lucide-react';
import './App.css';

// TypeScript Interfaces
interface LoginData {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  password: string;
  email: string;
  name: string;
  gender: string;
  dob: string;
  phone: string;
  address: string;
  blood_group: string;
  emergency_contact: string;
  emergency_contact_name: string;
}

interface User {
  user_id: number;
  username: string;
  email: string;
  role: string;
  patient_id?: number;
  doctor_id?: number;
  pharmacist_id?: number;
}

interface Patient {
  PatientID?: number;
  PatientName: string;
  Email: string;
  Gender: string;
  DateOfBirth: string;
  PhoneNumber: string;
  Address: string;
  BloodGroup: string;
  EmergencyContact?: string;
  EmergencyContactName?: string;
}

interface Doctor {
  DoctorID: number;
  DoctorName: string;
  Email: string;
  Specialty: string;
  PhoneNumber: string;
}

interface Visit {
  VisitID?: number;
  PatientID: number;
  DoctorID: number;
  ReasonForVisit: string;
  VitalSigns?: string;
  Notes?: string;
  Status: string;
}

interface Diagnosis {
  DiagnosisID?: number;
  VisitID: number;
  DiagnosisName: string;
  Description: string;
  IsChronic: boolean;
  Severity: string;
}

interface Prescription {
  PrescriptionID: number;
  PatientID?: number;
  PatientName: string;
  MedicineName: string;
  Dosage: string;
  Frequency: string;
  Duration: string;
  Instructions?: string;
  IsDispensed: boolean;
  DispensedDate?: string;
  DoctorName: string;
  VisitDate: string;
}

interface MedicalFile {
  FileID: number;
  FileType: string;
  FileName: string;
  FileSize: number;
  Description: string;
  UploadedAt: string;
  UploadedByUsername: string;
}

interface DashboardStats {
  total_patients: number;
  total_doctors: number;
  today_visits: number;
  pending_prescriptions: number;
  pending_tests: number;
}

const API_BASE = 'http://localhost:5000/api';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [showRegister, setShowRegister] = useState(false);
  
  // State for data
  const [records, setRecords] = useState<any[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medicalFiles, setMedicalFiles] = useState<MedicalFile[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total_patients: 0,
    total_doctors: 0,
    today_visits: 0,
    pending_prescriptions: 0,
    pending_tests: 0
  });
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [loginForm, setLoginForm] = useState<LoginData>({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState<RegisterData>({
    username: '', password: '', email: '', name: '', gender: 'Male',
    dob: '', phone: '', address: '', blood_group: 'O+',
    emergency_contact: '', emergency_contact_name: ''
  });
  
  const [visitForm, setVisitForm] = useState<Visit>({
    PatientID: 0, DoctorID: 0, ReasonForVisit: '', VitalSigns: '', Notes: '', Status: 'Scheduled'
  });
  
  const [diagnosisForm, setDiagnosisForm] = useState<Diagnosis>({
    VisitID: 0, DiagnosisName: '', Description: '', IsChronic: false, Severity: 'Mild'
  });

  const [prescriptionForm, setPrescriptionForm] = useState({
    visit_id: 0, medicine: '', dosage: '', frequency: '', duration: '', instructions: ''
  });

  const [fileUpload, setFileUpload] = useState({
    file: null as File | null,
    file_type: 'X-Ray',
    description: '',
    visit_id: ''
  });

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [pendingOnly, setPendingOnly] = useState(false);

  // Decode JWT
  useEffect(() => {
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => 
          '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
        setUser(JSON.parse(jsonPayload));
      } catch (e) {
        console.error('Invalid token');
        handleLogout();
      }
    }
  }, [token]);

  // Fetch data based on role
  useEffect(() => {
    if (user && token) {
      fetchDashboardStats();
      
      if (user.role === 'Doctor') {
        fetchAllRecords();
        fetchDoctors();
        fetchPatients();
        fetchVisits();
      } else if (user.role === 'Patient') {
        fetchMyRecords();
        fetchMyFiles();
      } else if (user.role === 'Admin') {
        fetchPatients();
      } else if (user.role === 'Pharmacist') {
        fetchPrescriptions();
      }
    }
  }, [user, token, activeView]);

  // API Calls
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
      } else {
        alert(data.error || 'Login failed');
      }
    } catch (err) {
      alert('Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert('Registration successful! Please login.');
        setShowRegister(false);
        setRegisterForm({
          username: '', password: '', email: '', name: '', gender: 'Male',
          dob: '', phone: '', address: '', blood_group: 'O+',
          emergency_contact: '', emergency_contact_name: ''
        });
      } else {
        alert(data.error || 'Registration failed');
      }
    } catch (err) {
      alert('Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setActiveView('dashboard');
  };

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats');
    }
  };

  const fetchAllRecords = async () => {
    try {
      const res = await fetch(`${API_BASE}/records/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setRecords(data);
    } catch (err) {
      console.error('Failed to fetch records');
    }
  };

  const fetchMyRecords = async () => {
    try {
      const res = await fetch(`${API_BASE}/records/my`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setRecords(data);
    } catch (err) {
      console.error('Failed to fetch records');
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await fetch(`${API_BASE}/patients`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setPatients(data);
    } catch (err) {
      console.error('Failed to fetch patients');
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await fetch(`${API_BASE}/doctors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setDoctors(data);
    } catch (err) {
      console.error('Failed to fetch doctors');
    }
  };

  const fetchVisits = async () => {
    try {
      const res = await fetch(`${API_BASE}/visits`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setVisits(data);
    } catch (err) {
      console.error('Failed to fetch visits');
    }
  };

  const fetchPrescriptions = async () => {
    try {
      const url = pendingOnly ? `${API_BASE}/prescriptions?pending=1` : `${API_BASE}/prescriptions`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setPrescriptions(data);
    } catch (err) {
      console.error('Failed to fetch prescriptions');
    }
  };

  const fetchMyFiles = async () => {
    if (!user?.patient_id) return;
    
    try {
      const res = await fetch(`${API_BASE}/files/patient/${user.patient_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setMedicalFiles(data);
    } catch (err) {
      console.error('Failed to fetch files');
    }
  };

  const createVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/visits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patient_id: visitForm.PatientID,
          doctor_id: visitForm.DoctorID,
          reason: visitForm.ReasonForVisit,
          vital_signs: visitForm.VitalSigns,
          notes: visitForm.Notes,
          status: visitForm.Status
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert('Visit created successfully');
        setVisitForm({
          PatientID: 0, DoctorID: 0, ReasonForVisit: '', VitalSigns: '', Notes: '', Status: 'Scheduled'
        });
        fetchVisits();
      } else {
        alert(data.error || 'Failed to create visit');
      }
    } catch (err) {
      alert('Failed to create visit');
    } finally {
      setLoading(false);
    }
  };

  const addDiagnosis = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/diagnosis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          visit_id: diagnosisForm.VisitID,
          name: diagnosisForm.DiagnosisName,
          description: diagnosisForm.Description,
          is_chronic: diagnosisForm.IsChronic,
          severity: diagnosisForm.Severity
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert('Diagnosis added successfully');
        setDiagnosisForm({
          VisitID: 0, DiagnosisName: '', Description: '', IsChronic: false, Severity: 'Mild'
        });
        fetchAllRecords();
      } else {
        alert(data.error || 'Failed to add diagnosis');
      }
    } catch (err) {
      alert('Failed to add diagnosis');
    } finally {
      setLoading(false);
    }
  };

  const addPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/prescriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(prescriptionForm)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert('Prescription added successfully');
        setPrescriptionForm({
          visit_id: 0, medicine: '', dosage: '', frequency: '', duration: '', instructions: ''
        });
        fetchAllRecords();
      } else {
        alert(data.error || 'Failed to add prescription');
      }
    } catch (err) {
      alert('Failed to add prescription');
    } finally {
      setLoading(false);
    }
  };

  const dispensePrescription = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/prescriptions/${id}/dispense`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        alert('Prescription dispensed successfully');
        fetchPrescriptions();
      }
    } catch (err) {
      alert('Failed to dispense prescription');
    }
  };

  const uploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileUpload.file) {
      alert('Please select a file');
      return;
    }
    
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', fileUpload.file);
      formData.append('patient_id', user?.patient_id?.toString() || '');
      formData.append('file_type', fileUpload.file_type);
      formData.append('description', fileUpload.description);
      if (fileUpload.visit_id) {
        formData.append('visit_id', fileUpload.visit_id);
      }
      
      const res = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert('File uploaded successfully');
        setFileUpload({ file: null, file_type: 'X-Ray', description: '', visit_id: '' });
        fetchMyFiles();
      } else {
        alert(data.error || 'Failed to upload file');
      }
    } catch (err) {
      alert('Failed to upload file');
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (fileId: number, fileName: string) => {
    try {
      const res = await fetch(`${API_BASE}/files/download/${fileId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      alert('Failed to download file');
    }
  };

  const importPatients = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      alert('Please select a file');
      return;
    }
    
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      
      const res = await fetch(`${API_BASE}/admin/import-patients`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setImportResult(data);
        setImportFile(null);
        fetchPatients();
      } else {
        alert(data.error || 'Failed to import patients');
      }
    } catch (err) {
      alert('Failed to import patients');
    } finally {
      setLoading(false);
    }
  };

  // Login/Register Screen
  if (!token || !user) {
    return (
      <div className="login-container">
        <div className="login-bg"></div>
        <div className="login-card">
          {!showRegister ? (
            <>
              <div className="login-header">
                <div className="logo-container">
                  <Heart className="logo-icon" />
                </div>
                <h1>MediCare Plus</h1>
                <p>Complete Hospital Management System</p>
              </div>
              
              <form onSubmit={handleLogin} className="login-form">
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    placeholder="Enter your username"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    placeholder="Enter your password"
                    required
                  />
                </div>
                
                <button type="submit" className="login-btn" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
              
              <div className="register-link">
                <p>New patient? <button onClick={() => setShowRegister(true)} className="link-btn">Register here</button></p>
              </div>
              
              <div className="demo-credentials">
                <p><strong>Demo Logins:</strong></p>
                <p>👨‍⚕️ Doctor: dr_anil / doctor123</p>
                <p>👤 Patient: rahul_p / password123</p>
                <p>💊 Pharmacist: pharm_amit / pharmacy123</p>
                <p>🔐 Admin: admin / admin123</p>
              </div>
            </>
          ) : (
            <>
              <div className="login-header">
                <div className="logo-container">
                  <UserPlus className="logo-icon" />
                </div>
                <h1>Patient Registration</h1>
                <p>Create your account</p>
              </div>
              
              <form onSubmit={handleRegister} className="register-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Username *</label>
                    <input
                      type="text"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      type="password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      required
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Gender *</label>
                    <select
                      value={registerForm.gender}
                      onChange={(e) => setRegisterForm({ ...registerForm, gender: e.target.value })}
                      required
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Date of Birth *</label>
                    <input
                      type="date"
                      value={registerForm.dob}
                      onChange={(e) => setRegisterForm({ ...registerForm, dob: e.target.value })}
                      required
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Phone Number *</label>
                    <input
                      type="tel"
                      value={registerForm.phone}
                      onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Blood Group *</label>
                    <select
                      value={registerForm.blood_group}
                      onChange={(e) => setRegisterForm({ ...registerForm, blood_group: e.target.value })}
                      required
                    >
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Address *</label>
                  <input
                    type="text"
                    value={registerForm.address}
                    onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
                    required
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Emergency Contact Name</label>
                    <input
                      type="text"
                      value={registerForm.emergency_contact_name}
                      onChange={(e) => setRegisterForm({ ...registerForm, emergency_contact_name: e.target.value })}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Emergency Contact Phone</label>
                    <input
                      type="tel"
                      value={registerForm.emergency_contact}
                      onChange={(e) => setRegisterForm({ ...registerForm, emergency_contact: e.target.value })}
                    />
                  </div>
                </div>
                
                <button type="submit" className="login-btn" disabled={loading}>
                  {loading ? 'Registering...' : 'Register'}
                </button>
              </form>
              
              <div className="register-link">
                <p>Already have an account? <button onClick={() => setShowRegister(false)} className="link-btn">Login here</button></p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Main Dashboard
  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Heart className="sidebar-logo" />
          <div>
            <h2>MediCare</h2>
            <p className="sidebar-subtitle">{user.role}</p>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={activeView === 'dashboard' ? 'active' : ''}
            onClick={() => setActiveView('dashboard')}
          >
            <Activity /> Dashboard
          </button>
          
          {user.role === 'Doctor' && (
            <>
              <button 
                className={activeView === 'records' ? 'active' : ''}
                onClick={() => setActiveView('records')}
              >
                <FileText /> All Records
              </button>
              <button 
                className={activeView === 'create-visit' ? 'active' : ''}
                onClick={() => setActiveView('create-visit')}
              >
                <PlusCircle /> Create Visit
              </button>
              <button 
                className={activeView === 'add-diagnosis' ? 'active' : ''}
                onClick={() => setActiveView('add-diagnosis')}
              >
                <Stethoscope /> Add Diagnosis
              </button>
              <button 
                className={activeView === 'add-prescription' ? 'active' : ''}
                onClick={() => setActiveView('add-prescription')}
              >
                <Pill /> Add Prescription
              </button>
            </>
          )}
          
          {user.role === 'Patient' && (
            <>
              <button 
                className={activeView === 'my-records' ? 'active' : ''}
                onClick={() => setActiveView('my-records')}
              >
                <FileText /> My Records
              </button>
              <button 
                className={activeView === 'my-files' ? 'active' : ''}
                onClick={() => setActiveView('my-files')}
              >
                <FileImage /> My Files
              </button>
              <button 
                className={activeView === 'upload-file' ? 'active' : ''}
                onClick={() => setActiveView('upload-file')}
              >
                <Upload /> Upload File
              </button>
            </>
          )}
          
          {user.role === 'Pharmacist' && (
            <button 
              className={activeView === 'prescriptions' ? 'active' : ''}
              onClick={() => setActiveView('prescriptions')}
            >
              <Pill /> Prescriptions
            </button>
          )}
          
          {user.role === 'Admin' && (
            <>
              <button 
                className={activeView === 'patients' ? 'active' : ''}
                onClick={() => setActiveView('patients')}
              >
                <Users /> Patients
              </button>
              <button 
                className={activeView === 'import' ? 'active' : ''}
                onClick={() => setActiveView('import')}
              >
                <Upload /> Import Patients
              </button>
            </>
          )}
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-info">
            <User size={16} />
            <span>{user.username}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="content-header">
          <div>
            <h1>
              {activeView === 'dashboard' && 'Dashboard'}
              {activeView === 'records' && 'All Medical Records'}
              {activeView === 'my-records' && 'My Medical Records'}
              {activeView === 'create-visit' && 'Create New Visit'}
              {activeView === 'add-diagnosis' && 'Add Diagnosis'}
              {activeView === 'add-prescription' && 'Add Prescription'}
              {activeView === 'my-files' && 'My Medical Files'}
              {activeView === 'upload-file' && 'Upload Medical File'}
              {activeView === 'prescriptions' && 'Prescriptions Management'}
              {activeView === 'patients' && 'Patient Management'}
              {activeView === 'import' && 'Import Patients'}
            </h1>
            <p className="subtitle">Welcome back, {user.username}</p>
          </div>
          
          <div className="user-badge">
            {user.role === 'Doctor' && <Stethoscope />}
            {user.role === 'Patient' && <User />}
            {user.role === 'Pharmacist' && <Pill />}
            {user.role === 'Admin' && <Shield />}
            <span>{user.role}</span>
          </div>
        </header>

        <div className="content-body">
          {/* Dashboard View */}
          {activeView === 'dashboard' && (
            <div className="dashboard-grid">
              <div className="stat-card stat-primary">
                <div className="stat-icon">
                  <Users />
                </div>
                <div className="stat-details">
                  <h3>{stats.total_patients}</h3>
                  <p>Total Patients</p>
                </div>
              </div>
              
              <div className="stat-card stat-success">
                <div className="stat-icon">
                  <Stethoscope />
                </div>
                <div className="stat-details">
                  <h3>{stats.total_doctors}</h3>
                  <p>Total Doctors</p>
                </div>
              </div>
              
              <div className="stat-card stat-warning">
                <div className="stat-icon">
                  <Calendar />
                </div>
                <div className="stat-details">
                  <h3>{stats.today_visits}</h3>
                  <p>Today's Visits</p>
                </div>
              </div>
              
              <div className="stat-card stat-danger">
                <div className="stat-icon">
                  <Pill />
                </div>
                <div className="stat-details">
                  <h3>{stats.pending_prescriptions}</h3>
                  <p>Pending Prescriptions</p>
                </div>
              </div>

              <div className="welcome-card">
                <h2>Welcome to MediCare Plus 🏥</h2>
                <p>Your comprehensive hospital management solution with complete patient care features.</p>
                
                {user.role === 'Patient' && (
                  <div className="patient-quick-info">
                    <div className="info-item">
                      <FileText size={20} />
                      <div>
                        <strong>{records.length}</strong>
                        <span>Medical Records</span>
                      </div>
                    </div>
                    <div className="info-item">
                      <FileImage size={20} />
                      <div>
                        <strong>{medicalFiles.length}</strong>
                        <span>Uploaded Files</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="quick-actions">
                  {user.role === 'Doctor' && (
                    <>
                      <button onClick={() => setActiveView('create-visit')} className="action-btn">
                        Create Visit
                      </button>
                      <button onClick={() => setActiveView('records')} className="action-btn secondary">
                        View Records
                      </button>
                    </>
                  )}
                  {user.role === 'Patient' && (
                    <>
                      <button onClick={() => setActiveView('my-records')} className="action-btn">
                        View My Records
                      </button>
                      <button onClick={() => setActiveView('upload-file')} className="action-btn secondary">
                        Upload File
                      </button>
                    </>
                  )}
                  {user.role === 'Pharmacist' && (
                    <button onClick={() => setActiveView('prescriptions')} className="action-btn">
                      View Prescriptions
                    </button>
                  )}
                  {user.role === 'Admin' && (
                    <>
                      <button onClick={() => setActiveView('patients')} className="action-btn">
                        Manage Patients
                      </button>
                      <button onClick={() => setActiveView('import')} className="action-btn secondary">
                        Import Patients
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* All Records View */}
          {(activeView === 'records' || activeView === 'my-records') && (
            <div className="records-container">
              {records.length === 0 ? (
                <div className="empty-state">
                  <FileText size={64} />
                  <h3>No records found</h3>
                  <p>There are no medical records to display at this time.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Doctor</th>
                        <th>Visit Date</th>
                        <th>Diagnosis</th>
                        <th>Medicine</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record, idx) => (
                        <tr key={idx}>
                          <td>
                            <div className="patient-cell">
                              <strong>{record.PatientName}</strong>
                              <span className="badge blood-group">{record.BloodGroup}</span>
                            </div>
                          </td>
                          <td>
                            <div className="doctor-cell">
                              <strong>{record.DoctorName}</strong>
                              <small>{record.Specialty}</small>
                            </div>
                          </td>
                          <td>{new Date(record.VisitDate).toLocaleDateString()}</td>
                          <td>{record.DiagnosisName || 'N/A'}</td>
                          <td>{record.MedicineName || 'N/A'}</td>
                          <td>
                            <span className={`status-badge ${record.IsDispensed ? 'dispensed' : 'pending'}`}>
                              {record.IsDispensed ? 'Dispensed' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Create Visit Form */}
          {activeView === 'create-visit' && (
            <div className="form-container">
              <form onSubmit={createVisit} className="data-form">
                <h3>📋 Visit Information</h3>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Patient *</label>
                    <select
                      value={visitForm.PatientID || ''}
                      onChange={(e) => setVisitForm({ ...visitForm, PatientID: parseInt(e.target.value) })}
                      required
                    >
                      <option value="">Select Patient</option>
                      {patients.map(p => (
                        <option key={p.PatientID} value={p.PatientID}>
                          {p.PatientName} - {p.BloodGroup}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Doctor *</label>
                    <select
                      value={visitForm.DoctorID || ''}
                      onChange={(e) => setVisitForm({ ...visitForm, DoctorID: parseInt(e.target.value) })}
                      required
                    >
                      <option value="">Select Doctor</option>
                      {doctors.map(d => (
                        <option key={d.DoctorID} value={d.DoctorID}>
                          {d.DoctorName} - {d.Specialty}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Reason for Visit *</label>
                  <input
                    type="text"
                    value={visitForm.ReasonForVisit}
                    onChange={(e) => setVisitForm({ ...visitForm, ReasonForVisit: e.target.value })}
                    placeholder="e.g., Chest pain, Fever, Follow-up"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Vital Signs (JSON format)</label>
                  <textarea
                    value={visitForm.VitalSigns}
                    onChange={(e) => setVisitForm({ ...visitForm, VitalSigns: e.target.value })}
                    placeholder='{"bp": "120/80", "temp": "98.6", "pulse": "72"}'
                    rows={3}
                  />
                </div>
                
                <div className="form-group">
                  <label>Clinical Notes</label>
                  <textarea
                    value={visitForm.Notes}
                    onChange={(e) => setVisitForm({ ...visitForm, Notes: e.target.value })}
                    placeholder="Additional notes about the visit..."
                    rows={4}
                  />
                </div>
                
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={visitForm.Status}
                    onChange={(e) => setVisitForm({ ...visitForm, Status: e.target.value })}
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Visit'}
                </button>
              </form>
            </div>
          )}

          {/* Add Diagnosis Form */}
          {activeView === 'add-diagnosis' && (
            <div className="form-container">
              <form onSubmit={addDiagnosis} className="data-form">
                <h3>🩺 Diagnosis Information</h3>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Visit *</label>
                    <select
                      value={diagnosisForm.VisitID || ''}
                      onChange={(e) => setDiagnosisForm({ ...diagnosisForm, VisitID: parseInt(e.target.value) })}
                      required
                    >
                      <option value="">Select Visit</option>
                      {visits.map(v => (
                        <option key={v.VisitID} value={v.VisitID}>
                          Visit #{v.VisitID} - {v.PatientName} ({new Date(v.VisitDate).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Severity *</label>
                    <select
                      value={diagnosisForm.Severity}
                      onChange={(e) => setDiagnosisForm({ ...diagnosisForm, Severity: e.target.value })}
                      required
                    >
                      <option value="Mild">Mild</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Severe">Severe</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Diagnosis Name *</label>
                  <input
                    type="text"
                    value={diagnosisForm.DiagnosisName}
                    onChange={(e) => setDiagnosisForm({ ...diagnosisForm, DiagnosisName: e.target.value })}
                    placeholder="e.g., Hypertension, Diabetes"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={diagnosisForm.Description}
                    onChange={(e) => setDiagnosisForm({ ...diagnosisForm, Description: e.target.value })}
                    placeholder="Detailed description of the diagnosis..."
                    rows={4}
                  />
                </div>
                
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={diagnosisForm.IsChronic}
                      onChange={(e) => setDiagnosisForm({ ...diagnosisForm, IsChronic: e.target.checked })}
                    />
                    <span>Is Chronic Condition</span>
                  </label>
                </div>
                
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'Adding...' : 'Add Diagnosis'}
                </button>
              </form>
            </div>
          )}

          {/* Add Prescription Form */}
          {activeView === 'add-prescription' && (
            <div className="form-container">
              <form onSubmit={addPrescription} className="data-form">
                <h3>💊 Prescription Information</h3>
                
                <div className="form-group">
                  <label>Visit *</label>
                  <select
                    value={prescriptionForm.visit_id || ''}
                    onChange={(e) => setPrescriptionForm({ ...prescriptionForm, visit_id: parseInt(e.target.value) })}
                    required
                  >
                    <option value="">Select Visit</option>
                    {visits.map(v => (
                      <option key={v.VisitID} value={v.VisitID}>
                        Visit #{v.VisitID} - {v.PatientName} ({new Date(v.VisitDate).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Medicine Name *</label>
                    <input
                      type="text"
                      value={prescriptionForm.medicine}
                      onChange={(e) => setPrescriptionForm({ ...prescriptionForm, medicine: e.target.value })}
                      placeholder="e.g., Amoxicillin"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Dosage *</label>
                    <input
                      type="text"
                      value={prescriptionForm.dosage}
                      onChange={(e) => setPrescriptionForm({ ...prescriptionForm, dosage: e.target.value })}
                      placeholder="e.g., 500mg"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Frequency *</label>
                    <input
                      type="text"
                      value={prescriptionForm.frequency}
                      onChange={(e) => setPrescriptionForm({ ...prescriptionForm, frequency: e.target.value })}
                      placeholder="e.g., Twice daily"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Duration *</label>
                    <input
                      type="text"
                      value={prescriptionForm.duration}
                      onChange={(e) => setPrescriptionForm({ ...prescriptionForm, duration: e.target.value })}
                      placeholder="e.g., 7 days"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Instructions</label>
                  <textarea
                    value={prescriptionForm.instructions}
                    onChange={(e) => setPrescriptionForm({ ...prescriptionForm, instructions: e.target.value })}
                    placeholder="Special instructions..."
                    rows={3}
                  />
                </div>
                
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'Adding...' : 'Add Prescription'}
                </button>
              </form>
            </div>
          )}

          {/* My Files View */}
          {activeView === 'my-files' && (
            <div className="files-container">
              {medicalFiles.length === 0 ? (
                <div className="empty-state">
                  <FileImage size={64} />
                  <h3>No files uploaded</h3>
                  <p>Upload your medical files to keep them organized.</p>
                  <button onClick={() => setActiveView('upload-file')} className="action-btn">
                    Upload File
                  </button>
                </div>
              ) : (
                <div className="files-grid">
                  {medicalFiles.map(file => (
                    <div key={file.FileID} className="file-card">
                      <div className="file-icon">
                        <FileImage size={40} />
                      </div>
                      <div className="file-details">
                        <h4>{file.FileType}</h4>
                        <p className="file-name">{file.FileName}</p>
                        <p className="file-size">{(file.FileSize / 1024 / 1024).toFixed(2)} MB</p>
                        <p className="file-date">{new Date(file.UploadedAt).toLocaleDateString()}</p>
                        {file.Description && <p className="file-desc">{file.Description}</p>}
                      </div>
                      <button 
                        className="download-btn"
                        onClick={() => downloadFile(file.FileID, file.FileName)}
                      >
                        <Download size={20} /> Download
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upload File Form */}
          {activeView === 'upload-file' && (
            <div className="form-container">
              <form onSubmit={uploadFile} className="data-form upload-form">
                <h3>📤 Upload Medical File</h3>
                
                <div className="form-group">
                  <label>File Type *</label>
                  <select
                    value={fileUpload.file_type}
                    onChange={(e) => setFileUpload({ ...fileUpload, file_type: e.target.value })}
                  >
                    <option value="X-Ray">X-Ray</option>
                    <option value="MRI">MRI Scan</option>
                    <option value="CT Scan">CT Scan</option>
                    <option value="Blood Test">Blood Test</option>
                    <option value="Report">Medical Report</option>
                    <option value="Prescription">Prescription</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Select File *</label>
                  <div className="file-input-wrapper">
                    <input
                      type="file"
                      onChange={(e) => setFileUpload({ ...fileUpload, file: e.target.files?.[0] || null })}
                      accept=".jpg,.jpeg,.png,.pdf,.dcm"
                      required
                    />
                    {fileUpload.file && (
                      <p className="file-selected">Selected: {fileUpload.file.name}</p>
                    )}
                  </div>
                  <small>Supported formats: JPG, PNG, PDF, DICOM (Max 50MB)</small>
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={fileUpload.description}
                    onChange={(e) => setFileUpload({ ...fileUpload, description: e.target.value })}
                    placeholder="Brief description of the file..."
                    rows={3}
                  />
                </div>
                
                <button type="submit" className="submit-btn" disabled={loading || !fileUpload.file}>
                  {loading ? 'Uploading...' : 'Upload File'}
                </button>
              </form>
            </div>
          )}

          {/* Prescriptions View (Pharmacist) */}
          {activeView === 'prescriptions' && (
            <div className="prescriptions-container">
              <div className="prescriptions-header">
                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={pendingOnly}
                    onChange={(e) => {
                      setPendingOnly(e.target.checked);
                      fetchPrescriptions();
                    }}
                  />
                  <span>Show Pending Only</span>
                </label>
              </div>
              
              {prescriptions.length === 0 ? (
                <div className="empty-state">
                  <Pill size={64} />
                  <h3>No prescriptions found</h3>
                  <p>There are no {pendingOnly ? 'pending ' : ''}prescriptions at this time.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Medicine</th>
                        <th>Dosage</th>
                        <th>Frequency</th>
                        <th>Duration</th>
                        <th>Doctor</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prescriptions.map(p => (
                        <tr key={p.PrescriptionID}>
                          <td>
                            <strong>{p.PatientName}</strong>
                          </td>
                          <td><strong>{p.MedicineName}</strong></td>
                          <td>{p.Dosage}</td>
                          <td>{p.Frequency}</td>
                          <td>{p.Duration}</td>
                          <td>{p.DoctorName}</td>
                          <td>
                            <span className={`status-badge ${p.IsDispensed ? 'dispensed' : 'pending'}`}>
                              {p.IsDispensed ? (
                                <>
                                  <CheckCircle size={14} /> Dispensed
                                </>
                              ) : (
                                <>
                                  <Clock size={14} /> Pending
                                </>
                              )}
                            </span>
                          </td>
                          <td>
                            {!p.IsDispensed && (
                              <button
                                className="dispense-btn"
                                onClick={() => dispensePrescription(p.PrescriptionID)}
                              >
                                Dispense
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Patients List (Admin) */}
          {activeView === 'patients' && (
            <div className="patients-container">
              {patients.length === 0 ? (
                <div className="empty-state">
                  <Users size={64} />
                  <h3>No patients found</h3>
                  <p>Import patients or wait for registrations.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Gender</th>
                        <th>DOB</th>
                        <th>Blood Group</th>
                        <th>Phone</th>
                        <th>Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patients.map(p => (
                        <tr key={p.PatientID}>
                          <td><strong>{p.PatientName}</strong></td>
                          <td>
                            <div className="contact-cell">
                              <Mail size={14} />
                              <span>{p.Email}</span>
                            </div>
                          </td>
                          <td>{p.Gender}</td>
                          <td>{new Date(p.DateOfBirth).toLocaleDateString()}</td>
                          <td><span className="badge blood-group">{p.BloodGroup}</span></td>
                          <td>
                            <div className="contact-cell">
                              <Phone size={14} />
                              <span>{p.PhoneNumber}</span>
                            </div>
                          </td>
                          <td>
                            <div className="contact-cell">
                              <MapPin size={14} />
                              <span>{p.Address}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Import Patients (Admin) */}
          {activeView === 'import' && (
            <div className="import-container">
              <div className="import-section">
                <h3>📥 Import Patients from Excel/CSV</h3>
                
                <div className="import-instructions">
                  <h4>Required Columns:</h4>
                  <p>Name, Email, Gender, DOB, Phone, Address, BloodGroup</p>
                  
                  <a 
                    href="data:text/csv;charset=utf-8,Name,Email,Gender,DOB,Phone,Address,BloodGroup%0AJohn Doe,john@email.com,Male,1990-01-15,9876543210,Mumbai,O%2B"
                    download="patient_template.csv"
                    className="download-template-btn"
                  >
                    <Download size={20} /> Download Template
                  </a>
                </div>
                
                <form onSubmit={importPatients} className="import-form">
                  <div className="form-group">
                    <label>Select Excel/CSV File</label>
                    <input
                      type="file"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      accept=".xlsx,.xls,.csv"
                      required
                    />
                    {importFile && (
                      <p className="file-selected">Selected: {importFile.name}</p>
                    )}
                  </div>
                  
                  <button type="submit" className="submit-btn" disabled={loading || !importFile}>
                    {loading ? 'Importing...' : 'Import Patients'}
                  </button>
                </form>
                
                {importResult && (
                  <div className="import-result">
                    <h4>Import Results:</h4>
                    <div className="result-stats">
                      <div className="result-stat success">
                        <strong>{importResult.successful}</strong>
                        <span>Successful</span>
                      </div>
                      <div className="result-stat error">
                        <strong>{importResult.failed}</strong>
                        <span>Failed</span>
                      </div>
                      <div className="result-stat total">
                        <strong>{importResult.total}</strong>
                        <span>Total</span>
                      </div>
                    </div>
                    
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="error-log">
                        <h5>Errors:</h5>
                        <ul>
                          {importResult.errors.map((err: string, idx: number) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;