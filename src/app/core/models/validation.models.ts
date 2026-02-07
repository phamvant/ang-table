// validation.models.ts - Flexible validation system

import { BaseEntity } from './base.models';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning' | 'info';
  metadata?: Record<string, any>;
  /** Index within array field (for per-cell errors) */
  arrayIndex?: number;
}

/**
 * External context - ANY data from component/screen
 * This allows validators to access component state, services, etc.
 */
export interface ExternalContext {
  /** Component instance (this) */
  component?: any;
  
  /** Any custom data from component */
  [key: string]: any;
}

/**
 * Validation context - provides runtime information
 * ENHANCED: Now includes external context
 */
export interface ValidationContext<T extends BaseEntity = BaseEntity> {
  /** Current entity being validated */
  entity: T;
  
  /** Field being validated */
  field: keyof T;
  
  /** New value */
  value: any;
  
  /** Old value (for change validation) */
  oldValue?: any;
  
  /** All entities in store (for cross-entity validation) */
  allEntities?: T[];
  
  /** Current row index (for array validation) */
  rowIndex?: number;
  
  /** Index within array field (for per-cell validation) */
  arrayIndex?: number;
  
  /** Custom metadata */
  metadata?: Record<string, any>;
  
  /** 🆕 EXTERNAL CONTEXT - Access component data */
  external?: ExternalContext;
}

/**
 * Validator function signature
 */
export type ValidatorFn<T extends BaseEntity = BaseEntity> = (
  context: ValidationContext<T>
) => ValidationResult | Promise<ValidationResult>;

/**
 * Validator configuration
 */
export interface ValidatorConfig<T extends BaseEntity = BaseEntity> {
  /** Validator name */
  name: string;
  
  /** Validator function */
  validate: ValidatorFn<T>;
  
  /** When to run validator */
  trigger?: 'blur' | 'change' | 'submit' | 'always';
  
  /** Run async (default: false) */
  async?: boolean;
  
  /** Debounce time in ms (for async validators) */
  debounce?: number;
  
  /** Depends on other fields (re-run when these change) */
  dependsOn?: (keyof T)[];
  
  /** 🆕 Depends on external data (re-run when these change) */
  dependsOnExternal?: string[];
}

/**
 * Field validation rules
 */
export interface FieldValidationRules<T extends BaseEntity = BaseEntity> {
  field: keyof T;
  validators: ValidatorConfig<T>[];
  
  /** Custom error messages */
  messages?: Record<string, string>;
  
  /** Stop on first error */
  stopOnFirstError?: boolean;
}

/**
 * Entity-level validation rules (cross-field validation)
 */
export interface EntityValidationRules<T extends BaseEntity = BaseEntity> {
  /** Entity validator name */
  name: string;
  
  /** Validator function - NOW with external context */
  validate: (
    entity: T, 
    allEntities?: T[],
    external?: ExternalContext
  ) => ValidationResult | Promise<ValidationResult>;
  
  /** When to run */
  trigger?: 'change' | 'submit' | 'always';
  
  /** Async */
  async?: boolean;
  
  /** 🆕 Depends on external data */
  dependsOnExternal?: string[];
}

/**
 * Complete validation configuration for an entity type
 */
export interface ValidationConfig<T extends BaseEntity = BaseEntity> {
  /** Field-level validations */
  fields: FieldValidationRules<T>[];
  
  /** Entity-level validations */
  entityRules?: EntityValidationRules<T>[];
  
  /** Global options */
  options?: {
    /** Stop on first field error */
    stopOnFirstFieldError?: boolean;
    
    /** Show warnings as errors */
    warningsAsErrors?: boolean;
    
    /** Custom error formatter - NOW with external context */
    errorFormatter?: (error: ValidationError, external?: ExternalContext) => string;
  };
}

/**
 * Validation state for an entity
 */
export interface ValidationState {
  /** Entity ID */
  entityId: string;
  
  /** Field errors */
  fieldErrors: Record<string, ValidationError[]>;
  
  /** Entity-level errors */
  entityErrors: ValidationError[];
  
  /** Is validating (async) */
  validating: boolean;
  
  /** Last validation time */
  lastValidated?: Date;
}
