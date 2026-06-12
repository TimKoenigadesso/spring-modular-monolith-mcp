@ApplicationModule(allowedDependencies = {"catalog", "orders", "orders::order-models", "inventory", "common"})
@NullMarked
package com.sivalabs.bookstore.mcp;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
