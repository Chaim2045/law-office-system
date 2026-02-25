/**
 * Zod Validation Schemas
 *
 * תכונות:
 * - ✅ Runtime validation
 * - ✅ Type inference from schemas
 * - ✅ Detailed error messages
 * - ✅ Transformation and sanitization
 * - ✅ Reusable schema components
 *
 * @example
 * ```typescript
 * import { ClientSchema, validateClient } from './schemas';
 *
 * // Validate data
 * const result = validateClient({
 *   clientName: 'John Doe',
 *   phone: '050-1234567'
 * });
 *
 * if (result.success) {
 *   console.log('Valid client:', result.data);
 * } else {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 *
 * Created: October 2025
 * Part of: Law Office Management System v2.0
 */
import { z } from 'zod';
// ==================== Common Schemas ====================
/**
 * Israeli phone number (05x-xxxxxxx or 05xxxxxxxx)
 */
export const PhoneSchema = z
    .string()
    .regex(/^05\d(-?\d{7}|\d{8})$/, {
    message: 'מספר טלפון לא תקין. פורמט: 050-1234567 או 0501234567'
})
    .transform((val) => val.replace('-', '')); // Normalize: remove dashes
/**
 * Email address
 */
export const EmailSchema = z
    .string()
    .email({ message: 'כתובת אימייל לא תקינה' })
    .toLowerCase()
    .trim();
/**
 * Date string (ISO 8601)
 */
export const DateStringSchema = z.string().refine((val) => {
    const date = new Date(val);
    return !isNaN(date.getTime());
}, { message: 'תאריך לא תקין' });
/**
 * Positive number
 */
export const PositiveNumberSchema = z
    .number()
    .positive({ message: 'המספר חייב להיות חיובי' });
/**
 * Non-negative number (0 or positive)
 */
export const NonNegativeNumberSchema = z
    .number()
    .nonnegative({ message: 'המספר לא יכול להיות שלילי' });
/**
 * Hebrew text (optional validation)
 */
export const HebrewTextSchema = z.string().min(2, {
    message: 'הטקסט חייב להכיל לפחות 2 תווים'
});
// ==================== Client Schema ====================
/**
 * Client data structure
 */
export const ClientSchema = z.object({
    clientId: z.string().uuid().optional(),
    clientName: HebrewTextSchema,
    phone: PhoneSchema.optional(),
    email: EmailSchema.optional(),
    address: z.string().optional(),
    idNumber: z
        .string()
        .regex(/^\d{9}$/, { message: 'תעודת זהות חייבת להכיל 9 ספרות' })
        .optional(),
    notes: z.string().optional(),
    createdAt: DateStringSchema.optional(),
    createdBy: z.string().optional(),
    lastModifiedAt: DateStringSchema.optional(),
    lastModifiedBy: z.string().optional()
});
// ==================== Case Schema ====================
/**
 * Legal case data structure
 */
export const CaseSchema = z.object({
    caseId: z.string().uuid().optional(),
    clientId: z.string().uuid(),
    caseName: HebrewTextSchema,
    caseNumber: z.string().optional(),
    court: z.string().optional(),
    judge: z.string().optional(),
    opposingParty: z.string().optional(),
    opposingLawyer: z.string().optional(),
    status: z
        .enum(['active', 'closed', 'pending', 'archived'])
        .default('active'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    description: z.string().optional(),
    createdAt: DateStringSchema.optional(),
    createdBy: z.string().optional(),
    lastModifiedAt: DateStringSchema.optional(),
    lastModifiedBy: z.string().optional()
});
// ==================== Budget Task Schema ====================
/**
 * Budget task data structure
 */
export const BudgetTaskSchema = z.object({
    taskId: z.string().uuid().optional(),
    clientId: z.string().uuid(),
    clientName: HebrewTextSchema,
    caseId: z.string().uuid().optional(),
    caseName: z.string().optional(),
    taskDescription: HebrewTextSchema,
    originalEstimate: PositiveNumberSchema,
    currentEstimate: PositiveNumberSchema,
    totalMinutesWorked: NonNegativeNumberSchema.default(0),
    employee: EmailSchema,
    assignedTo: z.string().optional(),
    status: z
        .enum(['in_progress', 'completed', 'on_hold', 'cancelled'])
        .default('in_progress'),
    deadline: DateStringSchema.optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    notes: z.string().optional(),
    branch: z.string().optional(),
    budgetAdjustments: z
        .array(z.object({
        timestamp: DateStringSchema,
        type: z.enum(['increase', 'decrease']),
        oldEstimate: PositiveNumberSchema,
        newEstimate: PositiveNumberSchema,
        addedMinutes: z.number(),
        reason: z.string(),
        adjustedBy: z.string()
    }))
        .optional(),
    createdAt: DateStringSchema.optional(),
    createdBy: z.string().optional(),
    lastModifiedAt: DateStringSchema.optional(),
    lastModifiedBy: z.string().optional()
});
// ==================== Timesheet Entry Schema ====================
/**
 * Timesheet entry data structure
 */
export const TimesheetEntrySchema = z.object({
    entryId: z.string().uuid().optional(),
    taskId: z.string().uuid(),
    clientId: z.string().uuid(),
    clientName: HebrewTextSchema,
    caseId: z.string().uuid().optional(),
    caseName: z.string().optional(),
    employee: EmailSchema,
    date: DateStringSchema,
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    minutes: PositiveNumberSchema,
    description: HebrewTextSchema,
    billable: z.boolean().default(true),
    invoiced: z.boolean().default(false),
    hourlyRate: PositiveNumberSchema.optional(),
    totalAmount: NonNegativeNumberSchema.optional(),
    branch: z.string().optional(),
    notes: z.string().optional(),
    createdAt: DateStringSchema.optional(),
    createdBy: z.string().optional(),
    lastModifiedAt: DateStringSchema.optional(),
    lastModifiedBy: z.string().optional()
});
// ==================== Employee Schema ====================
/**
 * Employee data structure
 */
export const EmployeeSchema = z.object({
    employeeId: z.string().optional(), // Document ID (email)
    authUID: z.string().optional(), // Firebase Auth UID
    email: EmailSchema,
    username: HebrewTextSchema,
    name: HebrewTextSchema.optional(),
    phone: PhoneSchema.optional(),
    role: z.enum(['admin', 'lawyer', 'assistant', 'intern']).default('assistant'),
    isActive: z.boolean().default(true),
    permissions: z
        .array(z.enum([
        'create_client',
        'edit_client',
        'delete_client',
        'create_case',
        'edit_case',
        'delete_case',
        'create_task',
        'edit_task',
        'delete_task',
        'view_reports',
        'manage_users'
    ]))
        .optional(),
    branch: z.string().optional(),
    hourlyRate: PositiveNumberSchema.optional(),
    lastLogin: DateStringSchema.optional(),
    loginCount: NonNegativeNumberSchema.default(0),
    createdAt: DateStringSchema.optional(),
    createdBy: z.string().optional()
});
// ==================== Legal Procedure Schema ====================
/**
 * Legal procedure data structure
 */
export const LegalProcedureSchema = z.object({
    procedureId: z.string().uuid().optional(),
    clientId: z.string().uuid(),
    clientName: HebrewTextSchema,
    caseId: z.string().uuid().optional(),
    caseName: z.string().optional(),
    procedureName: HebrewTextSchema,
    court: z.string().optional(),
    courtBranch: z.string().optional(),
    procedureDate: DateStringSchema,
    procedureTime: z.string().optional(),
    status: z
        .enum(['scheduled', 'completed', 'cancelled', 'postponed'])
        .default('scheduled'),
    notes: z.string().optional(),
    assignedTo: z.string().optional(),
    reminders: z
        .array(z.object({
        date: DateStringSchema,
        sent: z.boolean().default(false)
    }))
        .optional(),
    createdAt: DateStringSchema.optional(),
    createdBy: z.string().optional(),
    lastModifiedAt: DateStringSchema.optional(),
    lastModifiedBy: z.string().optional()
});
/**
 * Generic validation function
 */
function validate(schema, data) {
    const result = schema.safeParse(data);
    if (result.success) {
        return {
            success: true,
            data: result.data
        };
    } else {
        return {
            success: false,
            errors: result.error.issues.map((err) => {
                const path = err.path.join('.');
                return `${path}: ${err.message}`;
            })
        };
    }
}
/**
 * Validate client data
 */
export function validateClient(data) {
    return validate(ClientSchema, data);
}
/**
 * Validate case data
 */
export function validateCase(data) {
    return validate(CaseSchema, data);
}
/**
 * Validate budget task data
 */
export function validateBudgetTask(data) {
    return validate(BudgetTaskSchema, data);
}
/**
 * Validate timesheet entry data
 */
export function validateTimesheetEntry(data) {
    return validate(TimesheetEntrySchema, data);
}
/**
 * Validate employee data
 */
export function validateEmployee(data) {
    return validate(EmployeeSchema, data);
}
/**
 * Validate legal procedure data
 */
export function validateLegalProcedure(data) {
    return validate(LegalProcedureSchema, data);
}
// ==================== Partial Schemas (for updates) ====================
/**
 * Partial schemas allow updating only specific fields
 */
export const PartialClientSchema = ClientSchema.partial();
export const PartialCaseSchema = CaseSchema.partial();
export const PartialBudgetTaskSchema = BudgetTaskSchema.partial();
export const PartialTimesheetEntrySchema = TimesheetEntrySchema.partial();
export const PartialEmployeeSchema = EmployeeSchema.partial();
export const PartialLegalProcedureSchema = LegalProcedureSchema.partial();
// ==================== Exports ====================
export default {
    ClientSchema,
    CaseSchema,
    BudgetTaskSchema,
    TimesheetEntrySchema,
    EmployeeSchema,
    LegalProcedureSchema,
    validateClient,
    validateCase,
    validateBudgetTask,
    validateTimesheetEntry,
    validateEmployee,
    validateLegalProcedure
};
//# sourceMappingURL=index.js.map