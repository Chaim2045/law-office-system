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
/**
 * Israeli phone number (05x-xxxxxxx or 05xxxxxxxx)
 */
export declare const PhoneSchema: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
/**
 * Email address
 */
export declare const EmailSchema: z.ZodString;
/**
 * Date string (ISO 8601)
 */
export declare const DateStringSchema: z.ZodString;
/**
 * Positive number
 */
export declare const PositiveNumberSchema: z.ZodNumber;
/**
 * Non-negative number (0 or positive)
 */
export declare const NonNegativeNumberSchema: z.ZodNumber;
/**
 * Hebrew text (optional validation)
 */
export declare const HebrewTextSchema: z.ZodString;
/**
 * Client data structure
 */
export declare const ClientSchema: z.ZodObject<{
    clientId: z.ZodOptional<z.ZodString>;
    clientName: z.ZodString;
    phone: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    email: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    idNumber: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodString>;
    lastModifiedAt: z.ZodOptional<z.ZodString>;
    lastModifiedBy: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Client = z.infer<typeof ClientSchema>;
/**
 * Legal case data structure
 */
export declare const CaseSchema: z.ZodObject<{
    caseId: z.ZodOptional<z.ZodString>;
    clientId: z.ZodString;
    caseName: z.ZodString;
    caseNumber: z.ZodOptional<z.ZodString>;
    court: z.ZodOptional<z.ZodString>;
    judge: z.ZodOptional<z.ZodString>;
    opposingParty: z.ZodOptional<z.ZodString>;
    opposingLawyer: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        closed: "closed";
        pending: "pending";
        archived: "archived";
    }>>;
    priority: z.ZodDefault<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        urgent: "urgent";
    }>>;
    description: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodString>;
    lastModifiedAt: z.ZodOptional<z.ZodString>;
    lastModifiedBy: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Case = z.infer<typeof CaseSchema>;
/**
 * Budget task data structure
 */
export declare const BudgetTaskSchema: z.ZodObject<{
    taskId: z.ZodOptional<z.ZodString>;
    clientId: z.ZodString;
    clientName: z.ZodString;
    caseId: z.ZodOptional<z.ZodString>;
    caseName: z.ZodOptional<z.ZodString>;
    taskDescription: z.ZodString;
    originalEstimate: z.ZodNumber;
    currentEstimate: z.ZodNumber;
    totalMinutesWorked: z.ZodDefault<z.ZodNumber>;
    employee: z.ZodString;
    assignedTo: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<{
        in_progress: "in_progress";
        completed: "completed";
        on_hold: "on_hold";
        cancelled: "cancelled";
    }>>;
    deadline: z.ZodOptional<z.ZodString>;
    priority: z.ZodDefault<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        urgent: "urgent";
    }>>;
    notes: z.ZodOptional<z.ZodString>;
    branch: z.ZodOptional<z.ZodString>;
    budgetAdjustments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        timestamp: z.ZodString;
        type: z.ZodEnum<{
            increase: "increase";
            decrease: "decrease";
        }>;
        oldEstimate: z.ZodNumber;
        newEstimate: z.ZodNumber;
        addedMinutes: z.ZodNumber;
        reason: z.ZodString;
        adjustedBy: z.ZodString;
    }, z.core.$strip>>>;
    createdAt: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodString>;
    lastModifiedAt: z.ZodOptional<z.ZodString>;
    lastModifiedBy: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type BudgetTask = z.infer<typeof BudgetTaskSchema>;
/**
 * Timesheet entry data structure
 */
export declare const TimesheetEntrySchema: z.ZodObject<{
    entryId: z.ZodOptional<z.ZodString>;
    taskId: z.ZodString;
    clientId: z.ZodString;
    clientName: z.ZodString;
    caseId: z.ZodOptional<z.ZodString>;
    caseName: z.ZodOptional<z.ZodString>;
    employee: z.ZodString;
    date: z.ZodString;
    startTime: z.ZodOptional<z.ZodString>;
    endTime: z.ZodOptional<z.ZodString>;
    minutes: z.ZodNumber;
    description: z.ZodString;
    billable: z.ZodDefault<z.ZodBoolean>;
    invoiced: z.ZodDefault<z.ZodBoolean>;
    hourlyRate: z.ZodOptional<z.ZodNumber>;
    totalAmount: z.ZodOptional<z.ZodNumber>;
    branch: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodString>;
    lastModifiedAt: z.ZodOptional<z.ZodString>;
    lastModifiedBy: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TimesheetEntry = z.infer<typeof TimesheetEntrySchema>;
/**
 * Employee data structure
 */
export declare const EmployeeSchema: z.ZodObject<{
    employeeId: z.ZodOptional<z.ZodString>;
    authUID: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    username: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    role: z.ZodDefault<z.ZodEnum<{
        admin: "admin";
        lawyer: "lawyer";
        assistant: "assistant";
        intern: "intern";
    }>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    permissions: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        create_client: "create_client";
        edit_client: "edit_client";
        delete_client: "delete_client";
        create_case: "create_case";
        edit_case: "edit_case";
        delete_case: "delete_case";
        create_task: "create_task";
        edit_task: "edit_task";
        delete_task: "delete_task";
        view_reports: "view_reports";
        manage_users: "manage_users";
    }>>>;
    branch: z.ZodOptional<z.ZodString>;
    hourlyRate: z.ZodOptional<z.ZodNumber>;
    lastLogin: z.ZodOptional<z.ZodString>;
    loginCount: z.ZodDefault<z.ZodNumber>;
    createdAt: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Employee = z.infer<typeof EmployeeSchema>;
/**
 * Legal procedure data structure
 */
export declare const LegalProcedureSchema: z.ZodObject<{
    procedureId: z.ZodOptional<z.ZodString>;
    clientId: z.ZodString;
    clientName: z.ZodString;
    caseId: z.ZodOptional<z.ZodString>;
    caseName: z.ZodOptional<z.ZodString>;
    procedureName: z.ZodString;
    court: z.ZodOptional<z.ZodString>;
    courtBranch: z.ZodOptional<z.ZodString>;
    procedureDate: z.ZodString;
    procedureTime: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<{
        completed: "completed";
        cancelled: "cancelled";
        scheduled: "scheduled";
        postponed: "postponed";
    }>>;
    notes: z.ZodOptional<z.ZodString>;
    assignedTo: z.ZodOptional<z.ZodString>;
    reminders: z.ZodOptional<z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        sent: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>>;
    createdAt: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodString>;
    lastModifiedAt: z.ZodOptional<z.ZodString>;
    lastModifiedBy: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type LegalProcedure = z.infer<typeof LegalProcedureSchema>;
/**
 * Validation result type
 */
export type ValidationResult<T> = {
    success: true;
    data: T;
} | {
    success: false;
    errors: string[];
};
/**
 * Validate client data
 */
export declare function validateClient(data: unknown): ValidationResult<Client>;
/**
 * Validate case data
 */
export declare function validateCase(data: unknown): ValidationResult<Case>;
/**
 * Validate budget task data
 */
export declare function validateBudgetTask(data: unknown): ValidationResult<BudgetTask>;
/**
 * Validate timesheet entry data
 */
export declare function validateTimesheetEntry(data: unknown): ValidationResult<TimesheetEntry>;
/**
 * Validate employee data
 */
export declare function validateEmployee(data: unknown): ValidationResult<Employee>;
/**
 * Validate legal procedure data
 */
export declare function validateLegalProcedure(data: unknown): ValidationResult<LegalProcedure>;
/**
 * Partial schemas allow updating only specific fields
 */
export declare const PartialClientSchema: z.ZodObject<{
    clientId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    clientName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>;
    email: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    address: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    idNumber: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    createdBy: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    lastModifiedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    lastModifiedBy: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const PartialCaseSchema: z.ZodObject<{
    caseId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    clientId: z.ZodOptional<z.ZodString>;
    caseName: z.ZodOptional<z.ZodString>;
    caseNumber: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    court: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    judge: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    opposingParty: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    opposingLawyer: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        active: "active";
        closed: "closed";
        pending: "pending";
        archived: "archived";
    }>>>;
    priority: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        urgent: "urgent";
    }>>>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    createdBy: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    lastModifiedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    lastModifiedBy: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const PartialBudgetTaskSchema: z.ZodObject<{
    taskId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    clientId: z.ZodOptional<z.ZodString>;
    clientName: z.ZodOptional<z.ZodString>;
    caseId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    caseName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    taskDescription: z.ZodOptional<z.ZodString>;
    originalEstimate: z.ZodOptional<z.ZodNumber>;
    currentEstimate: z.ZodOptional<z.ZodNumber>;
    totalMinutesWorked: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    employee: z.ZodOptional<z.ZodString>;
    assignedTo: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        in_progress: "in_progress";
        completed: "completed";
        on_hold: "on_hold";
        cancelled: "cancelled";
    }>>>;
    deadline: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    priority: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        urgent: "urgent";
    }>>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    branch: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    budgetAdjustments: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
        timestamp: z.ZodString;
        type: z.ZodEnum<{
            increase: "increase";
            decrease: "decrease";
        }>;
        oldEstimate: z.ZodNumber;
        newEstimate: z.ZodNumber;
        addedMinutes: z.ZodNumber;
        reason: z.ZodString;
        adjustedBy: z.ZodString;
    }, z.core.$strip>>>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    createdBy: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    lastModifiedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    lastModifiedBy: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const PartialTimesheetEntrySchema: z.ZodObject<{
    entryId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    taskId: z.ZodOptional<z.ZodString>;
    clientId: z.ZodOptional<z.ZodString>;
    clientName: z.ZodOptional<z.ZodString>;
    caseId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    caseName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    employee: z.ZodOptional<z.ZodString>;
    date: z.ZodOptional<z.ZodString>;
    startTime: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    endTime: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    minutes: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
    billable: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    invoiced: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    hourlyRate: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    totalAmount: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    branch: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    createdBy: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    lastModifiedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    lastModifiedBy: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const PartialEmployeeSchema: z.ZodObject<{
    employeeId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    authUID: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    email: z.ZodOptional<z.ZodString>;
    username: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    phone: z.ZodOptional<z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>;
    role: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        admin: "admin";
        lawyer: "lawyer";
        assistant: "assistant";
        intern: "intern";
    }>>>;
    isActive: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    permissions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        create_client: "create_client";
        edit_client: "edit_client";
        delete_client: "delete_client";
        create_case: "create_case";
        edit_case: "edit_case";
        delete_case: "delete_case";
        create_task: "create_task";
        edit_task: "edit_task";
        delete_task: "delete_task";
        view_reports: "view_reports";
        manage_users: "manage_users";
    }>>>>;
    branch: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    hourlyRate: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    lastLogin: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    loginCount: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    createdBy: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const PartialLegalProcedureSchema: z.ZodObject<{
    procedureId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    clientId: z.ZodOptional<z.ZodString>;
    clientName: z.ZodOptional<z.ZodString>;
    caseId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    caseName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    procedureName: z.ZodOptional<z.ZodString>;
    court: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    courtBranch: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    procedureDate: z.ZodOptional<z.ZodString>;
    procedureTime: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        completed: "completed";
        cancelled: "cancelled";
        scheduled: "scheduled";
        postponed: "postponed";
    }>>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    assignedTo: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    reminders: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        sent: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    createdBy: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    lastModifiedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    lastModifiedBy: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
declare const _default: {
    ClientSchema: z.ZodObject<{
        clientId: z.ZodOptional<z.ZodString>;
        clientName: z.ZodString;
        phone: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
        email: z.ZodOptional<z.ZodString>;
        address: z.ZodOptional<z.ZodString>;
        idNumber: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodOptional<z.ZodString>;
        createdBy: z.ZodOptional<z.ZodString>;
        lastModifiedAt: z.ZodOptional<z.ZodString>;
        lastModifiedBy: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    CaseSchema: z.ZodObject<{
        caseId: z.ZodOptional<z.ZodString>;
        clientId: z.ZodString;
        caseName: z.ZodString;
        caseNumber: z.ZodOptional<z.ZodString>;
        court: z.ZodOptional<z.ZodString>;
        judge: z.ZodOptional<z.ZodString>;
        opposingParty: z.ZodOptional<z.ZodString>;
        opposingLawyer: z.ZodOptional<z.ZodString>;
        status: z.ZodDefault<z.ZodEnum<{
            active: "active";
            closed: "closed";
            pending: "pending";
            archived: "archived";
        }>>;
        priority: z.ZodDefault<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
            urgent: "urgent";
        }>>;
        description: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodOptional<z.ZodString>;
        createdBy: z.ZodOptional<z.ZodString>;
        lastModifiedAt: z.ZodOptional<z.ZodString>;
        lastModifiedBy: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    BudgetTaskSchema: z.ZodObject<{
        taskId: z.ZodOptional<z.ZodString>;
        clientId: z.ZodString;
        clientName: z.ZodString;
        caseId: z.ZodOptional<z.ZodString>;
        caseName: z.ZodOptional<z.ZodString>;
        taskDescription: z.ZodString;
        originalEstimate: z.ZodNumber;
        currentEstimate: z.ZodNumber;
        totalMinutesWorked: z.ZodDefault<z.ZodNumber>;
        employee: z.ZodString;
        assignedTo: z.ZodOptional<z.ZodString>;
        status: z.ZodDefault<z.ZodEnum<{
            in_progress: "in_progress";
            completed: "completed";
            on_hold: "on_hold";
            cancelled: "cancelled";
        }>>;
        deadline: z.ZodOptional<z.ZodString>;
        priority: z.ZodDefault<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
            urgent: "urgent";
        }>>;
        notes: z.ZodOptional<z.ZodString>;
        branch: z.ZodOptional<z.ZodString>;
        budgetAdjustments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            timestamp: z.ZodString;
            type: z.ZodEnum<{
                increase: "increase";
                decrease: "decrease";
            }>;
            oldEstimate: z.ZodNumber;
            newEstimate: z.ZodNumber;
            addedMinutes: z.ZodNumber;
            reason: z.ZodString;
            adjustedBy: z.ZodString;
        }, z.core.$strip>>>;
        createdAt: z.ZodOptional<z.ZodString>;
        createdBy: z.ZodOptional<z.ZodString>;
        lastModifiedAt: z.ZodOptional<z.ZodString>;
        lastModifiedBy: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    TimesheetEntrySchema: z.ZodObject<{
        entryId: z.ZodOptional<z.ZodString>;
        taskId: z.ZodString;
        clientId: z.ZodString;
        clientName: z.ZodString;
        caseId: z.ZodOptional<z.ZodString>;
        caseName: z.ZodOptional<z.ZodString>;
        employee: z.ZodString;
        date: z.ZodString;
        startTime: z.ZodOptional<z.ZodString>;
        endTime: z.ZodOptional<z.ZodString>;
        minutes: z.ZodNumber;
        description: z.ZodString;
        billable: z.ZodDefault<z.ZodBoolean>;
        invoiced: z.ZodDefault<z.ZodBoolean>;
        hourlyRate: z.ZodOptional<z.ZodNumber>;
        totalAmount: z.ZodOptional<z.ZodNumber>;
        branch: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodOptional<z.ZodString>;
        createdBy: z.ZodOptional<z.ZodString>;
        lastModifiedAt: z.ZodOptional<z.ZodString>;
        lastModifiedBy: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    EmployeeSchema: z.ZodObject<{
        employeeId: z.ZodOptional<z.ZodString>;
        authUID: z.ZodOptional<z.ZodString>;
        email: z.ZodString;
        username: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
        role: z.ZodDefault<z.ZodEnum<{
            admin: "admin";
            lawyer: "lawyer";
            assistant: "assistant";
            intern: "intern";
        }>>;
        isActive: z.ZodDefault<z.ZodBoolean>;
        permissions: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            create_client: "create_client";
            edit_client: "edit_client";
            delete_client: "delete_client";
            create_case: "create_case";
            edit_case: "edit_case";
            delete_case: "delete_case";
            create_task: "create_task";
            edit_task: "edit_task";
            delete_task: "delete_task";
            view_reports: "view_reports";
            manage_users: "manage_users";
        }>>>;
        branch: z.ZodOptional<z.ZodString>;
        hourlyRate: z.ZodOptional<z.ZodNumber>;
        lastLogin: z.ZodOptional<z.ZodString>;
        loginCount: z.ZodDefault<z.ZodNumber>;
        createdAt: z.ZodOptional<z.ZodString>;
        createdBy: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    LegalProcedureSchema: z.ZodObject<{
        procedureId: z.ZodOptional<z.ZodString>;
        clientId: z.ZodString;
        clientName: z.ZodString;
        caseId: z.ZodOptional<z.ZodString>;
        caseName: z.ZodOptional<z.ZodString>;
        procedureName: z.ZodString;
        court: z.ZodOptional<z.ZodString>;
        courtBranch: z.ZodOptional<z.ZodString>;
        procedureDate: z.ZodString;
        procedureTime: z.ZodOptional<z.ZodString>;
        status: z.ZodDefault<z.ZodEnum<{
            completed: "completed";
            cancelled: "cancelled";
            scheduled: "scheduled";
            postponed: "postponed";
        }>>;
        notes: z.ZodOptional<z.ZodString>;
        assignedTo: z.ZodOptional<z.ZodString>;
        reminders: z.ZodOptional<z.ZodArray<z.ZodObject<{
            date: z.ZodString;
            sent: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>>;
        createdAt: z.ZodOptional<z.ZodString>;
        createdBy: z.ZodOptional<z.ZodString>;
        lastModifiedAt: z.ZodOptional<z.ZodString>;
        lastModifiedBy: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    validateClient: typeof validateClient;
    validateCase: typeof validateCase;
    validateBudgetTask: typeof validateBudgetTask;
    validateTimesheetEntry: typeof validateTimesheetEntry;
    validateEmployee: typeof validateEmployee;
    validateLegalProcedure: typeof validateLegalProcedure;
};
export default _default;
//# sourceMappingURL=index.d.ts.map