// order-table-with-external.component.ts - Example using external context

import { Component, OnInit } from '@angular/core';
import { EntityStore } from '../../core/services/entity.store';
import { ValidationService } from '../../core/services/validation.service';
import { ExternalContext } from '../../core/models/validation.models';
import { TableConfig } from '../../core/models/table-config.models';
import { OrderEntity, OrderDTO, ORDER_COMPUTE, createOrderTableConfig } from './order.models';
import { ORDER_VALIDATION_WITH_EXTERNAL } from './order.validation.external';

/**
 * EXAMPLE: Order table component with external context validation
 * 
 * Shows how to pass component state to validators
 */
@Component({
  selector: 'app-order-table-external',
  template: `
    <div class="controls">
      <!-- User can change these -->
      <select [(ngModel)]="selectedYear">
        <option value="2024">2024</option>
        <option value="2025">2025</option>
        <option value="2026">2026</option>
      </select>
      
      <input type="number" [(ngModel)]="currentBudgetLimit" placeholder="Budget Limit">
      
      <label>
        <input type="checkbox" [(ngModel)]="isManager">
        Manager Mode
      </label>
    </div>

    <app-generic-table
      [store]="orderStore"
      [config]="orderConfig"
      [saveUpdatesStore]="false"
      (save)="onSave($event)"
      (fieldEdit)="onFieldEdit($event.entityId, $event.entity, $event.field, $event.value)">
    </app-generic-table>
  `,
  providers: [
    {
      provide: ValidationService,
      useFactory: () => new ValidationService(ORDER_VALIDATION_WITH_EXTERNAL)
    }
  ]
})
export class OrderTableWithExternalComponent implements OnInit {
  
  // Entity store
  orderStore!: EntityStore<OrderEntity, OrderDTO>;
  orderConfig: TableConfig<OrderEntity>;
  
  // ===== EXTERNAL DATA (accessible in validators) =====
  
  // 1. User role (from auth service in real app)
  userRole: 'user' | 'manager' = 'user';
  isManager = false;
  
  // 2. Selected year (from UI control)
  selectedYear: number = 2025;
  
  // 3. Budget limit (from component state)
  currentBudgetLimit: number = 50000;
  
  // 4. Active campaign (from service in real app)
  activeCampaign = {
    name: 'Spring Sale',
    minQtyRequired: 10,
    discount: 0.15
  };
  
  // 5. Discount tiers (from config)
  discountTiers = [
    { minQty: 100, discount: 0.1 },
    { minQty: 500, discount: 0.15 },
    { minQty: 1000, discount: 0.2 }
  ];
  
  // 6. Approval threshold (from settings)
  approvalThreshold = 5000;
  
  // 7. Business hours
  businessHours = { start: 9, end: 17 };
  
  // 8. Selected customer data (from customer dropdown in real app)
  selectedCustomer = {
    id: 'CUST-001',
    name: 'Acme Corp',
    creditLimit: 100000,
    hasOverdueInvoices: false,
    isSuspended: false
  };
  
  // 9. Recent orders (from API in real app)
  recentOrders: any[] = [];
  
  // 10. Services (injected in real app)
  inventoryService = {
    checkStock: async (productCode: string) => {
      // Mock: simulate stock check
      await new Promise(resolve => setTimeout(resolve, 200));
      return !productCode.includes('OUT');
    }
  };
  
  // 11. UI settings
  theme: 'default' | 'minimal' | 'emoji' = 'emoji';
  locale = 'en';
  
  constructor(private validationService: ValidationService<OrderEntity>) {
    this.orderStore = new EntityStore<OrderEntity, OrderDTO>(ORDER_COMPUTE);
    this.orderConfig = createOrderTableConfig();
  }

  ngOnInit(): void {
    // Load mock data
    this.loadOrders();
    
    // Watch for changes that affect validation
    this.setupValidationWatchers();
  }

  /**
   * Load orders
   */
  private loadOrders(): void {
    // Mock data loading
    const orders: OrderDTO[] = [
      {
        id: 'order-1',
        orderNo: 'ORD-2025-0001',
        customer: 'Acme Corp',
        price: 100,
        qty: 10,
        status: 'pending',
        arrayA: Array(48).fill('A'),
        arrayB: Array(48).fill('B'),
        total: 0,
        tax: 0,
        grandTotal: 0
      }
    ];
    
    this.orderStore.setAll(orders);
  }

  /**
   * Setup watchers for external data changes
   */
  private setupValidationWatchers(): void {
    // In real app, use RxJS to watch for changes
    // When external data changes, re-validate affected fields
    
    // Example: when user role changes
    // this.userRoleChange$.subscribe(() => {
    //   this.revalidateAllEntities();
    // });
  }

  /**
   * Handle save - pass external context
   */
  async onSave(event: any): Promise<void> {
    const entity = this.orderStore.getOne(event.id);
    if (!entity) return;

    // Validate the entity as it will be after save (store + pending changes)
    const entityWithChanges = { ...entity, ...event.changes } as OrderEntity;

    const external = this.buildExternalContext();

    const result = await this.validationService.validateEntity(
      event.id,
      entityWithChanges,
      'submit',
      undefined,
      external
    );

    if (!result.valid) {
      const errors = this.validationService.getAllErrors(event.id);
      console.error('Validation failed:', errors);
      alert('Validation failed. Check console for details.');
      return;
    }

    // Apply changes
    if (Object.keys(event.changes).length > 0) {
      this.orderStore.updateOne(event.id, event.changes);
    }

    console.log('✓ Order saved successfully');
  }

  /**
   * Handle field edit - pass external context
   */
  async onFieldEdit(
    entityId: string,
    entity: OrderEntity,
    field: keyof OrderEntity,
    value: any
  ): Promise<void> {
    const external = this.buildExternalContext();

    // Validate the edited field (value is the new value)
    await this.validationService.validateField(
      entityId,
      entity,
      field,
      value,
      'change',
      undefined,
      external
    );

    // Validate dependent fields using entity state WITH this edit applied
    const entityWithEdit = { ...entity, [field]: value } as OrderEntity;
    await this.validationService.validateDependentFields(
      entityId,
      entityWithEdit,
      field,
      undefined,
      external
    );
  }

  /**
   * Build external context from component state
   * 
   * 🔥 THIS IS THE KEY FUNCTION
   * 
   * Pass ANY component data to validators!
   */
  private buildExternalContext(): ExternalContext {
    return {
      // Component instance (access anything!)
      component: this,
      
      // User data
      userRole: this.isManager ? 'manager' : 'user',
      currentUser: {
        role: this.isManager ? 'manager' : 'user',
        isManager: this.isManager
      },
      
      // UI state
      selectedYear: this.selectedYear,
      currentBudgetLimit: this.currentBudgetLimit,
      
      // Campaign data
      activeCampaign: this.activeCampaign,
      discountTiers: this.discountTiers,
      
      // Settings
      approvalThreshold: this.approvalThreshold,
      businessHours: this.businessHours,
      
      // Services
      inventoryService: this.inventoryService,
      
      // Customer data
      selectedCustomerData: this.selectedCustomer,
      
      // Recent data
      recentOrdersFromServer: this.recentOrders,
      
      // UI preferences
      theme: this.theme,
      locale: this.locale,
      
      // Current time
      currentTime: new Date(),
      
      // ✨ You can add ANYTHING from your component here!
      // - Services
      // - Observables
      // - Configuration
      // - User preferences
      // - API responses
      // - Computed properties
      // - Etc.
    };
  }

  /**
   * Re-validate all entities when external data changes
   */
  private async revalidateAllEntities(): Promise<void> {
    const external = this.buildExternalContext();
    
    for (const id of this.orderStore.ids) {
      const entity = this.orderStore.getOne(id);
      if (entity) {
        await this.validationService.validateEntity(
          id,
          entity as any,
          'change',
          undefined,
          external
        );
      }
    }
  }

  /**
   * Example: Change budget limit (triggers re-validation)
   */
  onBudgetLimitChange(newLimit: number): void {
    this.currentBudgetLimit = newLimit;
    
    // Re-validate all entities with new budget
    this.revalidateAllEntities();
  }

  /**
   * Example: Change user role (triggers re-validation)
   */
  onUserRoleChange(isManager: boolean): void {
    this.isManager = isManager;
    this.userRole = isManager ? 'manager' : 'user';
    
    // Re-validate all entities with new role
    this.revalidateAllEntities();
  }
}
