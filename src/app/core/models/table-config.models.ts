// table-config.models.ts - Generic table configuration

import { BaseEntity } from './base.models';

export type ColumnType = 'base' | 'array' | 'computed';
export type EditType = 'text' | 'number' | 'select' | 'date' | 'checkbox';

export interface SelectOption {
  value: any;
  label: string;
}

/**
 * Generic column configuration
 * 
 * @template T - Entity type
 */
export interface ColumnConfig<T extends BaseEntity = BaseEntity> {
  /** Unique field identifier */
  field: string;
  
  /** Display header */
  header: string;
  
  /** Column type */
  type: ColumnType;
  
  /** Rowspan (for base/computed columns) */
  rowspan?: number;
  
  /** Array field source (for array columns) */
  arrayField?: keyof T;
  
  /** Array index (for array columns) */
  arrayIndex?: number;
  
  /** Is editable */
  editable?: boolean;
  
  /** Edit input type */
  editType?: EditType;
  
  /** Select options (if editType = 'select') */
  options?: SelectOption[];
  
  /** Depends on fields (for computed columns) */
  dependsOn?: (keyof T)[];
  
  /** Column width */
  width?: string;
  
  /** Min width */
  minWidth?: string;
  
  /** Value formatter */
  formatter?: (value: any, row?: any) => string;
  
  /** CSS class */
  cssClass?: string;
  
  /** Sticky column */
  sticky?: boolean;
  
  /** Hidden */
  hidden?: boolean;
}

/**
 * Table configuration
 */
export interface TableConfig<T extends BaseEntity = BaseEntity> {
  /** Column definitions */
  columns: ColumnConfig<T>[];
  
  /** Rows per entity (for array expansion) */
  rowsPerEntity?: number;
  
  /** Page size */
  pageSize?: number;
  
  /** Enable sorting */
  enableSort?: boolean;
  
  /** Enable filtering */
  enableFilter?: boolean;
}
