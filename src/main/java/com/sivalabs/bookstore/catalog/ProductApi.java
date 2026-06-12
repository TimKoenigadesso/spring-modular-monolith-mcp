package com.sivalabs.bookstore.catalog;

import com.sivalabs.bookstore.catalog.domain.ProductService;
import com.sivalabs.bookstore.common.models.PagedResult;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class ProductApi {
    private final ProductService productService;

    public ProductApi(ProductService productService) {
        this.productService = productService;
    }

    public Optional<ProductDto> getByCode(String code) {
        return productService.getByCode(code);
    }

    public PagedResult<ProductDto> getProducts(int pageNo) {
        return productService.getProducts(pageNo);
    }
}
