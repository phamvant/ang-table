// base.models.ts - Core generic interfaces

/**
 * Base entity interface - ALL entities must have id
 */
export interface BaseEntity {
  id: string;
  [key: string]: any;  // Allow additional properties
}

/**
 * Generic DTO interface
 * TBase = your base entity type
 */
export interface BaseDTO<TBase extends BaseEntity = BaseEntity> extends TBase {
  // Computed fields (optional)
  // Will be calculated on-demand, not stored
}

/**
 * Generic normalized state
 */
export interface NormalizedState<T extends BaseEntity> {
  ids: string[];
  entities: Record<string, T>;
}

/**
 * Entity update payload
 */
export interface EntityUpdate<T extends BaseEntity> {
  id: string;
  changes: Partial<T>;
}
