/**
 * Application-wide constants.
 *
 * Anything environment-specific comes from Vite env vars (see `.env.example`)
 * so the same build can be pointed at any backend without code changes.
 */

function resolveApiBaseUrl(): string {
  // Check user override first
  if (typeof window !== 'undefined' && window.localStorage) {
    const customUrl = localStorage.getItem('medicare_custom_api_url')?.trim();
    if (customUrl) {
      let formatted = customUrl.replace(/\/+$/, '');
      if (!formatted.startsWith('http://') && !formatted.startsWith('https://') && !formatted.startsWith('/')) {
        formatted = `https://${formatted}`;
      }
      if (!formatted.includes('/api/v1')) {
        formatted = `${formatted}/api/v1`;
      }
      return formatted;
    }
  }

  let envUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envUrl) {
    // If Render Blueprint passed internal private hostname like "medicare-erp-api:10000" or "medicare-erp-api"
    if (envUrl.includes(':10000') || (!envUrl.includes('.') && !envUrl.startsWith('/'))) {
      const cleanHost = envUrl.split(':')[0].replace(/^https?:\/\//, '');
      envUrl = `https://${cleanHost}.onrender.com`;
    }

    let formatted = envUrl.replace(/\/+$/, '');
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://') && !formatted.startsWith('/')) {
      formatted = `https://${formatted}`;
    }
    if (!formatted.includes('/api/v1') && !formatted.endsWith('/api/v1')) {
      formatted = `${formatted}/api/v1`;
    }
    return formatted;
  }

  // Automatic Cloud Domain resolution for Render & hosted environments
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    
    // If running locally in development or docker
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '/api/v1';
    }

    // If hosted on Render (e.g. medicare-erp-web.onrender.com, erp-web.onrender.com, etc.)
    if (hostname.includes('.onrender.com')) {
      if (hostname.includes('-web.')) {
        const apiHost = hostname.replace('-web.', '-api.');
        return `https://${apiHost}/api/v1`;
      }
      if (hostname.includes('-frontend.')) {
        const apiHost = hostname.replace('-frontend.', '-backend.');
        return `https://${apiHost}/api/v1`;
      }
      if (hostname.includes('-api.')) {
        return `https://${hostname}/api/v1`;
      }
      // Standard Render production API endpoint fallback
      return 'https://medicare-erp-api.onrender.com/api/v1';
    }
  }

  return '/api/v1';
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
