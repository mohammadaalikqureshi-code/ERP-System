export interface Role {
  id: string;
  name: string;
}

export interface UserProfile {
  id: string;
  /** The signed-in user's name, as returned by /auth/me. */
  fullName: string;
  email?: string;
  phone: string;
  role: string;
  roleName?: string;
  /** `resource.action` strings the backend granted this role. */
  permissions?: string[];
  clinicId?: string;
  /** Older screens referred to these; kept so they keep compiling. */
  firstName?: string;
  lastName?: string;
  name?: string;
}

export interface User {
  profile: UserProfile;
  accessToken: string;
  refreshToken: string;
}

export interface Clinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  gstNumber: string;
  timezone: string;
  workingHours: any;
  isActive: boolean;
}

export interface ClinicSettings {
  id: string;
  clinicId: string;
  gstRate: number;
  currency: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  clinicId: string;
}

export interface Patient {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email?: string;
  gender: string;
  dateOfBirth: string;
  bloodGroup?: string;
  address?: string;
  allergies?: string[];
  medicalHistory?: string;
  createdAt: string;
}

export interface PatientSearchResult extends Patient {}

export interface Doctor {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  specialization: string;
  department: string;
  consultationFee: number;
  isActive: boolean;
}

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface DoctorLeave {
  id: string;
  doctorId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface AvailableSlot {
  /** "09:20" — shown on the button and submitted when booking. */
  time: string;
  startTime: string;
  endTime: string;
  /** False when the slot is already taken. */
  isAvailable: boolean;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  clinicId: string;
  appointmentDate: string;
  appointmentTime: string;
  tokenNumber: string;
  status: string;
  visitType: string;
  notes?: string;
  patient?: Patient;
  doctor?: Doctor;
  createdAt: string;
}

export interface QueueData {
  current: Appointment | null;
  next: Appointment | null;
  waiting: Appointment[];
  completed: Appointment[];
  skipped: Appointment[];
}

export interface Bill {
  id: string;
  appointmentId?: string;
  patientId: string;
  clinicId: string;
  billNumber: string;
  subtotal: number;
  discount: number;
  taxAmount: number;
  totalAmount: number;
  status: string;
  paymentMode?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  billId: string;
  amount: number;
  paymentMode: string;
  transactionId?: string;
  status: string;
  createdAt: string;
}

export interface LineItem {
  id: string;
  billId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  type: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: any;
  newValue: any;
  createdAt: string;
}

export interface AppointmentStatusCounts {
  booked: number;
  checkedIn: number;
  inConsultation: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export interface ReceptionDashboard {
  totalPatients: number;
  revenue: number;
  appointments: AppointmentStatusCounts;
  recentAppointments: Appointment[];
}

export interface DoctorDashboard {
  todayAppointments: Record<string, number>;
  /** Measured from today's consultations, in minutes. */
  avgConsultationTime: number;
  todayEarnings: number;
  upcomingFollowUps: number;
  pendingLabOrders: number;
  totalPatients: number;
  completed: number;
  pending: number;
}

export interface AdminDashboard {
  /** Revenue for the current calendar month. */
  totalRevenue: number;
  totalPatients: number;
  totalAppointments: number;
  activeDoctors: number;
  lowStockItems: number;
  unpaidBills: number;
  noShowRate: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}
export interface Vitals {
  id: string;
  patientId: string;
  appointmentId: string;
  bloodPressure: string;
  heartRate: number;
  temperature: number;
  weight: number;
  height: number;
  bmi: number;
  spo2: number;
  notes: string;
  recordedBy: string;
  createdAt: string;
}

export interface Prescription {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  notes: string;
  medicines: Medicine[];
  createdAt: string;
}

export interface Medicine {
  id?: string;
  prescriptionId?: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface MedicalHistory {
  id: string;
  patientId: string;
  condition: string;
  diagnosisDate: string;
  status: string;
  notes: string;
}

export interface LabTest {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  description: string;
  normalRange: string;
  unit: string;
}

export interface LabOrder {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId: string;
  orderDate: string;
  status: string;
  notes: string;
  items: LabOrderItem[];
  patient?: Patient;
  doctor?: Doctor;
}

export interface LabOrderItem {
  id: string;
  labOrderId?: string;
  labTestId: string;
  resultValue: string;
  isAbnormal: boolean;
  remarks: string;
  test?: LabTest;
}

export interface AppNotification {
  id: string;
  clinicId: string;
  senderUserId?: string | null;
  senderName: string;
  targetRole: string;
  targetUserId?: string | null;
  targetDoctorId?: string | null;
  category: 'appointment' | 'clinical' | 'lab' | 'pharmacy' | 'billing' | 'urgent' | 'general' | string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface AppNotificationInbox {
  items: AppNotification[];
  unreadCount: number;
  total: number;
}

