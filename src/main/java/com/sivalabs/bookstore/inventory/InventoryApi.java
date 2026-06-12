package com.sivalabs.bookstore.inventory;

import com.sivalabs.bookstore.common.models.PagedResult;
import com.sivalabs.bookstore.inventory.domain.InventoryService;
import org.springframework.stereotype.Component;

/**
 * Öffentliche API des Inventory-Moduls für Cross-Module-Zugriff.
 * Analogon zu ProductApi (catalog) und OrdersApi (orders).
 */
@Component
public class InventoryApi {

    private final InventoryService inventoryService;

    public InventoryApi(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    public Long getStockLevel(String productCode) {
        return inventoryService.getStockLevel(productCode);
    }

    public PagedResult<InventoryItemView> getAllInventory(int pageNo) {
        return PagedResult.of(
                inventoryService.getAllInventory(pageNo), v -> new InventoryItemView(v.productCode(), v.quantity()));
    }
}
