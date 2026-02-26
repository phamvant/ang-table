// generic-table.component.ts - Fully generic reusable table

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild
} from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, takeUntil } from 'rxjs';

import { BaseEntity, BaseDTO } from '../../core/models/base.models';
import { ColumnConfig, TableConfig } from '../../core/models/table-config.models';
import { EntityStore } from '../../core/services/entity.store';
import { EditBufferService, ArrayEdit } from '../../core/services/edit-buffer.service';
import { TableViewService, ExpandedRow } from '../../core/services/table-view.service';
import { ValidationService } from '../../core/services/validation.service';
import { ValidationError } from '../../core/models/validation.models';

/**
 * Fully generic reusable table component
 * 
 * @template TEntity - Base entity type (stored in EntityStore)
 * @template TDTO - DTO type (exposed to table, with computed fields)
 * 
 * @example
 * // Order table
 * <app-generic-table
 *   [store]="orderStore"
 *   [config]="orderTableConfig"
 *   (save)="onOrderSave($event)">
 * </app-generic-table>
 * 
 * // Product table
 * <app-generic-table
 *   [store]="productStore"
 *   [config]="productTableConfig"
 *   (save)="onProductSave($event)">
 * </app-generic-table>
 */
@Component({
  selector: 'app-generic-table',
  templateUrl: './generic-table.component.html',
  styleUrls: ['./generic-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TableViewService]
})
export class GenericTableComponent<
  TEntity extends BaseEntity,
  TDTO extends BaseDTO<TEntity> = BaseDTO<TEntity>
> implements OnInit, OnDestroy {
  
  /** Entity store */
  @Input() store!: EntityStore<TEntity, TDTO>;
  
  /** Table configuration */
  @Input() config!: TableConfig<TEntity>;
  
  /** Edit buffer service (can be provided externally for shared editing) */
  @Input() editBuffer?: EditBufferService<TEntity>;
  
  /** Auto-save on blur (default: true) */
  @Input() autoSave = true;

  /**
   * When true (default), the table updates the store after emitting save.
   * Set to false when the parent validates and updates the store (so failed validation
   * does not apply changes).
   */
  @Input() saveUpdatesStore = true;

  /** Optional validation service for per-cell error display */
  @Input() validationService?: ValidationService<TEntity>;

  /** Events */
  @Output() save = new EventEmitter<{ id: string; changes: Partial<TEntity>; arrays: ArrayEdit<TEntity>[] }>();
  @Output() cancel = new EventEmitter<string>();
  @Output() rowClick = new EventEmitter<ExpandedRow<TDTO>>();
  /** Emitted when a cell is edited (for live validation). arrayIndex set for array cells. */
  @Output() fieldEdit = new EventEmitter<{ entityId: string; entity: TEntity; field: keyof TEntity; value: any; arrayIndex?: number }>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  /** Table data */
  dataSource = new MatTableDataSource<ExpandedRow<TDTO>>([]);
  displayedColumns: string[] = [];
  
  /** Internal edit buffer if not provided */
  private internalEditBuffer?: EditBufferService<TEntity>;
  
  private destroy$ = new Subject<void>();
  private currentPage = 0;

  constructor(
    private viewService: TableViewService<TEntity, TDTO>,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Use provided edit buffer or create internal one
    if (!this.editBuffer) {
      this.internalEditBuffer = new EditBufferService<TEntity>();
      this.editBuffer = this.internalEditBuffer;
    }

    // Build displayed columns
    this.displayedColumns = this.config.columns
      .filter(c => !c.hidden)
      .map(c => c.field);

    // Load initial page
    this.loadPage(0);

    // React to validation state changes for cell error display
    if (this.validationService?.onStateChange) {
      this.validationService.onStateChange
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.cdr.markForCheck());
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load specific page
   */
  private loadPage(pageIndex: number): void {
    this.currentPage = pageIndex;
    const pageSize = this.config.pageSize || 10;

    this.store
      .selectPage(pageIndex, pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe(dtos => {
        const expandedRows = this.viewService.expandRows(
          dtos,
          this.config.columns,
          this.config.rowsPerEntity || 1,
          this.config.expandedRowArrayFields
        );
        this.dataSource.data = expandedRows;
        this.cdr.markForCheck();
      });
  }

  /**
   * Handle page change
   */
  onPageChange(event: PageEvent): void {
    this.loadPage(event.pageIndex);
  }

  /**
   * TrackBy function
   */
  trackByRow = (index: number, row: ExpandedRow<TDTO>): string =>
    `${row.entityId}-${row.expandedIndex}`;

  /**
   * Get rowspan for column
   */
  getRowspan(col: ColumnConfig<TEntity>, rowIndex: number): number | null {
    if (col.type !== 'base' && col.type !== 'computed') return null;
    if (!col.rowspan) return null;

    const rowsPerEntity = this.config.rowsPerEntity || 1;
    const posInEntity = rowIndex % rowsPerEntity;
    // Render a cell only at positions that are multiples of the rowspan.
    // rowspan:2 → renders at pos 0, hides pos 1.
    // rowspan:1 → renders at every pos (0,1,...).
    return posInEntity % col.rowspan === 0 ? col.rowspan : null;
  }

  /**
   * Check if cell should be hidden
   */
  isHidden(col: ColumnConfig<TEntity>, rowIndex: number): boolean {
    if (col.type !== 'base' && col.type !== 'computed') return false;
    if (!col.rowspan) return false;

    const rowsPerEntity = this.config.rowsPerEntity || 1;
    const posInEntity = rowIndex % rowsPerEntity;
    return posInEntity % col.rowspan !== 0;
  }

  /**
   * Effective array field for this row (when expandedRowArrayFields is set, row picks the array).
   */
  getArrayFieldForRow(row: ExpandedRow<TDTO>, col: ColumnConfig<TEntity>): keyof TEntity | undefined {
    if (col.type !== 'array') return undefined;
    const fields = this.config.expandedRowArrayFields;
    if (fields && row.expandedIndex >= 0 && row.expandedIndex < fields.length) {
      return fields[row.expandedIndex];
    }
    return col.arrayField;
  }

  /**
   * Row-scoped edit buffer key for valueAccessor columns.
   * Keeps edits on different expanded rows independent of each other.
   */
  private getBufferKey(col: ColumnConfig<TEntity>, expandedIndex: number): keyof TEntity {
    return (col.valueAccessor ? `${col.field}__${expandedIndex}` : col.field) as keyof TEntity;
  }

  /** DTO field name to use when writing to the save payload. */
  private getSaveField(col: ColumnConfig<TEntity>): string {
    return (col as any).saveField ?? col.field;
  }

  /**
   * Remap row-scoped buffer keys (field__N) back to DTO save fields before emitting save.
   */
  private remapChangesForSave(entityId: string): Partial<TEntity> {
    const fields = this.editBuffer!.getChanges(entityId).fields;
    const remapped: Partial<TEntity> = {};
    for (const [key, value] of Object.entries(fields)) {
      const sepIdx = key.lastIndexOf('__');
      if (sepIdx !== -1 && /^\d+$/.test(key.substring(sepIdx + 2))) {
        const fieldPart = key.substring(0, sepIdx);
        const col = this.config.columns.find(c => c.field === fieldPart && c.valueAccessor);
        if (col) {
          remapped[this.getSaveField(col) as keyof TEntity] = value as any;
          continue;
        }
      }
      remapped[key as keyof TEntity] = value as any;
    }
    return remapped;
  }

  /**
   * Get cell value (edited or original)
   */
  getCellValue(row: ExpandedRow<TDTO>, col: ColumnConfig<TEntity>): any {
    if (!this.editBuffer) return this.getOriginalValue(row, col);

    if (col.type === 'array' && col.arrayIndex !== undefined) {
      const arrayField = this.getArrayFieldForRow(row, col);
      if (!arrayField) return this.getOriginalValue(row, col);
      const original = row[col.field];
      return this.editBuffer.getArrayValue(
        row.entityId,
        arrayField,
        col.arrayIndex,
        original
      );
    } else {
      // Base/computed field
      if (col.valueAccessor) {
        // Use a row-scoped buffer key so edits on different expanded rows stay isolated.
        // Fall back to saveField (the actual DTO field) for the raw original value.
        const bufferKey = this.getBufferKey(col, row.expandedIndex);
        const rawOriginal = (row.data as any)[this.getSaveField(col)];
        const currentValue = this.editBuffer.getFieldValue(row.entityId, bufferKey, rawOriginal);
        return col.valueAccessor(row, col, currentValue);
      }
      const original = this.getOriginalValue(row, col);
      return this.editBuffer.getFieldValue(row.entityId, col.field as keyof TEntity, original);
    }
  }

  /**
   * Get original value from row
   */
  private getOriginalValue(row: ExpandedRow<TDTO>, col: ColumnConfig<TEntity>): any {
    if (col.valueAccessor) {
      const rawValue = (row.data as any)[this.getSaveField(col)];
      return col.valueAccessor(row, col, rawValue);
    }
    if (col.type === 'array') {
      return row[col.field];
    }
    return (row.data as any)[col.field];
  }

  /**
   * Format cell value
   */
  formatValue(row: ExpandedRow<TDTO>, col: ColumnConfig<TEntity>): string {
    const value = this.getCellValue(row, col);
    
    if (col.formatter) {
      return col.formatter(value, row.data);
    }
    
    return value ?? '';
  }

  /**
   * Handle cell edit
   */
  onCellEdit(row: ExpandedRow<TDTO>, col: ColumnConfig<TEntity>, value: any): void {
    if (!this.editBuffer) return;

    const entity = this.store.getOne(row.entityId);

    if (col.type === 'array' && col.arrayIndex !== undefined) {
      const arrayField = this.getArrayFieldForRow(row, col);
      if (!arrayField) return;
      this.editBuffer.updateArrayItem(
        row.entityId,
        arrayField,
        col.arrayIndex,
        value
      );
      if (entity) {
        this.fieldEdit.emit({
          entityId: row.entityId,
          entity,
          field: arrayField,
          value,
          arrayIndex: col.arrayIndex
        });
      }
    } else {
      const bufferKey = this.getBufferKey(col, row.expandedIndex);
      this.editBuffer.updateField(row.entityId, bufferKey, value);
      if (entity) {
        this.fieldEdit.emit({
          entityId: row.entityId,
          entity,
          field: this.getSaveField(col) as keyof TEntity,
          value
        });
      }
    }

    this.cdr.markForCheck();
  }

  /**
   * Get validation errors for a cell (for template). Uses validationService when provided.
   */
  getCellErrors(entityId: string, field: string, arrayIndex?: number): ValidationError[] {
    return this.validationService?.getCellErrors(entityId, field, arrayIndex) ?? [];
  }

  /**
   * Get validation errors for a cell using effective array field per row (for array columns when expandedRowArrayFields is set).
   */
  getCellErrorsForCell(row: ExpandedRow<TDTO>, col: ColumnConfig<TEntity>): ValidationError[] {
    if (col.type === 'array') {
      const field = this.getArrayFieldForRow(row, col) ?? col.arrayField;
      if (field === undefined) return [];
      return this.getCellErrors(row.entityId, field as string, col.arrayIndex);
    }
    return this.getCellErrors(row.entityId, col.field, undefined);
  }

  /**
   * Save single entity
   */
  async saveEntity(row: ExpandedRow<TDTO>): Promise<void> {
    if (!this.editBuffer || !this.autoSave) return;

    const changes = this.editBuffer.getChanges(row.entityId);
    const remappedFields = this.remapChangesForSave(row.entityId);
    if (Object.keys(remappedFields).length === 0 && changes.arrays.length === 0) {
      return;
    }

    try {
      this.save.emit({
        id: row.entityId,
        changes: remappedFields,
        arrays: changes.arrays
      });

      if (this.saveUpdatesStore) {
        if (Object.keys(remappedFields).length > 0) {
          this.store.updateOne(row.entityId, remappedFields);
        }
        for (const edit of changes.arrays) {
          const entity = this.store.getOne(row.entityId);
          if (entity && Array.isArray((entity as any)[edit.arrayField])) {
            const newArray = [...(entity as any)[edit.arrayField]];
            newArray[edit.index] = edit.value;
            this.store.updateOne(row.entityId, {
              [edit.arrayField]: newArray
            } as Partial<TEntity>);
          }
        }
      }

      this.editBuffer.clearEntity(row.entityId);
      this.cdr.markForCheck();

    } catch (error) {
      console.error('Save failed:', error);
    }
  }

  /**
   * Save all changes
   */
  async saveAll(): Promise<void> {
    if (!this.editBuffer) return;

    const dirtyEntities = this.editBuffer.getDirtyEntities();
    if (dirtyEntities.length === 0) return;

    try {
      for (const entityId of dirtyEntities) {
        const changes = this.editBuffer.getChanges(entityId);
        const remappedFields = this.remapChangesForSave(entityId);

        this.save.emit({
          id: entityId,
          changes: remappedFields,
          arrays: changes.arrays
        });

        if (this.saveUpdatesStore) {
          if (Object.keys(remappedFields).length > 0) {
            this.store.updateOne(entityId, remappedFields);
          }
          for (const edit of changes.arrays) {
            const entity = this.store.getOne(entityId);
            if (entity && Array.isArray((entity as any)[edit.arrayField])) {
              const newArray = [...(entity as any)[edit.arrayField]];
              newArray[edit.index] = edit.value;
              this.store.updateOne(entityId, {
                [edit.arrayField]: newArray
              } as Partial<TEntity>);
            }
          }
        }
      }

      this.editBuffer.clearAll();
      this.cdr.markForCheck();

    } catch (error) {
      console.error('Batch save failed:', error);
    }
  }

  /**
   * Cancel entity edits
   */
  cancelEntity(row: ExpandedRow<TDTO>): void {
    if (!this.editBuffer) return;
    
    this.editBuffer.clearEntity(row.entityId);
    this.cancel.emit(row.entityId);
    this.cdr.markForCheck();
  }

  /**
   * Cancel all edits
   */
  cancelAll(): void {
    if (!this.editBuffer) return;
    
    this.editBuffer.clearAll();
    this.cdr.markForCheck();
  }

  /**
   * Check if entity has changes
   */
  hasChanges(row: ExpandedRow<TDTO>): boolean {
    return this.editBuffer?.hasChanges(row.entityId) ?? false;
  }

  /**
   * Handle row click
   */
  onRowClick(row: ExpandedRow<TDTO>): void {
    this.rowClick.emit(row);
  }

  /**
   * Get total count for paginator
   */
  get totalCount(): number {
    return this.store.count * (this.config.rowsPerEntity || 1);
  }

  /**
   * Get number of dirty entities
   */
  get dirtyCount(): number {
    return this.editBuffer?.getDirtyEntities().length ?? 0;
  }

  /**
   * Get page size
   */
  get pageSize(): number {
    return this.config.pageSize || 10;
  }
}
