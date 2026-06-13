package com.sivalabs.bookstore.inventory;

/**
 * Öffentliches View-DTO für Lagerbestands-Informationen.
 *
 * <p>Wird von {@link InventoryApi} an andere Module (z.B. MCP-Layer) zurückgegeben.
 * Liegt im öffentlichen {@code inventory}-Package gemäß Spring Modulith Modul-Grenz-Konvention.
 *
 * @param productCode Eindeutiger Produktcode
 * @param quantity    Aktueller Lagerbestand (0 wenn nicht erfasst)
 */
public record InventoryStockView(String productCode, Long quantity) {}
