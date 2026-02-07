// entity.store.ts - Fully generic entity store

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseEntity, BaseDTO, NormalizedState, EntityUpdate } from '../models/base.models';
import { ComputeConfig } from '../models/compute.config';

/**
 * Generic entity store with normalized state
 * 
 * @template TEntity - Base entity type (what's stored)
 * @template TDTO - DTO type (what's exposed, with computed fields)
 * 
 * @example
 * // Order entity
 * const orderStore = new EntityStore<OrderEntity, OrderDTO>(orderComputeConfig);
 * 
 * // Product entity
 * const productStore = new EntityStore<ProductEntity, ProductDTO>(productComputeConfig);
 */
@Injectable()
export class EntityStore<
  TEntity extends BaseEntity,
  TDTO extends BaseDTO<TEntity> = BaseDTO<TEntity>
> {
  private state$ = new BehaviorSubject<NormalizedState<TEntity>>({
    ids: [],
    entities: {}
  });

  constructor(private computeConfig: ComputeConfig<TEntity, TDTO>) {}

  /**
   * Select all entities with computed fields
   */
  selectAll(): Observable<TDTO[]> {
    return this.state$.pipe(
      map(state => state.ids.map(id => this.toDTO(state.entities[id])))
    );
  }

  /**
   * Select specific page with computed fields
   */
  selectPage(pageIndex: number, pageSize: number): Observable<TDTO[]> {
    return this.state$.pipe(
      map(state => {
        const start = pageIndex * pageSize;
        const end = start + pageSize;
        return state.ids
          .slice(start, end)
          .map(id => this.toDTO(state.entities[id]));
      })
    );
  }

  /**
   * Select single entity by ID
   */
  selectOne(id: string): Observable<TDTO | undefined> {
    return this.state$.pipe(
      map(state => {
        const entity = state.entities[id];
        return entity ? this.toDTO(entity) : undefined;
      })
    );
  }

  /**
   * Get current snapshot of entity
   */
  getOne(id: string): TEntity | undefined {
    return this.state$.value.entities[id];
  }

  /**
   * Set all entities (replace entire store)
   */
  setAll(items: TDTO[]): void {
    const ids = items.map(item => item.id);
    const entities = items.reduce((acc, item) => {
      acc[item.id] = this.toEntity(item);
      return acc;
    }, {} as Record<string, TEntity>);

    this.state$.next({ ids, entities });
  }

  /**
   * Add single entity
   */
  addOne(item: TDTO): void {
    const state = this.state$.value;
    const entity = this.toEntity(item);

    this.state$.next({
      ids: [...state.ids, item.id],
      entities: {
        ...state.entities,
        [item.id]: entity
      }
    });
  }

  /**
   * Add multiple entities
   */
  addMany(items: TDTO[]): void {
    const state = this.state$.value;
    const newIds = items.map(item => item.id);
    const newEntities = items.reduce((acc, item) => {
      acc[item.id] = this.toEntity(item);
      return acc;
    }, {} as Record<string, TEntity>);

    this.state$.next({
      ids: [...state.ids, ...newIds],
      entities: {
        ...state.entities,
        ...newEntities
      }
    });
  }

  /**
   * Update single entity - O(1)
   */
  updateOne(id: string, changes: Partial<TEntity>): void {
    const state = this.state$.value;
    if (!state.entities[id]) return;

    this.state$.next({
      ...state,
      entities: {
        ...state.entities,
        [id]: { ...state.entities[id], ...changes }
      }
    });
  }

  /**
   * Update multiple entities - O(n)
   */
  updateMany(updates: EntityUpdate<TEntity>[]): void {
    const state = this.state$.value;
    const newEntities = { ...state.entities };

    updates.forEach(({ id, changes }) => {
      if (newEntities[id]) {
        newEntities[id] = { ...newEntities[id], ...changes };
      }
    });

    this.state$.next({
      ...state,
      entities: newEntities
    });
  }

  /**
   * Remove single entity
   */
  removeOne(id: string): void {
    const state = this.state$.value;
    const newEntities = { ...state.entities };
    delete newEntities[id];

    this.state$.next({
      ids: state.ids.filter(entityId => entityId !== id),
      entities: newEntities
    });
  }

  /**
   * Remove multiple entities
   */
  removeMany(ids: string[]): void {
    const state = this.state$.value;
    const idsSet = new Set(ids);
    const newEntities = { ...state.entities };

    ids.forEach(id => delete newEntities[id]);

    this.state$.next({
      ids: state.ids.filter(id => !idsSet.has(id)),
      entities: newEntities
    });
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.state$.next({ ids: [], entities: {} });
  }

  /**
   * Get total count
   */
  get count(): number {
    return this.state$.value.ids.length;
  }

  /**
   * Get all IDs
   */
  get ids(): string[] {
    return this.state$.value.ids;
  }

  /**
   * Convert entity to DTO (add computed fields)
   */
  private toDTO(entity: TEntity): TDTO {
    return this.computeConfig.compute(entity);
  }

  /**
   * Convert DTO to entity (remove computed fields)
   * Override this if you have complex conversion logic
   */
  protected toEntity(dto: TDTO): TEntity {
    return dto as TEntity;
  }
}
