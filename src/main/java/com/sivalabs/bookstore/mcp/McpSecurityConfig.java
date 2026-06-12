// AUTO-GENERATED — MCP-Endpoint öffentlich zugänglich machen
package com.sivalabs.bookstore.mcp;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@Order(1)
public class McpSecurityConfig {

    @Bean
    public SecurityFilterChain mcpFilterChain(HttpSecurity http) throws Exception {
        http.securityMatcher("/mcp/**", "/mcp")
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }
}
