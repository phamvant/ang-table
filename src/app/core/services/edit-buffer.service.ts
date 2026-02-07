// edit-buffer.service.ts - Fully generic edit buffer

import { Injectable } from '@angular/core';
import { BaseEntity } from '../models/base.models';

/**
 * Array edit record
 */
export interface ArrayEdit<T = any> {
  entityId: string;
  arrayField: keyof T;
  index: number;
  value: any;
}

/**
 * Generic edit buffer service
 * Stores temporary edits before saving to store
 * 
 * @template T - Entity type
 * 
 * @example
 * const orderBuffer = new EditBufferService<OrderEntity>();
 * orderBuffer.updateField('order-1', 'price', 100);
 */
@Injectable()
export class EditBufferService<T extends BaseEntity = BaseEntity> {
  private fieldEdits: Record<string, Partial<T>> = {};
  private arrayEdits: ArrayEdit<T>[] = [];

  /**
   * Update base field
   */
  updateField(entityId: string, field: keyof T, value: any): void {
    if (!this.fieldEdits[entityId]) {
      this.fieldEdits[entityId] = {};
    }
    this.fieldEdits[entityId][field] = value;
  }

  /**
   * Update array item
   */
  updateArrayItem(
    entityId: string,
    arrayField: keyof T,
    index: number,
    value: any
  ): void {
    // Remove existing edit for same location
    this.arrayEdits = this.arrayEdits.filter(
      e => !(
        e.entityId === entityId &&
        e.arrayField === arrayField &&
        e.index === index
      )
    );

    // Add new edit
    this.arrayEdits.push({ entityId, arrayField, index, value });
  }

  /**
   * Get field value (edited or original)
   */
  getFieldValue(entityId: string, field: keyof T, original: any): any {
    return this.fieldEdits[entityId]?.[field] ?? original;
  }

  /**
   * Get array item value (edited or original)
   */
  getArrayValue(
    entityId: string,
    arrayField: keyof T,
    index: number,
    original: any
  ): any {
    const edit = this.arrayEdits.find(
      e =>
        e.entityId === entityId &&
        e.arrayField === arrayField &&
        e.index === index
    );
    return edit?.value ?? original;
  }

  /**
   * Get all changes for entity
   */
  getChanges(entityId: string): {
    fields: Partial<T>;
    arrays: ArrayEdit<T>[];
  } {
    return {
      fields: this.fieldEdits[entityId] || {},
      arrays: this.arrayEdits.filter(e => e.entityId === entityId)
    };
  }

  /**
   * Check if entity has changes
   */
  hasChanges(entityId: string): boolean {
    return (
      !!this.fieldEdits[entityId] ||
      this.arrayEdits.some(e => e.entityId === entityId)
    );
  }

  /**
   * Clear entity edits
   */
  clearEntity(entityId: string): void {
    delete this.fieldEdits[entityId];
    this.arrayEdits = this.arrayEdits.filter(e => e.entityId !== entityId);
  }

  /**
   * Clear all edits
   */
  clearAll(): void {
    this.fieldEdits = {};
    this.arrayEdits = [];
  }

  /**
   * Get all dirty entity IDs
   */
  getDirtyEntities(): string[] {
    const fieldIds = Object.keys(this.fieldEdits);
    const arrayIds = [...new Set(this.arrayEdits.map(e => e.entityId))];
    return [...new Set([...fieldIds, ...arrayIds])];
  }

  /**
   * Get total number of changes
   */
  getTotalChanges(): number {
    const fieldCount = Object.values(this.fieldEdits).reduce(
      (sum, fields) => sum + Object.keys(fields).length,
      0
    );
    return fieldCount + this.arrayEdits.length;
  }
}
