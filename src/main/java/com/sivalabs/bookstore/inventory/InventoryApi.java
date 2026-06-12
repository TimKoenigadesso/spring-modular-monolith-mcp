package com.sivalabs.bookstore.inventory;

import com.sivalabs.bookstore.common.models.PagedResult;
import com.sivalabs.bookstore.inventory.domain.InventoryService;
import com.sivalabs.bookstore.inventory.domain.InventoryView;
import org.springframework.stereotype.Component;

/**
 * Öffentliche API-Facade des Inventory-Moduls.
 * Kapselt InventoryService für den Zugriff durch andere Module (z.B. mcp).
 * Nur Lesemethoden sind exponiert — schreibende Operationen bleiben intern.
 */
@Component
public class InventoryApi {
    private final InventoryService inventoryService;

    public InventoryApi(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    /**
     * Gibt den aktuellen Lagerbestand für einen Produktcode zurück.
     * Liefert 0 wenn kein Inventar-Eintrag vorhanden.
     */
    public Long getStockLevel(String productCode) {
        return inventoryService.getStockLevel(productCode);
    }

    /**
     * Gibt alle Inventar-Einträge paginiert zurück (10 pro Seite).
     */
    public PagedResult<InventoryView> getAllInventory(int pageNo) {
        return inventoryService.getAllInventory(pageNo);
    }
}
