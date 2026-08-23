/**
 * Application-wide constants.
 *
 * Anything environment-specific comes from Vite env vars (see `.env.example`)
 * so the same build can be pointed at any backend without code changes.
 */

/** Base URL of the API. Defaults to a relative path so the Vite/Nginx proxy handles it. */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/** Product name shown in the sidebar, login screen and page titles. */
export const APP_NAME: string = import.meta.env.VITE_APP_NAME || 'MediCare ERP';

/** Where each role lands after login. */
export const ROLE_ROUTES: Record<string, string> = {
  super_admin: '/admin',
  clinic_admin: '/admin',
  doctor: '/doctor',
  receptionist: '/reception',
  nurse: '/reception',
  lab_staff: '/lab',
  pharmacist: '/inventory',
  patient: '/patient/dashboard',
};

/** Fallback route for a signed-in user whose role has no dedicated panel. */
export const DEFAULT_ROUTE = '/login';

/**
 * The panels an admin can switch on or off per clinic.
 * `key` must match the backend `ClinicModule.module_key` values.
 */
export const PANELS = [
  { key: 'admin', label: 'Administration', route: '/admin' },
  { key: 'reception', label: 'Reception & Front Desk', route: '/reception' },
  { key: 'doctor', label: 'Doctor & EMR', route: '/doctor' },
  { key: 'lab', label: 'Diagnostic Laboratory', route: '/lab' },
  { key: 'inventory', label: 'Pharmacy & Inventory', route: '/inventory' },
  { key: 'patient_portal', label: 'Patient Portal', route: '/patient' },
  { key: 'ai_assistant', label: 'AI Assistant', route: '/admin/ai' },
] as const;

export type PanelKey = (typeof PANELS)[number]['key'];

/** Appointment lifecycle, in the order a visit actually progresses. */
export const APPOINTMENT_STATUSES = [
  'booked',
  'checked_in',
  'in_consultation',
  'completed',
  'cancelled',
  'no_show',
  'skipped',
] as const;

export const VISIT_TYPES = [
  { value: 'NEW', label: 'New Visit' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'EMERGENCY', label: 'Emergency' },
] as const;

export const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
  { value: 'NET_BANKING', label: 'Net Banking' },
  { value: 'INSURANCE', label: 'Insurance' },
] as const;

export const GENDERS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export const INVENTORY_CATEGORIES = [
  { value: 'MEDICINE', label: 'Medicine' },
  { value: 'SUPPLY', label: 'Supply' },
  { value: 'EQUIPMENT', label: 'Equipment' },
] as const;

/** Default page size for paginated tables. */
export const DEFAULT_PAGE_SIZE = 10;
