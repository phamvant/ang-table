// validators.library.ts - Built-in reusable validators

import { ValidationResult, ValidationContext, ValidatorConfig } from '../models/validation.models';
import { BaseEntity } from '../models/base.models';

/**
 * Built-in validator factory functions
 */
export class Validators {
  
  /**
   * Required validator
   */
  static required<T extends BaseEntity>(message?: string): ValidatorConfig<T> {
    return {
      name: 'required',
      trigger: 'blur',
      validate: (context) => {
        const isEmpty = context.value === null || 
                       context.value === undefined || 
                       context.value === '' ||
                       (Array.isArray(context.value) && context.value.length === 0);
        
        return {
          valid: !isEmpty,
          errors: isEmpty ? [{
            field: String(context.field),
            message: message || `${String(context.field)} is required`,
            code: 'REQUIRED',
            severity: 'error'
          }] : undefined
        };
      }
    };
  }

  /**
   * Min value validator
   */
  static min<T extends BaseEntity>(minValue: number, message?: string): ValidatorConfig<T> {
    return {
      name: 'min',
      trigger: 'change',
      validate: (context) => {
        const value = Number(context.value);
        const valid = isNaN(value) || value >= minValue;
        
        return {
          valid,
          errors: !valid ? [{
            field: String(context.field),
            message: message || `${String(context.field)} must be at least ${minValue}`,
            code: 'MIN_VALUE',
            severity: 'error',
            metadata: { minValue, actualValue: value }
          }] : undefined
        };
      }
    };
  }

  /**
   * Max value validator
   */
  static max<T extends BaseEntity>(maxValue: number, message?: string): ValidatorConfig<T> {
    return {
      name: 'max',
      trigger: 'change',
      validate: (context) => {
        const value = Number(context.value);
        const valid = isNaN(value) || value <= maxValue;
        
        return {
          valid,
          errors: !valid ? [{
            field: String(context.field),
            message: message || `${String(context.field)} must be at most ${maxValue}`,
            code: 'MAX_VALUE',
            severity: 'error',
            metadata: { maxValue, actualValue: value }
          }] : undefined
        };
      }
    };
  }

  /**
   * Range validator
   */
  static range<T extends BaseEntity>(min: number, max: number, message?: string): ValidatorConfig<T> {
    return {
      name: 'range',
      trigger: 'change',
      validate: (context) => {
        const value = Number(context.value);
        const valid = isNaN(value) || (value >= min && value <= max);
        
        return {
          valid,
          errors: !valid ? [{
            field: String(context.field),
            message: message || `${String(context.field)} must be between ${min} and ${max}`,
            code: 'RANGE',
            severity: 'error',
            metadata: { min, max, actualValue: value }
          }] : undefined
        };
      }
    };
  }

  /**
   * Pattern (regex) validator
   */
  static pattern<T extends BaseEntity>(regex: RegExp, message?: string): ValidatorConfig<T> {
    return {
      name: 'pattern',
      trigger: 'blur',
      validate: (context) => {
        const value = String(context.value || '');
        const valid = value === '' || regex.test(value);
        
        return {
          valid,
          errors: !valid ? [{
            field: String(context.field),
            message: message || `${String(context.field)} has invalid format`,
            code: 'PATTERN',
            severity: 'error',
            metadata: { pattern: regex.source }
          }] : undefined
        };
      }
    };
  }

  /**
   * Email validator
   */
  static email<T extends BaseEntity>(message?: string): ValidatorConfig<T> {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return Validators.pattern(emailRegex, message || 'Invalid email format');
  }

  /**
   * Min length validator
   */
  static minLength<T extends BaseEntity>(minLen: number, message?: string): ValidatorConfig<T> {
    return {
      name: 'minLength',
      trigger: 'blur',
      validate: (context) => {
        const value = String(context.value || '');
        const valid = value.length >= minLen;
        
        return {
          valid,
          errors: !valid ? [{
            field: String(context.field),
            message: message || `${String(context.field)} must be at least ${minLen} characters`,
            code: 'MIN_LENGTH',
            severity: 'error',
            metadata: { minLength: minLen, actualLength: value.length }
          }] : undefined
        };
      }
    };
  }

  /**
   * Max length validator
   */
  static maxLength<T extends BaseEntity>(maxLen: number, message?: string): ValidatorConfig<T> {
    return {
      name: 'maxLength',
      trigger: 'blur',
      validate: (context) => {
        const value = String(context.value || '');
        const valid = value.length <= maxLen;
        
        return {
          valid,
          errors: !valid ? [{
            field: String(context.field),
            message: message || `${String(context.field)} must be at most ${maxLen} characters`,
            code: 'MAX_LENGTH',
            severity: 'error',
            metadata: { maxLength: maxLen, actualLength: value.length }
          }] : undefined
        };
      }
    };
  }

  /**
   * Unique validator (within entity set)
   */
  static unique<T extends BaseEntity>(
    fieldGetter?: (entity: T) => any,
    message?: string
  ): ValidatorConfig<T> {
    return {
      name: 'unique',
      trigger: 'blur',
      validate: (context) => {
        if (!context.allEntities) {
          return { valid: true };
        }

        const currentValue = context.value;
        const field = context.field;
        
        const duplicates = context.allEntities.filter(entity => {
          if (entity.id === context.entity.id) return false; // Skip self
          
          const entityValue = fieldGetter 
            ? fieldGetter(entity)
            : entity[field];
          
          return entityValue === currentValue;
        });

        const valid = duplicates.length === 0;
        
        return {
          valid,
          errors: !valid ? [{
            field: String(field),
            message: message || `${String(field)} must be unique`,
            code: 'UNIQUE',
            severity: 'error',
            metadata: { duplicateCount: duplicates.length }
          }] : undefined
        };
      }
    };
  }

  /**
   * Custom validator
   */
  static custom<T extends BaseEntity>(
    fn: (value: any, context: ValidationContext<T>) => boolean,
    message: string,
    code = 'CUSTOM'
  ): ValidatorConfig<T> {
    return {
      name: 'custom',
      trigger: 'blur',
      validate: (context) => {
        const valid = fn(context.value, context);
        
        return {
          valid,
          errors: !valid ? [{
            field: String(context.field),
            message,
            code,
            severity: 'error'
          }] : undefined
        };
      }
    };
  }

  /**
   * Async validator (e.g., check server)
   */
  static async<T extends BaseEntity>(
    fn: (value: any, context: ValidationContext<T>) => Promise<boolean>,
    message: string,
    debounce = 300
  ): ValidatorConfig<T> {
    return {
      name: 'async',
      trigger: 'blur',
      async: true,
      debounce,
      validate: async (context) => {
        const valid = await fn(context.value, context);
        
        return {
          valid,
          errors: !valid ? [{
            field: String(context.field),
            message,
            code: 'ASYNC',
            severity: 'error'
          }] : undefined
        };
      }
    };
  }

  /**
   * Conditional validator
   */
  static when<T extends BaseEntity>(
    condition: (context: ValidationContext<T>) => boolean,
    validator: ValidatorConfig<T>
  ): ValidatorConfig<T> {
    return {
      ...validator,
      name: `when_${validator.name}`,
      validate: (context) => {
        if (!condition(context)) {
          return { valid: true };
        }
        return validator.validate(context);
      }
    };
  }

  /**
   * Compare fields validator
   */
  static compareFields<T extends BaseEntity>(
    otherField: keyof T,
    comparison: 'equal' | 'notEqual' | 'greaterThan' | 'lessThan',
    message?: string
  ): ValidatorConfig<T> {
    return {
      name: 'compareFields',
      trigger: 'change',
      dependsOn: [otherField],
      validate: (context) => {
        const value = context.value;
        const otherValue = context.entity[otherField];
        
        let valid = false;
        switch (comparison) {
          case 'equal':
            valid = value === otherValue;
            break;
          case 'notEqual':
            valid = value !== otherValue;
            break;
          case 'greaterThan':
            valid = Number(value) > Number(otherValue);
            break;
          case 'lessThan':
            valid = Number(value) < Number(otherValue);
            break;
        }
        
        return {
          valid,
          errors: !valid ? [{
            field: String(context.field),
            message: message || `${String(context.field)} must be ${comparison} ${String(otherField)}`,
            code: 'COMPARE_FIELDS',
            severity: 'error',
            metadata: { otherField, comparison }
          }] : undefined
        };
      }
    };
  }

  /**
   * Warning validator (non-blocking)
   */
  static warning<T extends BaseEntity>(
    fn: (value: any, context: ValidationContext<T>) => boolean,
    message: string
  ): ValidatorConfig<T> {
    return {
      name: 'warning',
      trigger: 'blur',
      validate: (context) => {
        const hasWarning = !fn(context.value, context);
        
        return {
          valid: true, // Warnings don't block
          errors: hasWarning ? [{
            field: String(context.field),
            message,
            code: 'WARNING',
            severity: 'warning'
          }] : undefined
        };
      }
    };
  }

  /**
   * Info validator (informational only)
   */
  static info<T extends BaseEntity>(
    fn: (value: any, context: ValidationContext<T>) => boolean,
    message: string
  ): ValidatorConfig<T> {
    return {
      name: 'info',
      trigger: 'change',
      validate: (context) => {
        const showInfo = fn(context.value, context);
        
        return {
          valid: true,
          errors: showInfo ? [{
            field: String(context.field),
            message,
            code: 'INFO',
            severity: 'info'
          }] : undefined
        };
      }
    };
  }
}
