// validation.service.ts - Generic validation service

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';

import { BaseEntity } from '../models/base.models';
import {
  ValidationConfig,
  ValidationContext,
  ValidationResult,
  ValidationState,
  ValidationError,
  FieldValidationRules,
  ValidatorConfig,
  ExternalContext
} from '../models/validation.models';

/**
 * Generic validation service
 * 
 * @template T - Entity type
 */
@Injectable()
export class ValidationService<T extends BaseEntity = BaseEntity> {
  
  private validationStates$ = new BehaviorSubject<Record<string, ValidationState>>({});
  private asyncValidation$ = new Subject<{
    entityId: string;
    field: keyof T;
    validator: ValidatorConfig<T>;
    context: ValidationContext<T>;
  }>();

  constructor(private config: ValidationConfig<T>) {
    this.setupAsyncValidation();
  }

  /**
   * Setup async validation with debouncing
   */
  private setupAsyncValidation(): void {
    this.asyncValidation$
      .pipe(
        debounceTime(300),
        distinctUntilChanged((a, b) => 
          a.entityId === b.entityId && 
          a.field === b.field &&
          JSON.stringify(a.context.value) === JSON.stringify(b.context.value)
        )
      )
      .subscribe(async ({ entityId, field, validator, context }) => {
        this.setFieldValidating(entityId, String(field), true);
        
        try {
          const result = await validator.validate(context);
          this.setFieldErrors(entityId, String(field), result.errors || []);
        } catch (error) {
          console.error('Async validation error:', error);
          this.setFieldErrors(entityId, String(field), [{
            field: String(field),
            message: 'Validation error occurred',
            code: 'ASYNC_ERROR',
            severity: 'error'
          }]);
        } finally {
          this.setFieldValidating(entityId, String(field), false);
        }
      });
  }

  /**
   * Validate single field
   * 
   * @param external - External context (component state, services, etc.)
   */
  async validateField(
    entityId: string,
    entity: T,
    field: keyof T,
    value: any,
    trigger: 'blur' | 'change' | 'submit' | 'always' = 'change',
    allEntities?: T[],
    external?: ExternalContext
  ): Promise<ValidationResult> {
    
    const fieldRules = this.config.fields.find(f => f.field === field);
    if (!fieldRules) {
      return { valid: true };
    }

    const context: ValidationContext<T> = {
      entity,
      field,
      value,
      oldValue: entity[field],
      allEntities,
      external  // 🆕 Pass external context
    };

    // Filter validators by trigger
    const validators = fieldRules.validators.filter(v => 
      !v.trigger || v.trigger === trigger || v.trigger === 'always'
    );

    const allErrors: ValidationError[] = [];
    
    for (const validator of validators) {
      if (validator.async) {
        // Async validators - debounced
        this.asyncValidation$.next({ entityId, field, validator, context });
        continue;
      }

      // Sync validators
      const result = await validator.validate(context);
      
      if (result.errors && result.errors.length > 0) {
        allErrors.push(...result.errors);
        
        if (fieldRules.stopOnFirstError) {
          break;
        }
      }
    }

    // Update state
    this.setFieldErrors(entityId, String(field), allErrors);

    return {
      valid: allErrors.filter(e => e.severity === 'error').length === 0,
      errors: allErrors
    };
  }

  /**
   * Validate entire entity
   * 
   * @param external - External context (component state, services, etc.)
   */
  async validateEntity(
    entityId: string,
    entity: T,
    trigger: 'change' | 'submit' | 'always' = 'submit',
    allEntities?: T[],
    external?: ExternalContext
  ): Promise<ValidationResult> {
    
    const allErrors: ValidationError[] = [];

    // 1. Validate all fields
    for (const fieldRules of this.config.fields) {
      const value = entity[fieldRules.field];
      const result = await this.validateField(
        entityId,
        entity,
        fieldRules.field,
        value,
        trigger === 'submit' ? 'submit' : 'change',
        allEntities,
        external  // 🆕 Pass external context
      );
      
      if (result.errors) {
        allErrors.push(...result.errors);
      }

      if (this.config.options?.stopOnFirstFieldError && !result.valid) {
        break;
      }
    }

    // 2. Entity-level validations
    if (this.config.entityRules) {
      for (const rule of this.config.entityRules) {
        if (rule.trigger && rule.trigger !== trigger && rule.trigger !== 'always') {
          continue;
        }

        const result = await rule.validate(entity, allEntities, external);  // 🆕 Pass external
        
        if (result.errors) {
          allErrors.push(...result.errors);
        }
      }
    }

    // Update state
    const state = this.getOrCreateState(entityId);
    state.entityErrors = allErrors.filter(e => !e.field || e.field === '');
    this.updateState(entityId, state);

    return {
      valid: allErrors.filter(e => e.severity === 'error').length === 0,
      errors: allErrors
    };
  }

  /**
   * Validate field change (when field depends on others)
   * 
   * @param external - External context
   */
  async validateDependentFields(
    entityId: string,
    entity: T,
    changedField: keyof T,
    allEntities?: T[],
    external?: ExternalContext
  ): Promise<void> {
    // Find fields that depend on the changed field
    const dependentFields = this.config.fields.filter(fieldRules =>
      fieldRules.validators.some(v => v.dependsOn?.includes(changedField))
    );

    for (const fieldRules of dependentFields) {
      await this.validateField(
        entityId,
        entity,
        fieldRules.field,
        entity[fieldRules.field],
        'change',
        allEntities,
        external  // 🆕 Pass external
      );
    }
  }

  /**
   * Get validation state for entity
   */
  getValidationState(entityId: string): Observable<ValidationState> {
    return this.validationStates$.pipe(
      map(states => states[entityId] || this.createEmptyState(entityId))
    );
  }

  /**
   * Get field errors
   */
  getFieldErrors(entityId: string, field: string): Observable<ValidationError[]> {
    return this.validationStates$.pipe(
      map(states => states[entityId]?.fieldErrors[field] || [])
    );
  }

  /**
   * Check if entity is valid
   */
  isValid(entityId: string): boolean {
    const state = this.validationStates$.value[entityId];
    if (!state) return true;

    const hasFieldErrors = Object.values(state.fieldErrors).some(errors =>
      errors.some(e => e.severity === 'error')
    );

    const hasEntityErrors = state.entityErrors.some(e => e.severity === 'error');

    return !hasFieldErrors && !hasEntityErrors;
  }

  /**
   * Check if field is valid
   */
  isFieldValid(entityId: string, field: string): boolean {
    const state = this.validationStates$.value[entityId];
    if (!state) return true;

    const errors = state.fieldErrors[field] || [];
    return !errors.some(e => e.severity === 'error');
  }

  /**
   * Clear validation for entity
   */
  clearValidation(entityId: string): void {
    const states = { ...this.validationStates$.value };
    delete states[entityId];
    this.validationStates$.next(states);
  }

  /**
   * Clear field validation
   */
  clearFieldValidation(entityId: string, field: string): void {
    const state = this.getOrCreateState(entityId);
    delete state.fieldErrors[field];
    this.updateState(entityId, state);
  }

  /**
   * Get all errors for entity
   */
  getAllErrors(entityId: string): ValidationError[] {
    const state = this.validationStates$.value[entityId];
    if (!state) return [];

    const fieldErrors = Object.values(state.fieldErrors).flat();
    return [...fieldErrors, ...state.entityErrors];
  }

  /**
   * Format error message
   * 
   * @param external - External context for custom formatting
   */
  formatError(error: ValidationError, external?: ExternalContext): string {
    if (this.config.options?.errorFormatter) {
      return this.config.options.errorFormatter(error, external);
    }
    return error.message;
  }

  // Private helpers

  private getOrCreateState(entityId: string): ValidationState {
    const states = this.validationStates$.value;
    return states[entityId] || this.createEmptyState(entityId);
  }

  private createEmptyState(entityId: string): ValidationState {
    return {
      entityId,
      fieldErrors: {},
      entityErrors: [],
      validating: false
    };
  }

  private updateState(entityId: string, state: ValidationState): void {
    const states = { ...this.validationStates$.value };
    states[entityId] = { ...state, lastValidated: new Date() };
    this.validationStates$.next(states);
  }

  private setFieldErrors(entityId: string, field: string, errors: ValidationError[]): void {
    const state = this.getOrCreateState(entityId);
    state.fieldErrors[field] = errors;
    this.updateState(entityId, state);
  }

  private setFieldValidating(entityId: string, field: string, validating: boolean): void {
    const state = this.getOrCreateState(entityId);
    state.validating = validating;
    this.updateState(entityId, state);
  }
}
