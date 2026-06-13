package com.sivalabs.bookstore.inventory;

import com.sivalabs.bookstore.inventory.domain.InventoryService;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Öffentliche API-Fassade für das Inventory-Modul.
 *
 * <p>Stellt Lagerbestands-Abfragen für andere Module (insbesondere den MCP-Layer) bereit,
 * ohne die internen Domain-Typen ({@code InventoryService}, {@code InventoryRepository},
 * {@code InventoryView}) zu exponieren. Folgt dem Spring Modulith Modul-Grenz-Muster.
 *
 * <p>Interne {@code InventoryView}-Records werden auf das öffentliche {@link InventoryStockView}
 * DTO gemappt, das im öffentlichen {@code inventory}-Package liegt.
 */
@Component
public class InventoryApi {

    private final InventoryService inventoryService;

    public InventoryApi(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    /**
     * Gibt den aktuellen Lagerbestand für einen Produktcode zurück.
     *
     * @param productCode Eindeutiger Produktcode
     * @return Lagerbestand (0 wenn nicht im Inventar erfasst)
     */
    public Long getStockLevel(String productCode) {
        return inventoryService.getStockLevel(productCode);
    }

    /**
     * Gibt eine Liste aller Inventar-Einträge der ersten Seite zurück (Seitengröße: 10).
     *
     * <p>Interne {@code InventoryView}-Records werden auf das öffentliche
     * {@link InventoryStockView}-DTO gemappt.
     *
     * @return Liste mit Inventar-Stock-Views
     */
    public List<InventoryStockView> getAllInventoryFirstPage() {
        return inventoryService.getAllInventory(1).data().stream()
                .map(iv -> new InventoryStockView(iv.productCode(), iv.quantity()))
                .toList();
    }
}
