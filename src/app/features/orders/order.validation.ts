// order.validation.ts - Order validation configuration example

import { ValidationConfig, EntityValidationRules } from '../../core/models/validation.models';
import { Validators } from '../../core/services/validators.library';
import { OrderEntity } from './order.models';

/**
 * Order validation configuration
 * Demonstrates all types of validation
 */
export const ORDER_VALIDATION: ValidationConfig<OrderEntity> = {
  
  // Field-level validations
  fields: [
    
    // Order Number validation
    {
      field: 'orderNo',
      validators: [
        Validators.required('Order number is required'),
        Validators.pattern(/^ORD-\d{4,}$/, 'Order number must be in format ORD-XXXX'),
        Validators.unique(undefined, 'Order number must be unique'),
        
        // Async: check if order exists in backend
        Validators.async(
          async (value) => {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500));
            // Mock: order numbers ending with '0000' are taken
            return !String(value).endsWith('0000');
          },
          'Order number already exists in system',
          300 // debounce 300ms
        )
      ]
    },

    // Customer validation
    {
      field: 'customer',
      validators: [
        Validators.required('Customer name is required'),
        Validators.minLength(3, 'Customer name must be at least 3 characters'),
        Validators.maxLength(100, 'Customer name too long'),
        
        // Warning if customer name is all caps
        Validators.warning(
          (value) => {
            const str = String(value);
            return str !== str.toUpperCase();
          },
          'Customer name is in all caps - is this correct?'
        )
      ]
    },

    // Price validation
    {
      field: 'price',
      validators: [
        Validators.required('Price is required'),
        Validators.min(0.01, 'Price must be greater than 0'),
        Validators.max(999999.99, 'Price cannot exceed $999,999.99'),
        
        // Warning for unusually high prices
        Validators.warning(
          (value) => Number(value) < 10000,
          'Price is unusually high - please verify'
        ),
        
        // Info: show price tier
        Validators.info(
          (value) => {
            const price = Number(value);
            return price > 0;
          },
          'Price tier: ' // Will be customized below
        )
      ],
      stopOnFirstError: true
    },

    // Quantity validation
    {
      field: 'qty',
      validators: [
        Validators.required('Quantity is required'),
        Validators.min(1, 'Quantity must be at least 1'),
        Validators.max(9999, 'Quantity cannot exceed 9999'),
        
        // Custom: quantity must be multiple of 10 for bulk orders
        Validators.custom(
          (value, context) => {
            const price = context.entity.price;
            const qty = Number(value);
            
            // If total > $10,000, qty must be multiple of 10
            if (price * qty > 10000) {
              return qty % 10 === 0;
            }
            return true;
          },
          'Bulk orders (>$10k) must have quantity in multiples of 10',
          'BULK_ORDER_QTY'
        )
      ]
    },

    // Status validation
    {
      field: 'status',
      validators: [
        Validators.required('Status is required'),
        
        // Conditional: can only ship if qty > 0
        Validators.when(
          (context) => context.value === 'shipped',
          Validators.custom(
            (value, context) => context.entity.qty > 0,
            'Cannot ship order with 0 quantity',
            'SHIP_ZERO_QTY'
          )
        ),
        
        // Warning: delivered status needs confirmation
        Validators.warning(
          (value) => value !== 'delivered',
          'Delivered status is final - cannot be changed later'
        )
      ]
    },

    // Array validation example
    {
      field: 'arrayA',
      validators: [
        Validators.custom(
          (value) => Array.isArray(value) && value.length === 48,
          'arrayA must have exactly 48 items',
          'ARRAY_LENGTH'
        )
      ]
    }
  ],

  // Entity-level validations (cross-field)
  entityRules: [
    
    // Total amount validation
    {
      name: 'totalAmount',
      trigger: 'change',
      validate: (entity) => {
        const total = entity.price * entity.qty;
        
        // Max total: $100,000
        if (total > 100000) {
          return {
            valid: false,
            errors: [{
              field: '',
              message: `Total amount ($${total.toFixed(2)}) exceeds maximum allowed ($100,000)`,
              code: 'MAX_TOTAL',
              severity: 'error'
            }]
          };
        }

        // Warning for large orders
        if (total > 50000) {
          return {
            valid: true,
            errors: [{
              field: '',
              message: `Large order: $${total.toFixed(2)} - manager approval required`,
              code: 'LARGE_ORDER',
              severity: 'warning'
            }]
          };
        }

        return { valid: true };
      }
    },

    // Business rule: pending orders cannot have high value
    {
      name: 'pendingOrderLimit',
      trigger: 'submit',
      validate: (entity) => {
        if (entity.status === 'pending') {
          const total = entity.price * entity.qty;
          
          if (total > 5000) {
            return {
              valid: false,
              errors: [{
                field: '',
                message: 'Pending orders cannot exceed $5,000. Please confirm order first.',
                code: 'PENDING_LIMIT',
                severity: 'error'
              }]
            };
          }
        }
        
        return { valid: true };
      }
    },

    // Duplicate detection across all entities
    {
      name: 'duplicateDetection',
      trigger: 'submit',
      async: true,
      validate: async (entity, allEntities) => {
        if (!allEntities) return { valid: true };

        // Find similar orders (same customer, similar price)
        const similar = allEntities.filter(other => 
          other.id !== entity.id &&
          other.customer === entity.customer &&
          Math.abs(other.price - entity.price) < 0.01 &&
          other.qty === entity.qty
        );

        if (similar.length > 0) {
          return {
            valid: true, // Warning only
            errors: [{
              field: '',
              message: `Warning: ${similar.length} similar order(s) found for this customer`,
              code: 'DUPLICATE_WARNING',
              severity: 'warning',
              metadata: { similarOrders: similar.map(o => o.orderNo) }
            }]
          };
        }

        return { valid: true };
      }
    }
  ],

  // Global options
  options: {
    stopOnFirstFieldError: false,
    warningsAsErrors: false,
    
    // Custom error formatter
    errorFormatter: (error) => {
      const prefix = {
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
      }[error.severity];
      
      return `${prefix} ${error.message}`;
    }
  }
};

/**
 * Helper: Create validation service for orders
 */
export function createOrderValidationService() {
  // This will be injected in the component
  return ORDER_VALIDATION;
}
