package com.sivalabs.bookstore.inventory;

/** Öffentlich exponierter Inventar-Datensatz für MCP- und externe Konsumenten. */
public record InventoryItemView(String productCode, Long quantity) {}
