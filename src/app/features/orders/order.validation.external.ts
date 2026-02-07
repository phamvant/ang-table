// order.validation.external.ts - Examples using external context

import { ValidationConfig } from '../../core/models/validation.models';
import { Validators } from '../../core/services/validators.library';
import { OrderEntity } from './order.models';

/**
 * ORDER VALIDATION WITH EXTERNAL CONTEXT
 * 
 * Demonstrates how to use component state, services, and other screen data
 */
export const ORDER_VALIDATION_WITH_EXTERNAL: ValidationConfig<OrderEntity> = {
  
  fields: [
    
    // Example 1: Use user role from component
    {
      field: 'price',
      validators: [
        Validators.required(),
        
        // Only managers can set price > $10,000
        Validators.custom(
          (value, context) => {
            const userRole = context.external?.userRole;  // From component
            const price = Number(value);
            
            if (price > 10000 && userRole !== 'manager') {
              return false;
            }
            return true;
          },
          'Only managers can set price above $10,000',
          'MANAGER_ONLY_PRICE'
        )
      ]
    },

    // Example 2: Use selected date range from component
    {
      field: 'orderNo',
      validators: [
        Validators.required(),
        
        // Order number must match selected period
        Validators.custom(
          (value, context) => {
            const selectedYear = context.external?.selectedYear;  // From datepicker
            const orderNo = String(value);
            
            if (selectedYear) {
              // Order number format: ORD-YYYY-XXXX
              const yearInOrder = orderNo.split('-')[1];
              return yearInOrder === String(selectedYear);
            }
            
            return true;
          },
          'Order number must match selected year',
          'YEAR_MISMATCH'
        )
      ]
    },

    // Example 3: Use discount settings from component
    {
      field: 'qty',
      validators: [
        Validators.required(),
        
        // Min qty based on current discount campaign
        Validators.custom(
          (value, context) => {
            const activeCampaign = context.external?.activeCampaign;  // From service
            const qty = Number(value);
            
            if (activeCampaign?.minQtyRequired) {
              return qty >= activeCampaign.minQtyRequired;
            }
            
            return true;
          },
          'Minimum quantity not met for active campaign',
          'CAMPAIGN_MIN_QTY'
        ),
        
        // Info: show available discount
        Validators.info(
          (value, context) => {
            const qty = Number(value);
            const discountTiers = context.external?.discountTiers || [];  // From component
            
            const applicable = discountTiers.find(tier => qty >= tier.minQty);
            
            return !!applicable;
          },
          '' // Will be customized dynamically
        )
      ]
    },

    // Example 4: Use customer data from selected customer
    {
      field: 'customer',
      validators: [
        Validators.required(),
        
        // Check customer credit limit
        Validators.custom(
          (value, context) => {
            const selectedCustomer = context.external?.selectedCustomerData;
            
            if (selectedCustomer?.isSuspended) {
              return false;
            }
            
            return true;
          },
          'Customer account is suspended',
          'CUSTOMER_SUSPENDED'
        ),
        
        // Warning: customer has overdue invoices
        Validators.warning(
          (value, context) => {
            const selectedCustomer = context.external?.selectedCustomerData;
            return !selectedCustomer?.hasOverdueInvoices;
          },
          'Customer has overdue invoices'
        )
      ]
    },

    // Example 5: Use current inventory from service
    {
      field: 'arrayA',
      validators: [
        // Check stock availability for each product
        Validators.async(
          async (value, context) => {
            const inventoryService = context.external?.inventoryService;

            if (!inventoryService) return true;

            // Per-cell: value is single string; whole-array: value is string[]
            const products = Array.isArray(value) ? value : [value];

            for (const productCode of products) {
              const inStock = await inventoryService.checkStock(productCode);
              if (!inStock) {
                return false;
              }
            }
            
            return true;
          },
          'Some products are out of stock',
          500 // debounce
        )
      ]
    }
  ],

  // Entity-level with external context
  entityRules: [
    
    // Example 6: Use budget limit from component settings
    {
      name: 'budgetLimit',
      trigger: 'submit',
      validate: (entity, allEntities, external) => {
        const total = entity.price * entity.qty;
        const budgetLimit = external?.currentBudgetLimit;  // From component
        
        if (budgetLimit && total > budgetLimit) {
          return {
            valid: false,
            errors: [{
              field: '',
              message: `Order total ($${total}) exceeds budget limit ($${budgetLimit})`,
              code: 'BUDGET_EXCEEDED',
              severity: 'error',
              metadata: { total, limit: budgetLimit }
            }]
          };
        }
        
        return { valid: true };
      }
    },

    // Example 7: Use approval workflow settings
    {
      name: 'requiresApproval',
      trigger: 'submit',
      validate: (entity, allEntities, external) => {
        const total = entity.price * entity.qty;
        const approvalThreshold = external?.approvalThreshold || 5000;  // From settings
        const currentUser = external?.currentUser;  // From auth service
        
        if (total > approvalThreshold && !currentUser?.isManager) {
          return {
            valid: true,  // Warning only
            errors: [{
              field: '',
              message: `Order requires manager approval (>${approvalThreshold})`,
              code: 'REQUIRES_APPROVAL',
              severity: 'warning',
              metadata: { 
                total, 
                threshold: approvalThreshold,
                requiresManager: true 
              }
            }]
          };
        }
        
        return { valid: true };
      }
    },

    // Example 8: Use working hours from component
    {
      name: 'workingHours',
      trigger: 'submit',
      validate: (entity, allEntities, external) => {
        const currentTime = external?.currentTime || new Date();
        const businessHours = external?.businessHours || { start: 9, end: 17 };
        
        const hour = currentTime.getHours();
        
        if (hour < businessHours.start || hour >= businessHours.end) {
          return {
            valid: true,
            errors: [{
              field: '',
              message: `Orders outside business hours require next-day processing`,
              code: 'AFTER_HOURS',
              severity: 'info'
            }]
          };
        }
        
        return { valid: true };
      }
    },

    // Example 9: Cross-reference with other screen data
    {
      name: 'duplicateCheck',
      trigger: 'submit',
      async: true,
      validate: async (entity, allEntities, external) => {
        const recentOrders = external?.recentOrdersFromServer;  // From API call
        
        if (!recentOrders) return { valid: true };
        
        // Check if similar order was placed in last 5 minutes
        const similar = recentOrders.find(order => 
          order.customer === entity.customer &&
          order.price === entity.price &&
          Math.abs(order.timestamp - Date.now()) < 5 * 60 * 1000
        );
        
        if (similar) {
          return {
            valid: true,
            errors: [{
              field: '',
              message: `Similar order was placed ${Math.floor((Date.now() - similar.timestamp) / 1000)}s ago`,
              code: 'RECENT_DUPLICATE',
              severity: 'warning'
            }]
          };
        }
        
        return { valid: true };
      }
    }
  ],

  options: {
    // Custom formatter using external data
    errorFormatter: (error, external) => {
      const theme = external?.theme || 'default';
      const locale = external?.locale || 'en';
      
      const icons = {
        default: { error: '❌', warning: '⚠️', info: 'ℹ️' },
        minimal: { error: '!', warning: '!', info: 'i' },
        emoji: { error: '🚫', warning: '⚡', info: '💡' }
      };
      
      const icon = icons[theme]?.[error.severity] || icons.default[error.severity];
      
      // Could also translate message based on locale
      return `${icon} ${error.message}`;
    }
  }
};

/**
 * Helper: Create external context from component
 */
export function createExternalContext(component: any) {
  return {
    // Component instance
    component,
    
    // User data
    userRole: component.authService?.currentUser?.role,
    currentUser: component.authService?.currentUser,
    
    // Settings
    selectedYear: component.selectedYear,
    activeCampaign: component.campaignService?.getActive(),
    discountTiers: component.discountTiers,
    approvalThreshold: component.settings?.approvalThreshold,
    budgetLimit: component.currentBudgetLimit,
    businessHours: component.businessHours,
    
    // Services
    inventoryService: component.inventoryService,
    
    // UI state
    theme: component.theme,
    locale: component.locale,
    
    // Data from other sources
    selectedCustomerData: component.selectedCustomer,
    recentOrdersFromServer: component.recentOrders,
    currentTime: new Date(),
    
    // Any other component properties...
  };
}
