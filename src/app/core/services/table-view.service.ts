// table-view.service.ts - Generic table view transformation

import { Injectable } from '@angular/core';
import { BaseEntity, BaseDTO } from '../models/base.models';
import { ColumnConfig } from '../models/table-config.models';

/**
 * Generic expanded row
 */
export interface ExpandedRow<T extends BaseEntity = BaseEntity> {
  /** Original entity ID */
  entityId: string;
  
  /** Expanded row index */
  expandedIndex: number;
  
  /** Original data */
  data: T;
  
  /** Dynamic properties from array expansion */
  [key: string]: any;
}

/**
 * Generic table view service
 * Handles array expansion and row transformation
 * 
 * @template TEntity - Base entity type
 * @template TDTO - DTO type
 */
@Injectable()
export class TableViewService<
  TEntity extends BaseEntity,
  TDTO extends BaseDTO<TEntity> = BaseDTO<TEntity>
> {
  
  /**
   * Expand entities into table rows
   * 
   * @param dtos - Entity DTOs with computed fields
   * @param columns - Column configuration
   * @param rowsPerEntity - Number of rows per entity (for array expansion)
   */
  expandRows(
    dtos: TDTO[],
    columns: ColumnConfig<TEntity>[],
    rowsPerEntity: number = 1
  ): ExpandedRow<TDTO>[] {
    const arrayColumns = columns.filter(c => c.type === 'array');
    
    // No array columns = no expansion needed
    if (arrayColumns.length === 0 || rowsPerEntity === 1) {
      return dtos.map(dto => ({
        entityId: dto.id,
        expandedIndex: 0,
        data: dto
      }));
    }

    // Expand each entity into multiple rows
    const expanded: ExpandedRow<TDTO>[] = [];

    dtos.forEach(dto => {
      for (let i = 0; i < rowsPerEntity; i++) {
        const row: ExpandedRow<TDTO> = {
          entityId: dto.id,
          expandedIndex: i,
          data: dto
        };

        // Map array values to dynamic fields
        arrayColumns.forEach(col => {
          if (col.arrayField && col.arrayIndex !== undefined) {
            const arrayData = (dto as any)[col.arrayField];
            if (Array.isArray(arrayData)) {
              // For multi-row expansion, determine which array item to show
              // based on expandedIndex and arrayIndex
              const itemIndex = this.getArrayItemIndex(
                i,
                col.arrayIndex,
                rowsPerEntity
              );
              row[col.field] = arrayData[itemIndex] ?? null;
            }
          }
        });

        expanded.push(row);
      }
    });

    return expanded;
  }

  /**
   * Determine which array item to display
   * Can be overridden for custom logic
   */
  protected getArrayItemIndex(
    expandedIndex: number,
    arrayIndex: number,
    rowsPerEntity: number
  ): number {
    // Default: simple mapping
    return arrayIndex;
  }
}
