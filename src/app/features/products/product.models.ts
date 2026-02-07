// product.models.ts - Product entity example (DIFFERENT structure)

import { BaseEntity, BaseDTO } from '../../core/models/base.models';
import { ComputeConfig } from '../../core/models/compute.config';
import { ColumnConfig, TableConfig } from '../../core/models/table-config.models';

/**
 * Product Entity (stored in EntityStore)
 */
export interface ProductEntity extends BaseEntity {
  sku: string;
  name: string;
  category: string;
  cost: number;
  markup: number;  // percentage
  inStock: boolean;
  
  // Different array structure
  specifications: string[];
  features: string[];
}

/**
 * Product DTO (with computed fields)
 */
export interface ProductDTO extends BaseDTO<ProductEntity> {
  // Computed fields
  price: number;        // cost * (1 + markup/100)
  profit: number;       // price - cost
  marginPercent: number; // (profit / price) * 100
}

/**
 * Product compute configuration
 */
export const PRODUCT_COMPUTE: ComputeConfig<ProductEntity, ProductDTO> = {
  compute: (entity) => {
    const price = entity.cost * (1 + entity.markup / 100);
    const profit = price - entity.cost;
    const marginPercent = (profit / price) * 100;
    
    return {
      ...entity,
      price,
      profit,
      marginPercent
    };
  }
};

/**
 * Product table configuration
 */
export function createProductTableConfig(): TableConfig<ProductEntity> {
  const columns: ColumnConfig<ProductEntity>[] = [
    // Base columns
    {
      field: 'sku',
      header: 'SKU',
      type: 'base',
      rowspan: 2,
      width: '120px',
      sticky: true
    },
    {
      field: 'name',
      header: 'Product Name',
      type: 'base',
      rowspan: 2,
      width: '250px',
      editable: true,
      editType: 'text'
    },
    {
      field: 'category',
      header: 'Category',
      type: 'base',
      rowspan: 2,
      width: '150px',
      editable: true,
      editType: 'select',
      options: [
        { value: 'electronics', label: 'Electronics' },
        { value: 'clothing', label: 'Clothing' },
        { value: 'food', label: 'Food' },
        { value: 'books', label: 'Books' }
      ]
    },
    {
      field: 'cost',
      header: 'Cost',
      type: 'base',
      rowspan: 2,
      width: '120px',
      editable: true,
      editType: 'number',
      formatter: (value) => `$${(value || 0).toFixed(2)}`
    },
    {
      field: 'markup',
      header: 'Markup %',
      type: 'base',
      rowspan: 2,
      width: '100px',
      editable: true,
      editType: 'number',
      formatter: (value) => `${(value || 0).toFixed(1)}%`
    },
    {
      field: 'inStock',
      header: 'In Stock',
      type: 'base',
      rowspan: 2,
      width: '100px',
      editable: true,
      editType: 'checkbox',
      formatter: (value) => value ? '✓' : '✗'
    },
    // Computed columns
    {
      field: 'price',
      header: 'Sell Price',
      type: 'computed',
      rowspan: 2,
      width: '120px',
      dependsOn: ['cost', 'markup'],
      formatter: (value) => `$${(value || 0).toFixed(2)}`
    },
    {
      field: 'profit',
      header: 'Profit',
      type: 'computed',
      rowspan: 2,
      width: '120px',
      dependsOn: ['cost', 'markup'],
      formatter: (value) => `$${(value || 0).toFixed(2)}`
    },
    {
      field: 'marginPercent',
      header: 'Margin %',
      type: 'computed',
      rowspan: 2,
      width: '100px',
      dependsOn: ['cost', 'markup'],
      formatter: (value) => `${(value || 0).toFixed(1)}%`
    }
  ];

  // Array columns (32 columns for specifications/features)
  for (let i = 0; i < 32; i++) {
    const arrayField: 'specifications' | 'features' = i % 2 === 0 ? 'specifications' : 'features';
    
    columns.push({
      field: `spec-${i + 1}`,
      header: i % 2 === 0 ? `S${Math.floor(i/2) + 1}` : `F${Math.floor(i/2) + 1}`,
      type: 'array',
      arrayField,
      arrayIndex: i,
      editable: true,
      editType: 'text',
      width: '150px'
    });
  }

  return {
    columns,
    rowsPerEntity: 2, // specifications + features
    pageSize: 20
  };
}

/**
 * Generate mock product data
 */
export function generateMockProducts(count: number): ProductDTO[] {
  const categories = ['electronics', 'clothing', 'food', 'books'] as const;
  
  return Array.from({ length: count }, (_, i) => ({
    id: `product-${i + 1}`,
    sku: `SKU-${String(i + 1).padStart(5, '0')}`,
    name: `Product ${i + 1}`,
    category: categories[i % 4],
    cost: Math.round(Math.random() * 5000) / 100,
    markup: Math.round(Math.random() * 100),
    inStock: Math.random() > 0.3,
    specifications: Array.from({ length: 32 }, (_, j) => `Spec${i + 1}-${j + 1}`),
    features: Array.from({ length: 32 }, (_, j) => `Feature${i + 1}-${j + 1}`),
    price: 0,          // Will be computed
    profit: 0,         // Will be computed
    marginPercent: 0   // Will be computed
  }));
}
