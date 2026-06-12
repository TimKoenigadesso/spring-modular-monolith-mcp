package com.sivalabs.bookstore.inventory;

import com.sivalabs.bookstore.common.models.PagedResult;
import com.sivalabs.bookstore.inventory.domain.InventoryService;
import org.springframework.stereotype.Component;

@Component
public class InventoryApi {
    private final InventoryService inventoryService;

    public InventoryApi(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    public Long getStockLevel(String productCode) {
        return inventoryService.getStockLevel(productCode);
    }

    public PagedResult<InventoryItemDto> getAllInventory(int pageNo) {
        return PagedResult.of(
                inventoryService.getAllInventory(pageNo), v -> new InventoryItemDto(v.productCode(), v.quantity()));
    }
}
