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
  private stateChange$ = new Subject<void>();
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
   * Cell key for storage: field or field_arrayIndex
   */
  private cellKey(field: string, arrayIndex?: number): string {
    return arrayIndex === undefined ? field : `${field}_${arrayIndex}`;
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
          (a.context.arrayIndex ?? -1) === (b.context.arrayIndex ?? -1) &&
          JSON.stringify(a.context.value) === JSON.stringify(b.context.value)
        )
      )
      .subscribe(async ({ entityId, field, validator, context }) => {
        const key = String(field);
        const arrayIndex = context.arrayIndex;
        this.setFieldValidating(entityId, key, true);

        try {
          const result = await validator.validate(context);
          this.setFieldErrors(entityId, key, result.errors || [], arrayIndex);
        } catch (error) {
          console.error('Async validation error:', error);
          this.setFieldErrors(entityId, key, [{
            field: key,
            message: 'Validation error occurred',
            code: 'ASYNC_ERROR',
            severity: 'error',
            arrayIndex
          }], arrayIndex);
        } finally {
          this.setFieldValidating(entityId, key, false);
        }
      });
  }

  /**
   * Validate single field (or single array cell when arrayIndex is provided).
   *
   * @param arrayIndex - When validating an array field, the index of the cell.
   * @param external - External context (component state, services, etc.)
   */
  async validateField(
    entityId: string,
    entity: T,
    field: keyof T,
    value: any,
    trigger: 'blur' | 'change' | 'submit' | 'always' = 'change',
    allEntities?: T[],
    external?: ExternalContext,
    arrayIndex?: number
  ): Promise<ValidationResult> {
    const fieldRules = this.config.fields.find(f => f.field === field);
    if (!fieldRules) {
      return { valid: true };
    }

    const context: ValidationContext<T> = {
      entity,
      field,
      value,
      oldValue: Array.isArray(entity[field]) && arrayIndex !== undefined
        ? (entity[field] as any[])[arrayIndex]
        : entity[field],
      allEntities,
      external,
      arrayIndex
    };

    const validators = fieldRules.validators.filter(v =>
      !v.trigger || v.trigger === trigger || v.trigger === 'always'
    );

    const allErrors: ValidationError[] = [];

    for (const validator of validators) {
      if (validator.async) {
        this.asyncValidation$.next({ entityId, field, validator, context });
        continue;
      }

      const result = await validator.validate(context);

      if (result.errors && result.errors.length > 0) {
        const withIndex = result.errors.map(e => ({ ...e, arrayIndex }));
        allErrors.push(...withIndex);
        if (fieldRules.stopOnFirstError) {
          break;
        }
      }
    }

    this.setFieldErrors(entityId, String(field), allErrors, arrayIndex);

    return {
      valid: allErrors.filter(e => e.severity === 'error').length === 0,
      errors: allErrors
    };
  }

  /**
   * Validate entire entity (including each array cell when field is an array).
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
    const submitTrigger = trigger === 'submit' ? 'submit' : 'change';

    for (const fieldRules of this.config.fields) {
      const value = entity[fieldRules.field];

      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const result = await this.validateField(
            entityId,
            entity,
            fieldRules.field,
            value[i],
            submitTrigger,
            allEntities,
            external,
            i
          );
          if (result.errors) {
            allErrors.push(...result.errors);
          }
          if (this.config.options?.stopOnFirstFieldError && !result.valid) {
            break;
          }
        }
      } else {
        const result = await this.validateField(
          entityId,
          entity,
          fieldRules.field,
          value,
          submitTrigger,
          allEntities,
          external,
          undefined
        );
        if (result.errors) {
          allErrors.push(...result.errors);
        }
        if (this.config.options?.stopOnFirstFieldError && !result.valid) {
          break;
        }
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
   * Validate field change (when field depends on others).
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
    const dependentFields = this.config.fields.filter(fieldRules =>
      fieldRules.validators.some(v => v.dependsOn?.includes(changedField))
    );

    for (const fieldRules of dependentFields) {
      const value = entity[fieldRules.field];
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          await this.validateField(
            entityId,
            entity,
            fieldRules.field,
            value[i],
            'change',
            allEntities,
            external,
            i
          );
        }
      } else {
        await this.validateField(
          entityId,
          entity,
          fieldRules.field,
          value,
          'change',
          allEntities,
          external,
          undefined
        );
      }
    }
  }

  /**
   * Emits when any validation state changes (for triggering change detection in consumers).
   */
  get onStateChange(): Observable<void> {
    return this.stateChange$.asObservable();
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
   * Get field errors (Observable). For array fields, pass arrayIndex to get a specific cell.
   */
  getFieldErrors(entityId: string, field: string, arrayIndex?: number): Observable<ValidationError[]> {
    const key = this.cellKey(field, arrayIndex);
    return this.validationStates$.pipe(
      map(states => states[entityId]?.fieldErrors[key] || [])
    );
  }

  /**
   * Get errors for a single cell (sync). Use in templates.
   */
  getCellErrors(entityId: string, field: string, arrayIndex?: number): ValidationError[] {
    const key = this.cellKey(field, arrayIndex);
    const state = this.validationStates$.value[entityId];
    return state?.fieldErrors[key] || [];
  }

  /**
   * Set errors for a single cell (public API for manual errors).
   */
  setCellErrors(entityId: string, field: string, errors: ValidationError[], arrayIndex?: number): void {
    this.setFieldErrors(entityId, field, errors, arrayIndex);
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
   * Check if field/cell is valid
   */
  isFieldValid(entityId: string, field: string, arrayIndex?: number): boolean {
    const state = this.validationStates$.value[entityId];
    if (!state) return true;
    const key = this.cellKey(field, arrayIndex);
    const errors = state.fieldErrors[key] || [];
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
   * Clear field or single cell validation. If arrayIndex is undefined, clears the field and all its array cells (keys field, field_0, field_1, ...).
   */
  clearFieldValidation(entityId: string, field: string, arrayIndex?: number): void {
    const state = this.getOrCreateState(entityId);
    if (arrayIndex !== undefined) {
      delete state.fieldErrors[this.cellKey(field, arrayIndex)];
    } else {
      delete state.fieldErrors[field];
      const keysToDelete = Object.keys(state.fieldErrors).filter(key => key.startsWith(`${field}_`));
      keysToDelete.forEach(key => delete state.fieldErrors[key]);
    }
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
    this.stateChange$.next();
  }

  private setFieldErrors(entityId: string, field: string, errors: ValidationError[], arrayIndex?: number): void {
    const state = this.getOrCreateState(entityId);
    const key = this.cellKey(field, arrayIndex);
    state.fieldErrors[key] = errors;
    this.updateState(entityId, state);
  }

  private setFieldValidating(entityId: string, field: string, validating: boolean): void {
    const state = this.getOrCreateState(entityId);
    state.validating = validating;
    this.updateState(entityId, state);
  }
}
