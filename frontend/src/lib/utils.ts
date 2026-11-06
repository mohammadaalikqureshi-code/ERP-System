import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class names, letting later classes win over earlier ones.
 * Used by every UI component in `components/ui`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Indian Rupees, e.g. 1234.5 -> "₹1,234.50". */
export function formatCurrency(amount: number | string | null | undefined): string {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

/** Format a date as "12 Aug 2026". Returns "-" for empty/invalid input. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Format a date and time as "12 Aug 2026, 09:30 am". */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Format a "HH:MM" or "HH:MM:SS" clock string as "09:30 am". */
export function formatTime(value: string | null | undefined): string {
  if (!value) return '-';
  const [hours, minutes] = value.split(':');
  const h = Number(hours);
  if (!Number.isFinite(h)) return value;
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${minutes ?? '00'} ${suffix}`;
}

/** Whole years between a date of birth and today. */
export function calculateAge(dateOfBirth: string | Date | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

/** "Ramesh Kumar" -> "RK". Used for avatar fallbacks. */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/**
 * Strips any leading "Dr.", "Dr", "Doctor", "dr.", case-insensitively,
 * including duplicated "Dr. Dr." prefixes.
 */
export function cleanDoctorName(name?: string | null): string {
  if (!name || !name.trim()) return '';
  let clean = name.trim();
  while (/^(dr\.?|doctor)\s+/i.test(clean) || /^(dr\.?|doctor)$/i.test(clean)) {
    clean = clean.replace(/^(dr\.?|doctor)\s*/i, '').trim();
  }
  return clean;
}

/**
 * Ensures a doctor's name is prefixed with EXACTLY ONE "Dr." title.
 * Strips any existing "Dr." / "Dr" / "Doctor" before prepending "Dr. ".
 * Never produces "Dr. Dr. Name".
 *
 * Examples:
 *   formatDoctorName("Meera Raghavan") -> "Dr. Meera Raghavan"
 *   formatDoctorName("Dr. Meera Raghavan") -> "Dr. Meera Raghavan"
 *   formatDoctorName("Dr. Dr. Meera Raghavan") -> "Dr. Meera Raghavan"
 *   formatDoctorName(undefined) -> "Doctor"
 */
export function formatDoctorName(name?: string | null): string {
  const clean = cleanDoctorName(name);
  return clean ? `Dr. ${clean}` : 'Doctor';
}

/**
 * Formats a doctor object or string safely ensuring exactly one "Dr." prefix.
 */
export function getDoctorDisplayName(doc: any): string {
  if (!doc) return 'Doctor';
  if (typeof doc === 'string') return formatDoctorName(doc);
  const raw =
    doc.user?.fullName ||
    doc.user?.full_name ||
    doc.fullName ||
    doc.full_name ||
    doc.doctorName ||
    doc.doctor_name ||
    doc.name ||
    (doc.firstName && doc.firstName !== 'Doctor'
      ? `${doc.firstName} ${doc.lastName || ''}`.trim()
      : '') ||
    (doc.user
      ? `${doc.user.firstName || doc.user.first_name || ''} ${doc.user.lastName || doc.user.last_name || ''}`.trim()
      : '') ||
    (doc.department ? `${doc.department} Specialist` : 'Doctor');
  return formatDoctorName(raw);
}

