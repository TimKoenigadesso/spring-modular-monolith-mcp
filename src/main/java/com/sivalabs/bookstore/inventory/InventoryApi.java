package com.sivalabs.bookstore.inventory;

import com.sivalabs.bookstore.common.models.PagedResult;
import com.sivalabs.bookstore.inventory.domain.InventoryService;
import org.springframework.stereotype.Component;

/**
 * Public API facade for the Inventory module. Exposes inventory capabilities to other modules
 * without leaking internal domain types.
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
        var internal = inventoryService.getAllInventory(pageNo);
        return PagedResult.of(internal, iv -> new InventoryItemView(iv.productCode(), iv.quantity()));
    }
}
