package com.sivalabs.bookstore.inventory;

/** Public DTO representing an inventory item — exposed through InventoryApi. */
public record InventoryItemView(String productCode, Long quantity) {}
