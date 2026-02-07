# 🌐 EXTERNAL CONTEXT IN VALIDATION

## Vấn Đề

Trong thực tế, validation thường cần access:
- ✅ **User role** (manager, admin, user)
- ✅ **Settings** từ component (budget limit, approval threshold)
- ✅ **UI state** (selected filters, date range)
- ✅ **Services** (check inventory, call API)
- ✅ **Other data** on screen (customer info, recent orders)

**Làm sao để validators có thể access những thứ này?**

---

## Giải Pháp: External Context

```typescript
interface ExternalContext {
  component?: any;  // Component instance
  [key: string]: any;  // ANY data you want!
}
```

Validators nhận `context.external` chứa **BẤT KỲ DỮ LIỆU NÀO** từ component!

---

## 🎯 Cách Sử Dụng

### Bước 1: Define Validator với External Context

```typescript
{
  field: 'price',
  validators: [
    Validators.custom(
      (value, context) => {
        // ✨ Access component data via context.external
        const userRole = context.external?.userRole;
        const price = Number(value);
        
        // Only managers can set high prices
        if (price > 10000 && userRole !== 'manager') {
          return false;
        }
        
        return true;
      },
      'Only managers can set price above $10,000'
    )
  ]
}
```

### Bước 2: Build External Context trong Component

```typescript
class MyComponent {
  // Component state
  userRole: 'user' | 'manager' = 'user';
  budgetLimit = 50000;
  selectedYear = 2025;
  
  // Build context
  private buildExternalContext(): ExternalContext {
    return {
      component: this,  // Whole component
      
      // Specific properties
      userRole: this.userRole,
      budgetLimit: this.budgetLimit,
      selectedYear: this.selectedYear,
      
      // Services
      inventoryService: this.inventoryService,
      
      // Any other data!
    };
  }
}
```

### Bước 3: Pass External Context khi Validate

```typescript
async onSave(entityId: string, entity: Entity) {
  // Build external context
  const external = this.buildExternalContext();
  
  // Validate with external context
  const result = await this.validationService.validateEntity(
    entityId,
    entity,
    'submit',
    allEntities,
    external  // 🔥 PASS IT HERE
  );
  
  if (!result.valid) {
    console.error('Validation failed');
    return;
  }
  
  // Save...
}
```

---

## 📚 Examples

### Example 1: User Role

```typescript
// Validator
Validators.custom(
  (value, context) => {
    const isManager = context.external?.userRole === 'manager';
    return isManager || value <= 1000;
  },
  'Only managers can exceed limit'
)

// Component
buildExternalContext() {
  return {
    userRole: this.authService.currentUser.role
  };
}
```

### Example 2: Budget Limit

```typescript
// Entity-level validator
{
  name: 'budgetCheck',
  validate: (entity, allEntities, external) => {
    const total = entity.price * entity.qty;
    const limit = external?.budgetLimit || 50000;
    
    if (total > limit) {
      return {
        valid: false,
        errors: [{
          message: `Exceeds budget: $${total} > $${limit}`,
          code: 'BUDGET_EXCEEDED',
          severity: 'error'
        }]
      };
    }
    
    return { valid: true };
  }
}

// Component
budgetLimit = 50000;

buildExternalContext() {
  return {
    budgetLimit: this.budgetLimit
  };
}

// When budget changes
onBudgetChange(newLimit: number) {
  this.budgetLimit = newLimit;
  this.revalidateAll();  // Re-validate with new limit
}
```

### Example 3: Selected Date Range

```typescript
// Validator
Validators.custom(
  (value, context) => {
    const selectedYear = context.external?.selectedYear;
    const orderNo = String(value);
    
    // Order number must match selected year
    const yearInOrder = orderNo.split('-')[1];
    return yearInOrder === String(selectedYear);
  },
  'Order must match selected year'
)

// Component
selectedYear = 2025;

buildExternalContext() {
  return {
    selectedYear: this.selectedYear
  };
}
```

### Example 4: Call Service (Async)

```typescript
// Async validator
Validators.async(
  async (value, context) => {
    const inventoryService = context.external?.inventoryService;
    
    if (!inventoryService) return true;
    
    // Call service to check stock
    const inStock = await inventoryService.checkStock(value);
    return inStock;
  },
  'Product out of stock',
  500
)

// Component
buildExternalContext() {
  return {
    inventoryService: this.inventoryService
  };
}
```

### Example 5: Customer Data

```typescript
// Validator
Validators.custom(
  (value, context) => {
    const customer = context.external?.selectedCustomer;
    
    if (customer?.isSuspended) {
      return false;
    }
    
    return true;
  },
  'Customer account is suspended'
)

// Component
selectedCustomer = {
  id: 'CUST-001',
  name: 'Acme Corp',
  isSuspended: false
};

buildExternalContext() {
  return {
    selectedCustomer: this.selectedCustomer
  };
}
```

### Example 6: Complex Business Rule

```typescript
// Entity validator
{
  name: 'approvalRequired',
  validate: (entity, allEntities, external) => {
    const total = entity.price * entity.qty;
    const threshold = external?.approvalThreshold || 5000;
    const isManager = external?.userRole === 'manager';
    const hasApproval = external?.hasApproval;
    
    // Large orders need approval
    if (total > threshold && !isManager && !hasApproval) {
      return {
        valid: false,
        errors: [{
          message: `Order requires manager approval (>${threshold})`,
          code: 'REQUIRES_APPROVAL',
          severity: 'error'
        }]
      };
    }
    
    return { valid: true };
  }
}

// Component
approvalThreshold = 5000;
userRole = 'user';
hasApproval = false;

buildExternalContext() {
  return {
    approvalThreshold: this.approvalThreshold,
    userRole: this.userRole,
    hasApproval: this.hasApproval
  };
}
```

---

## 🔄 Re-validation When External Data Changes

```typescript
class MyComponent {
  budgetLimit = 50000;
  
  // When budget changes
  onBudgetChange(newLimit: number) {
    this.budgetLimit = newLimit;
    
    // Re-validate all entities with new budget
    this.revalidateAll();
  }
  
  private async revalidateAll() {
    const external = this.buildExternalContext();
    
    for (const id of this.store.ids) {
      const entity = this.store.getOne(id);
      if (entity) {
        await this.validationService.validateEntity(
          id,
          entity,
          'change',
          undefined,
          external  // Use updated context
        );
      }
    }
  }
}
```

---

## 🎨 Advanced: Reactive External Context

```typescript
class MyComponent {
  // Observable external context
  private externalContext$ = new BehaviorSubject<ExternalContext>({});
  
  ngOnInit() {
    // Watch for changes
    combineLatest([
      this.userRole$,
      this.budgetLimit$,
      this.settings$
    ]).subscribe(([role, budget, settings]) => {
      // Update external context
      this.externalContext$.next({
        userRole: role,
        budgetLimit: budget,
        approvalThreshold: settings.approvalThreshold
      });
      
      // Re-validate
      this.revalidateAll();
    });
  }
  
  async validateField(id, entity, field, value) {
    const external = this.externalContext$.value;
    
    await this.validationService.validateField(
      id, entity, field, value, 'change',
      undefined,
      external
    );
  }
}
```

---

## 📊 What Can You Pass?

### ✅ Component State
```typescript
{
  selectedYear: this.selectedYear,
  currentTab: this.activeTab,
  filters: this.filters
}
```

### ✅ User Info
```typescript
{
  userRole: this.authService.currentUser.role,
  permissions: this.authService.permissions,
  userId: this.authService.currentUser.id
}
```

### ✅ Services
```typescript
{
  inventoryService: this.inventoryService,
  customerService: this.customerService,
  apiService: this.apiService
}
```

### ✅ Settings
```typescript
{
  budgetLimit: this.settings.budgetLimit,
  approvalThreshold: this.settings.approvalThreshold,
  businessHours: this.settings.businessHours
}
```

### ✅ Other Screen Data
```typescript
{
  selectedCustomer: this.selectedCustomer,
  recentOrders: this.recentOrders,
  activeCampaign: this.campaign
}
```

### ✅ UI Preferences
```typescript
{
  theme: this.theme,
  locale: this.locale,
  dateFormat: this.dateFormat
}
```

### ✅ Computed Properties
```typescript
{
  totalBudgetUsed: this.calculateTotalBudget(),
  remainingSlots: this.getRemainingSlots(),
  isWeekend: this.isWeekend()
}
```

### ✅ Even the Component Itself!
```typescript
{
  component: this  // Access ANY component method/property
}
```

---

## 🚀 Best Practices

### 1. Build Context Once
```typescript
// ✅ GOOD
const external = this.buildExternalContext();
await this.validateField(..., external);
await this.validateDependentFields(..., external);

// ❌ BAD (rebuilds multiple times)
await this.validateField(..., this.buildExternalContext());
await this.validateDependentFields(..., this.buildExternalContext());
```

### 2. Type External Context
```typescript
interface MyExternalContext extends ExternalContext {
  userRole: 'user' | 'manager';
  budgetLimit: number;
  selectedYear: number;
}

buildExternalContext(): MyExternalContext {
  return {
    userRole: this.userRole,
    budgetLimit: this.budgetLimit,
    selectedYear: this.selectedYear
  };
}
```

### 3. Document Dependencies
```typescript
{
  field: 'price',
  validators: [
    // Depends on: userRole (external)
    Validators.custom(...)
  ],
  dependsOnExternal: ['userRole']  // 🔥 Document it
}
```

### 4. Cache External Context
```typescript
private externalContextCache?: ExternalContext;

buildExternalContext(): ExternalContext {
  if (this.externalContextCache) {
    return this.externalContextCache;
  }
  
  this.externalContextCache = {
    userRole: this.userRole,
    // ...
  };
  
  return this.externalContextCache;
}

// Clear cache when data changes
onDataChange() {
  this.externalContextCache = undefined;
}
```

---

## 💡 Summary

| Feature | Supported |
|---------|-----------|
| Access component state | ✅ |
| Access services | ✅ |
| Access user info | ✅ |
| Access settings | ✅ |
| Access other screen data | ✅ |
| Call async APIs | ✅ |
| Type-safe | ✅ |
| Re-validate on change | ✅ |
| Pass component instance | ✅ |

**Validators can access ANYTHING from your component!** 🎉

---

## 📁 Files

```
core/models/
  validation.models.ts          # ExternalContext interface

features/orders/
  order.validation.external.ts  # Validation with external context
  order-table-with-external.component.ts  # Example usage
```

---

**Infinite Flexibility** ∞  
**Access Everything** 🌐  
**Type-Safe** 🛡️
