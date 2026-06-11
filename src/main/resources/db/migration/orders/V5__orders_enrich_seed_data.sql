SET search_path TO orders;

-- Mehr Bestellungen für überzeugende Demo-Queries (verschiedene Status, Kunden)
INSERT INTO orders(order_number, customer_name, customer_email, customer_phone,
                   delivery_address, product_code, product_name, product_price,
                   quantity, status, comments, created_at, user_id)
VALUES
  ('A1B2-3C4D', 'Maria Müller', 'maria.mueller@example.de', '+49 30 12345678',
   'Hauptstraße 42, 10115 Berlin', 'P103', 'Gone with the Wind', 44.50, 1,
   'DELIVERED', 'Schnelle Lieferung, danke!', CURRENT_TIMESTAMP - INTERVAL '5 days', NULL),

  ('E5F6-7G8H', 'Thomas Schmidt', 'thomas.schmidt@example.de', '+49 89 98765432',
   'Maximilianstraße 12, 80539 München', 'P107', 'The Alchemist', 12.00, 2,
   'DELIVERED', NULL, CURRENT_TIMESTAMP - INTERVAL '3 days', NULL),

  ('I9J0-K1L2', 'Sophie Wagner', 'sophie.wagner@example.de', '+49 40 55544433',
   'Reeperbahn 7, 20359 Hamburg', 'P111', 'A Game of Thrones', 32.00, 1,
   'CANCELLED', 'Leider nicht lieferbar gewesen', CURRENT_TIMESTAMP - INTERVAL '7 days', NULL),

  ('M3N4-O5P6', 'Klaus Fischer', 'k.fischer@example.de', '+49 221 33322211',
   'Schildergasse 5, 50667 Köln', 'P104', 'The Fault in Our Stars', 14.50, 3,
   'NEW', NULL, CURRENT_TIMESTAMP - INTERVAL '1 hour', NULL),

  ('Q7R8-S9T0', 'Anna Becker', 'anna.becker@example.de', '+49 711 44455566',
   'Königstraße 1, 70173 Stuttgart', 'P108', 'Charlotte''s Web', 14.00, 1,
   'NEW', NULL, CURRENT_TIMESTAMP - INTERVAL '30 minutes', NULL),

  ('U1V2-W3X4', 'Felix Hoffmann', 'felix.hoffmann@example.de', '+49 30 77788899',
   'Unter den Linden 50, 10117 Berlin', 'P112', 'The Book Thief', 30.00, 1,
   'DELIVERED', 'Perfektes Geschenk!', CURRENT_TIMESTAMP - INTERVAL '10 days', NULL),

  ('Y5Z6-A7B8', 'Laura Schulz', 'laura.schulz@example.de', '+49 69 11122233',
   'Zeil 33, 60313 Frankfurt', 'P100', 'The Hunger Games', 34.00, 2,
   'DELIVERED', NULL, CURRENT_TIMESTAMP - INTERVAL '4 days', NULL);
