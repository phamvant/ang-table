// compute.config.ts - Generic computed fields configuration

import { BaseEntity, BaseDTO } from './base.models';

/**
 * Generic compute configuration
 * Define how to calculate computed fields from base entity
 * 
 * @example
 * const orderCompute: ComputeConfig<OrderEntity, OrderDTO> = {
 *   compute: (entity) => ({
 *     ...entity,
 *     total: entity.price * entity.qty
 *   })
 * }
 */
export interface ComputeConfig<
  TEntity extends BaseEntity,
  TDTO extends BaseDTO<TEntity> = BaseDTO<TEntity>
> {
  /**
   * Transform entity to DTO with computed fields
   */
  compute: (entity: TEntity) => TDTO;
}

/**
 * Default pass-through compute (no computed fields)
 */
export function createPassThroughCompute<T extends BaseEntity>(): ComputeConfig<T, BaseDTO<T>> {
  return {
    compute: (entity) => entity as BaseDTO<T>
  };
}
