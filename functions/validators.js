/**
 * Schema Validation with Joi
 * Validation מקצועי של כל הנתונים הנכנסים
 */

const Joi = require('joi');
const functions = require('firebase-functions');

/**
 * Helper function to validate data against schema
 * @param {Object} schema - Joi schema
 * @param {Object} data - Data to validate
 * @throws {HttpsError} If validation fails
 * @returns {Object} Validated and sanitized data
 */
function validate(schema, data) {
  const { error, value } = schema.validate(data, {
    abortEarly: false, // Return all errors
    stripUnknown: true // Remove unknown fields
  });

  if (error) {
    const errorMessages = error.details.map(detail => detail.message).join(', ');
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Validation failed: ${errorMessages}`
    );
  }

  return value;
}

// ============================================================================
// TIMESHEET SCHEMAS
// ============================================================================

const timesheetEntrySchema = Joi.object({
  // Client info
  clientId: Joi.string().when('isInternal', {
    is: false,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  clientName: Joi.string().when('isInternal', {
    is: false,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),

  // Case info
  caseId: Joi.string().allow(null, '').optional(),
  caseTitle: Joi.string().allow(null, '').optional(),

  // Task info
  taskId: Joi.string().when('isInternal', {
    is: false,
    then: Joi.required().messages({
      'any.required': 'חובה לבחור משימה לרישום זמן על לקוח'
    }),
    otherwise: Joi.optional()
  }),

  // Time info
  minutes: Joi.number()
    .integer()
    .min(1)
    .max(1440) // Max 24 hours
    .required()
    .messages({
      'number.min': 'זמן מינימלי: דקה אחת',
      'number.max': 'זמן מקסימלי: 24 שעות (1440 דקות)'
    }),

  date: Joi.date()
    .max('now')
    .required()
    .messages({
      'date.max': 'לא ניתן לרשום זמן בעתיד'
    }),

  // Description
  action: Joi.string()
    .min(3)
    .max(500)
    .required()
    .messages({
      'string.min': 'תיאור חייב להכיל לפחות 3 תווים',
      'string.max': 'תיאור לא יכול לעבור 500 תווים'
    }),

  // Flags
  isInternal: Joi.boolean().default(false)
});

// ============================================================================
// TASK SCHEMAS
// ============================================================================

const createTaskSchema = Joi.object({
  title: Joi.string()
    .min(3)
    .max(200)
    .required()
    .messages({
      'string.min': 'כותרת חייבת להכיל לפחות 3 תווים',
      'string.max': 'כותרת לא יכולה לעבור 200 תווים'
    }),

  caseId: Joi.string().required(),

  budgetHours: Joi.number()
    .min(0.25)
    .max(1000)
    .required()
    .messages({
      'number.min': 'תקציב מינימלי: 0.25 שעות (15 דקות)',
      'number.max': 'תקציב מקסימלי: 1000 שעות'
    }),

  deadline: Joi.date()
    .min('now')
    .required()
    .messages({
      'date.min': 'דדליין חייב להיות בעתיד'
    }),

  assignedTo: Joi.string().email().optional(),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
  description: Joi.string().max(1000).optional()
});

const completeTaskSchema = Joi.object({
  taskId: Joi.string().required(),
  notes: Joi.string().max(500).optional()
});

// ============================================================================
// CLIENT SCHEMAS
// ============================================================================

const createClientSchema = Joi.object({
  // Basic info
  fullName: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'שם מלא חייב להכיל לפחות 2 תווים'
    }),

  idNumber: Joi.string()
    .pattern(/^\d{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'תעודת זהות חייבת להכיל 9 ספרות'
    }),

  phone: Joi.string()
    .pattern(/^0\d{8,9}$/)
    .required()
    .messages({
      'string.pattern.base': 'מספר טלפון לא תקין'
    }),

  email: Joi.string().email().optional().allow(''),
  address: Joi.string().max(200).optional().allow(''),

  // Case type
  caseType: Joi.string()
    .valid('hours', 'legal-hourly', 'legal-fixed')
    .required(),

  // For hours plan
  initialHours: Joi.number().when('caseType', {
    is: 'hours',
    then: Joi.required().min(1),
    otherwise: Joi.forbidden()
  }),

  pricePerHour: Joi.number().when('caseType', {
    is: 'hours',
    then: Joi.required().min(0),
    otherwise: Joi.forbidden()
  }),

  // For legal procedures
  stages: Joi.array().when('caseType', {
    is: Joi.valid('legal-hourly', 'legal-fixed'),
    then: Joi.required().min(1),
    otherwise: Joi.forbidden()
  }).items(
    Joi.object({
      name: Joi.string().required(),
      hours: Joi.number().min(0).required(),
      price: Joi.number().min(0).required(),
      status: Joi.string().valid('pending', 'active', 'completed').default('pending')
    })
  )
});

// ============================================================================
// PACKAGE SCHEMAS
// ============================================================================

const addPackageSchema = Joi.object({
  caseId: Joi.string().required(),
  stageId: Joi.string().when('$caseType', {
    is: Joi.valid('legal-hourly', 'legal-fixed'),
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),

  hours: Joi.number()
    .min(0.25)
    .max(1000)
    .required()
    .messages({
      'number.min': 'מינימום 0.25 שעות (15 דקות)',
      'number.max': 'מקסימום 1000 שעות'
    }),

  reason: Joi.string()
    .min(3)
    .max(200)
    .required()
    .messages({
      'string.min': 'סיבה חייבת להכיל לפחות 3 תווים'
    }),

  purchaseDate: Joi.date().max('now').optional()
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  validate,
  schemas: {
    timesheetEntry: timesheetEntrySchema,
    createTask: createTaskSchema,
    completeTask: completeTaskSchema,
    createClient: createClientSchema,
    addPackage: addPackageSchema
  }
};
