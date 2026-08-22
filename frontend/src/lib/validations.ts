import { z } from 'zod';

/**
 * Form validation schemas.
 *
 * These mirror what the API accepts, so a form can never submit something the
 * backend will reject. Keep the field names in camelCase — the API client
 * converts them to snake_case on the way out.
 */

/** Indian mobile number: 10 digits starting 6-9, optionally +91 prefixed. */
const mobileNumber = z
  .string()
  .trim()
  .regex(/^(\+91[- ]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

/** Empty strings from optional inputs become `undefined` rather than failing. */
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value))
  .refine((value) => value === undefined || z.string().email().safeParse(value).success, {
    message: 'Enter a valid email address',
  });

const pastDate = z
  .string()
  .min(1, 'Date of birth is required')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date')
  .refine((value) => new Date(value) <= new Date(), 'Date of birth cannot be in the future');

export const patientCreateSchema = z.object({
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  mobile: mobileNumber,
  email: optionalEmail,
  gender: z.enum(['MALE', 'FEMALE', 'OTHER'], { required_error: 'Select a gender' }),
  dateOfBirth: pastDate,
  bloodGroup: optionalString,
  address: optionalString,
  emergencyContact: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === '' ? undefined : value))
    .refine((value) => value === undefined || mobileNumber.safeParse(value).success, {
      message: 'Enter a valid 10-digit mobile number',
    }),
  medicalHistory: optionalString,
  allergies: z.array(z.string()),
});

export type PatientCreateInput = z.infer<typeof patientCreateSchema>;

export const appointmentCreateSchema = z.object({
  patientId: z.string().uuid('Select a patient'),
  doctorId: z.string().uuid('Select a doctor'),
  appointmentDate: z
    .string()
    .min(1, 'Pick a date')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date'),
  appointmentTime: z.string().min(1, 'Pick a time slot'),
  visitType: z.enum(['NEW', 'FOLLOW_UP', 'EMERGENCY']),
  notes: optionalString,
});

export type AppointmentCreateInput = z.infer<typeof appointmentCreateSchema>;

export const billLineItemSchema = z.object({
  itemId: z.string().uuid().optional(),
  description: z.string().trim().min(1, 'Description is required'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.coerce.number().min(0, 'Price cannot be negative'),
});

export const billCreateSchema = z.object({
  patientId: z.string().uuid('Select a patient'),
  appointmentId: z.string().uuid().optional(),
  items: z.array(billLineItemSchema).min(1, 'Add at least one line item'),
  discount: z.coerce.number().min(0, 'Discount cannot be negative'),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'NET_BANKING', 'INSURANCE']),
});

export type BillCreateInput = z.infer<typeof billCreateSchema>;

export const inventoryItemSchema = z.object({
  code: z.string().trim().min(2, 'Item code is required'),
  name: z.string().trim().min(2, 'Item name is required'),
  category: z.enum(['MEDICINE', 'SUPPLY', 'EQUIPMENT']),
  unit: z.string().trim().min(1, 'Unit is required (e.g. Strips, Boxes)'),
  unitPrice: z.coerce.number().min(0, 'Price cannot be negative'),
  currentStock: z.coerce.number().int().min(0, 'Stock cannot be negative'),
  minimumStock: z.coerce.number().int().min(0, 'Reorder level cannot be negative'),
  manufacturer: optionalString,
  notes: optionalString,
});

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

export const inventoryTransactionSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  reference: optionalString,
  notes: optionalString,
});

export type InventoryTransactionInput = z.infer<typeof inventoryTransactionSchema>;

/** Login form — used by the staff login screen. */
export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/** Patient portal login — mobile + OTP. */
export const patientLoginSchema = z.object({
  mobile: mobileNumber,
});

export const otpVerifySchema = z.object({
  mobile: mobileNumber,
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit OTP'),
});
