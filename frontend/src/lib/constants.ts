/**
 * Application-wide constants.
 *
 * The official production backend is permanently set to https://medicare-era.onrender.com/api/v1
 * so that any user on any device (phone, desktop, tablet, other network) connects immediately.
 */

export const CANONICAL_BACKEND_URL = 'https://medicare-era.onrender.com/api/v1';

function resolveApiBaseUrl(): string {
  // Check user override first, purging any legacy broken URLs (e.g. medicare-erp-api)
  if (typeof window !== 'undefined' && window.localStorage) {
    const customUrl = localStorage.getItem('medicare_custom_api_url')?.trim();
    if (customUrl) {
      if (customUrl.includes('medicare-erp-api') || !customUrl.startsWith('http')) {
        localStorage.removeItem('medicare_custom_api_url');
      } else {
        let formatted = customUrl.replace(/\/+$/, '');
        if (!formatted.includes('/api/v1')) {
          formatted = `${formatted}/api/v1`;
        }
        return formatted;
      }
    }
  }

  // Vite environment variable override (if configured at build time)
  let envUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envUrl && !envUrl.includes('medicare-erp-api')) {
    let formatted = envUrl.replace(/\/+$/, '');
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://') && !formatted.startsWith('/')) {
      formatted = `https://${formatted}`;
    }
    if (!formatted.includes('/api/v1') && !formatted.endsWith('/api/v1')) {
      formatted = `${formatted}/api/v1`;
    }
    return formatted;
  }

  // Local development only
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '/api/v1';
    }
  }

  // Permanent official production API endpoint for ALL devices & domains
  return CANONICAL_BACKEND_URL;
}

export const API_BASE_URL: string = resolveApiBaseUrl();

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
  { value: 'ONLINE', label: 'Online (Razorpay)' },
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

/** Default currency symbol throughout the application. */
export const CURRENCY_SYMBOL: string = '₹';

/** Default tax rate for invoices and billing. */
export const DEFAULT_GST_RATE: number = 18.0;

/** Status colors for appointments, consultations, bills, etc. */
export const STATUS_COLORS: Record<string, string> = {
  // Appointment / OPD statuses
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  waiting: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  in_consultation: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  completed: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  no_show: 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-300',

  // Billing statuses
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  partially_paid: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  pending: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  refunded: 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-300',

  // Lab order statuses
  collected: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  processing: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  verified: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
};

/**
 * Standard appointment slot duration in minutes.
 * Can be overridden per clinic / doctor.
 */
export const DEFAULT_SLOT_MINUTES: number = 15;

/**
 * Maximum patient age that requires a guardian / emergency contact.
 */
export const MINOR_AGE_THRESHOLD: number = 18;

/**
 * Pagination defaults.
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 15,
  MAX_PAGE_SIZE: 100,
  PAGE_SIZE_OPTIONS: [10, 15, 25, 50, 100],
} as const;

/**
 * Allowed image upload types.
 */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Allowed document upload types for EMR records.
 */
export const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

/**
 * Maximum file upload size in bytes (10 MB).
 */
export const MAX_UPLOAD_BYTES: number = 10 * 1024 * 1024;
