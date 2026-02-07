// app.component.ts - Demo both tables using SAME generic component

import { Component, OnInit } from '@angular/core';
import { EntityStore } from './core/services/entity.store';

// Order imports
import {
  OrderEntity,
  OrderDTO,
  ORDER_COMPUTE,
  createOrderTableConfig,
  generateMockOrders
} from './features/orders/order.models';

// Product imports
import {
  ProductEntity,
  ProductDTO,
  PRODUCT_COMPUTE,
  createProductTableConfig,
  generateMockProducts
} from './features/products/product.models';

import { TableConfig } from './core/models/table-config.models';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Generic Table - Multiple Entities Demo';
  
  // Order table setup
  orderStore!: EntityStore<OrderEntity, OrderDTO>;
  orderConfig!: TableConfig<OrderEntity>;
  
  // Product table setup
  productStore!: EntityStore<ProductEntity, ProductDTO>;
  productConfig!: TableConfig<ProductEntity>;
  
  // Current view
  currentView: 'orders' | 'products' = 'orders';

  constructor() {
    // Initialize Order store
    this.orderStore = new EntityStore<OrderEntity, OrderDTO>(ORDER_COMPUTE);
    this.orderConfig = createOrderTableConfig();
    
    // Initialize Product store
    this.productStore = new EntityStore<ProductEntity, ProductDTO>(PRODUCT_COMPUTE);
    this.productConfig = createProductTableConfig();
  }

  ngOnInit(): void {
    // Load mock data
    this.loadOrders();
    this.loadProducts();
  }

  /**
   * Load order data
   */
  private loadOrders(): void {
    const mockOrders = generateMockOrders(50);
    this.orderStore.setAll(mockOrders);
    console.log('✓ Loaded 50 orders');
  }

  /**
   * Load product data
   */
  private loadProducts(): void {
    const mockProducts = generateMockProducts(100);
    this.productStore.setAll(mockProducts);
    console.log('✓ Loaded 100 products');
  }

  /**
   * Switch view
   */
  switchView(view: 'orders' | 'products'): void {
    this.currentView = view;
  }

  /**
   * Handle order save
   */
  onOrderSave(event: any): void {
    console.log('Order saved:', event);
    // Here you would call your backend API
    // this.orderService.update(event.id, event.changes).subscribe();
  }

  /**
   * Handle product save
   */
  onProductSave(event: any): void {
    console.log('Product saved:', event);
    // Here you would call your backend API
    // this.productService.update(event.id, event.changes).subscribe();
  }

  /**
   * Handle row click
   */
  onRowClick(event: any): void {
    console.log('Row clicked:', event);
  }
}
