package com.sivalabs.bookstore.inventory;

/**
 * Öffentliches DTO des Inventory-Moduls — exponiert via InventoryApi für Cross-Module-Zugriff.
 */
public record InventoryItemView(String productCode, Long quantity) {}
