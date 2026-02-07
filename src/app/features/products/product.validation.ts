// product.validation.ts - Product validation configuration (DIFFERENT from Order)

import { ValidationConfig } from '../../core/models/validation.models';
import { Validators } from '../../core/services/validators.library';
import { ProductEntity } from './product.models';

/**
 * Product validation configuration
 * Completely different rules than Order
 */
export const PRODUCT_VALIDATION: ValidationConfig<ProductEntity> = {
  
  fields: [
    
    // SKU validation
    {
      field: 'sku',
      validators: [
        Validators.required('SKU is required'),
        Validators.pattern(
          /^SKU-\d{5}$/,
          'SKU must be in format SKU-XXXXX (5 digits)'
        ),
        Validators.unique(undefined, 'SKU must be unique'),
        
        // Warning: check digit validation
        Validators.warning(
          (value) => {
            const sku = String(value);
            const digits = sku.replace(/\D/g, '');
            if (digits.length !== 5) return true;
            
            // Simple check digit: last digit = sum of first 4 digits % 10
            const sum = Array.from(digits.slice(0, 4))
              .reduce((acc, d) => acc + parseInt(d), 0);
            return parseInt(digits[4]) === sum % 10;
          },
          'SKU check digit mismatch - please verify'
        )
      ]
    },

    // Product name validation
    {
      field: 'name',
      validators: [
        Validators.required('Product name is required'),
        Validators.minLength(5, 'Product name too short'),
        Validators.maxLength(200, 'Product name too long'),
        
        // Custom: must contain category keyword
        Validators.custom(
          (value, context) => {
            const name = String(value).toLowerCase();
            const category = context.entity.category;
            
            // Electronics must mention 'phone', 'laptop', etc.
            if (category === 'electronics') {
              const keywords = ['phone', 'laptop', 'tablet', 'computer', 'device'];
              return keywords.some(kw => name.includes(kw));
            }
            
            return true;
          },
          'Electronics products should mention device type in name',
          'CATEGORY_KEYWORD'
        )
      ]
    },

    // Category validation
    {
      field: 'category',
      validators: [
        Validators.required('Category is required')
      ]
    },

    // Cost validation
    {
      field: 'cost',
      validators: [
        Validators.required('Cost is required'),
        Validators.min(0.01, 'Cost must be positive'),
        
        // Custom: cost cannot exceed $50,000 for non-electronics
        Validators.custom(
          (value, context) => {
            const cost = Number(value);
            if (context.entity.category !== 'electronics') {
              return cost <= 50000;
            }
            return true;
          },
          'Non-electronics cost cannot exceed $50,000',
          'COST_LIMIT'
        )
      ]
    },

    // Markup validation
    {
      field: 'markup',
      validators: [
        Validators.required('Markup is required'),
        Validators.range(0, 1000, 'Markup must be between 0% and 1000%'),
        
        // Warning: low margin
        Validators.warning(
          (value, context) => {
            const markup = Number(value);
            const category = context.entity.category;
            
            // Electronics should have at least 20% markup
            if (category === 'electronics') {
              return markup >= 20;
            }
            
            // Others should have at least 30%
            return markup >= 30;
          },
          'Markup is below recommended minimum for this category'
        ),
        
        // Warning: very high margin (possible error)
        Validators.warning(
          (value) => Number(value) < 500,
          'Markup over 500% - is this correct?'
        ),
        
        // Info: show margin tier
        Validators.info(
          (value) => true,
          // Message will be customized in UI
          'Margin tier'
        )
      ]
    },

    // In stock validation
    {
      field: 'inStock',
      validators: [
        // Warning if marking as out of stock
        Validators.warning(
          (value) => value === true,
          'Marking product as out of stock - ensure inventory is updated'
        )
      ]
    },

    // Specifications array validation
    {
      field: 'specifications',
      validators: [
        Validators.custom(
          (value) => Array.isArray(value) && value.length === 32,
          'specifications must have exactly 32 items',
          'SPEC_LENGTH'
        ),
        
        // Custom: electronics must have technical specs filled
        Validators.custom(
          (value, context) => {
            if (context.entity.category === 'electronics') {
              const specs = value as string[];
              const filled = specs.filter(s => s && s.trim().length > 0);
              return filled.length >= 10;
            }
            return true;
          },
          'Electronics must have at least 10 specifications filled',
          'MIN_SPECS'
        )
      ]
    }
  ],

  // Entity-level validations
  entityRules: [
    
    // Profit margin validation
    {
      name: 'profitMargin',
      trigger: 'change',
      validate: (entity) => {
        const price = entity.cost * (1 + entity.markup / 100);
        const profit = price - entity.cost;
        const marginPercent = (profit / price) * 100;
        
        // Margin must be at least 10%
        if (marginPercent < 10) {
          return {
            valid: false,
            errors: [{
              field: '',
              message: `Profit margin (${marginPercent.toFixed(1)}%) is below minimum 10%`,
              code: 'LOW_MARGIN',
              severity: 'error'
            }]
          };
        }

        return { valid: true };
      }
    },

    // Category-specific rules
    {
      name: 'categoryRules',
      trigger: 'submit',
      validate: (entity) => {
        const errors = [];

        // Electronics: cost must be at least $10
        if (entity.category === 'electronics' && entity.cost < 10) {
          errors.push({
            field: '',
            message: 'Electronics must have minimum cost of $10',
            code: 'ELECTRONICS_MIN_COST',
            severity: 'error' as const
          });
        }

        // Food: must be in stock
        if (entity.category === 'food' && !entity.inStock) {
          errors.push({
            field: '',
            message: 'Food products should always be in stock (perishable)',
            code: 'FOOD_STOCK',
            severity: 'warning' as const
          });
        }

        return {
          valid: errors.filter(e => e.severity === 'error').length === 0,
          errors
        };
      }
    },

    // Price competitiveness check (cross-entity)
    {
      name: 'priceCompetitiveness',
      trigger: 'submit',
      async: true,
      validate: async (entity, allEntities) => {
        if (!allEntities) return { valid: true };

        const price = entity.cost * (1 + entity.markup / 100);
        
        // Find similar products (same category)
        const similar = allEntities.filter(p => 
          p.id !== entity.id &&
          p.category === entity.category
        );

        if (similar.length === 0) return { valid: true };

        // Calculate average price in category
        const avgPrice = similar.reduce((sum, p) => {
          const pPrice = p.cost * (1 + p.markup / 100);
          return sum + pPrice;
        }, 0) / similar.length;

        // Warning if price is 50% higher than average
        if (price > avgPrice * 1.5) {
          return {
            valid: true,
            errors: [{
              field: '',
              message: `Price ($${price.toFixed(2)}) is 50% above category average ($${avgPrice.toFixed(2)})`,
              code: 'HIGH_PRICE',
              severity: 'warning',
              metadata: { avgPrice, productPrice: price }
            }]
          };
        }

        // Info if price is competitive
        if (price < avgPrice * 0.9) {
          return {
            valid: true,
            errors: [{
              field: '',
              message: `Competitive pricing: 10% below category average`,
              code: 'COMPETITIVE_PRICE',
              severity: 'info'
            }]
          };
        }

        return { valid: true };
      }
    }
  ],

  options: {
    stopOnFirstFieldError: false,
    warningsAsErrors: false,
    
    errorFormatter: (error) => {
      const icons = {
        'error': '🚫',
        'warning': '⚠️',
        'info': 'ℹ️'
      };
      
      return `${icons[error.severity]} ${error.message}`;
    }
  }
};
