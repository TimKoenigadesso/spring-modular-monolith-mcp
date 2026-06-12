package com.sivalabs.bookstore.catalog;

import com.sivalabs.bookstore.catalog.domain.ProductService;
import com.sivalabs.bookstore.common.models.PagedResult;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Öffentliche API-Facade des Catalog-Moduls.
 * Exponiert Produktabfragen für andere Module (z.B. orders, mcp).
 */
@Component
public class ProductApi {
    private final ProductService productService;

    public ProductApi(ProductService productService) {
        this.productService = productService;
    }

    /**
     * Gibt ein einzelnes Produkt anhand des Codes zurück (nur aktive Produkte).
     */
    public Optional<ProductDto> getByCode(String code) {
        return productService.getByCode(code);
    }

    /**
     * Listet alle aktiven Produkte seitenweise auf (10 pro Seite, sortiert nach Name aufsteigend).
     */
    public PagedResult<ProductDto> getProducts(int pageNo) {
        return productService.getProducts(pageNo);
    }
}
