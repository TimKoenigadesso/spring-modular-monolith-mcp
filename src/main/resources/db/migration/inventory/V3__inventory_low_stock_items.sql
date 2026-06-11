SET search_path TO inventory;

-- Einige Artikel mit niedrigem Bestand für Demo-Query "list_low_stock"
UPDATE inventory SET quantity = 3  WHERE product_code = 'P104';
UPDATE inventory SET quantity = 5  WHERE product_code = 'P109';
UPDATE inventory SET quantity = 2  WHERE product_code = 'P113';
UPDATE inventory SET quantity = 8  WHERE product_code = 'P106';
