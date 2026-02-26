// order.models.ts - Order entity example

import { BaseEntity, BaseDTO } from '../../core/models/base.models';
import { ComputeConfig } from '../../core/models/compute.config';
import { ColumnConfig, TableConfig } from '../../core/models/table-config.models';

/**
 * Order Entity (stored in EntityStore)
 */
export interface OrderEntity extends BaseEntity {
  orderNo: string;
  customer: string;
  price: number;
  qty: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
  
  // Array fields
  arrayA: string[];
  arrayB: string[];
}

/**
 * Order DTO (exposed to table, with computed fields)
 */
export interface OrderDTO extends BaseDTO<OrderEntity> {
  // Computed fields
  total: number;      // price * qty
  tax: number;        // total * 0.1
  grandTotal: number; // total + tax

  test: string;
}

/**
 * Order compute configuration
 */
export const ORDER_COMPUTE: ComputeConfig<OrderEntity, OrderDTO> = {
  compute: (entity) => {
    const test = 'test';
    const total = entity.price * entity.qty;
    const tax = total * 0.1;
    const grandTotal = total + tax;
    
    return {
      ...entity,
      total,
      tax,
      grandTotal,
      test
    };
  }
};

/**
 * Order table configuration
 */
export function createOrderTableConfig(): TableConfig<OrderEntity> {
  const columns: ColumnConfig<OrderEntity>[] = [
    // Base columns
    {
      field: 'orderNo',
      header: 'Order No',
      type: 'base',
      rowspan: 2,
      width: '150px',
      sticky: true
    },
    {
      field: 'customer',
      header: 'Customer',
      type: 'base',
      rowspan: 2,
      width: '200px'
    },
    {
      field: 'price',
      header: 'Price',
      type: 'base',
      rowspan: 2,
      width: '120px',
      editable: true,
      editType: 'number',
      formatter: (value) => `$${(value || 0).toFixed(2)}`
    },
    {
      field: 'qty',
      header: 'Qty',
      type: 'base',
      rowspan: 2,
      width: '100px',
      editable: true,
      editType: 'number'
    },
    {
      field: 'status',
      header: 'Status',
      type: 'base',
      rowspan: 2,
      width: '150px',
      editable: true,
      editType: 'select',
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'shipped', label: 'Shipped' },
        { value: 'delivered', label: 'Delivered' }
      ]
    },
    // Computed columns
    {
      field: 'total',
      header: 'Total',
      type: 'computed',
      rowspan: 2,
      width: '120px',
      dependsOn: ['price', 'qty'],
      formatter: (value) => `$${(value || 0).toFixed(2)}`
    },
    {
      field: 'tax',
      header: 'Tax',
      type: 'computed',
      rowspan: 2,
      width: '120px',
      dependsOn: ['price', 'qty'],
      formatter: (value) => `$${(value || 0).toFixed(2)}`
    },
    {
      field: 'grandTotal',
      header: 'Grand Total',
      type: 'computed',
      rowspan: 2,
      width: '120px',
      dependsOn: ['price', 'qty'],
      formatter: (value) => `$${(value || 0).toFixed(2)}`
    },
    {
      field: 'test',
      header: 'Test',
      type: 'base',
      rowspan: 1,
      width: '120px',
      valueAccessor: (row) => row.expandedIndex === 0 ? row.data.test : '',
      formatter: (value) => value
    }
  ];

  // Array columns (48 columns: key-1 ~ key-48). Row picks array (row1=arrayA, row2=arrayB) via expandedRowArrayFields.
  for (let i = 0; i < 48; i++) {
    columns.push({
      field: `key-${i + 1}`,
      header: `K${i + 1}`,
      type: 'array',
      arrayField: 'arrayA', // overridden per row by expandedRowArrayFields
      arrayIndex: i,
      editable: true,
      editType: 'text',
      width: '100px'
    });
  }

  return {
    columns,
    rowsPerEntity: 2, // arrayA + arrayB
    expandedRowArrayFields: ['arrayA', 'arrayB'] as (keyof OrderEntity)[],
    pageSize: 10
  };
}

/**
 * Generate mock order data
 */
export function generateMockOrders(count: number): OrderDTO[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `order-${i + 1}`,
    orderNo: `ORD-${1000 + i}`,
    customer: `Customer ${Math.floor(i / 2) + 1}`,
    price: Math.round(Math.random() * 10000) / 100,
    qty: Math.floor(Math.random() * 50) + 1,
    status: (['pending', 'confirmed', 'shipped', 'delivered'] as const)[i % 4],
    arrayA: Array.from({ length: 48 }, (_, j) => `A${i + 1}-${j + 1}`),
    arrayB: Array.from({ length: 48 }, (_, j) => `B${i + 1}-${j + 1}`),

    test: 'test',
    total: 0,      // Will be computed
    tax: 0,        // Will be computed
    grandTotal: 0  // Will be computed
  }));
}
