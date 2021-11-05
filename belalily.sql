-- phpMyAdmin SQL Dump
-- version 4.7.0
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: 05-Nov-2021 às 05:57
-- Versão do servidor: 5.7.17
-- PHP Version: 5.6.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `belalily`
--

DELIMITER $$
--
-- Procedures
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `cancelOrder` (`order_id` INT)  BEGIN

	DECLARE success BOOLEAN DEFAULT FALSE;
    
    START TRANSACTION;
    
    IF EXISTS
                (
                SELECT
                    orders.id
                FROM
                    orders
                WHERE
                    orders.id = order_id AND
                    orders.status = 'IN_PROGRESS' AND
                    orders.payment_status = 'NAO_INICIADO'
                LIMIT 1
                )
             THEN
        UPDATE orders SET status = 'CANCELED' WHERE orders.id = order_id;
        UPDATE product_inventory SET status = 'AVAILABLE' WHERE product_inventory.order_id = order_id;
        COMMIT;
        SET success = TRUE;
    ELSE
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'order not found';
        ROLLBACK;
    END IF;
    
    SELECT success;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `createOrder` (`customer_id` INT, `subtotal` DECIMAL(10,2), `extra_amount` DECIMAL(10,2), `coupon_discount` DECIMAL(10,2), `shipping_cost` DECIMAL(10,2), `total` DECIMAL(10,2), `shipping_type` ENUM('FREE','NORMAL','EXPRESS'), `shipping_district_id` INT, `shipping_cep` VARCHAR(8), `shipping_street` VARCHAR(15), `shipping_complement` VARCHAR(20), `shipping_number` VARCHAR(10), `shipping_address_observation` VARCHAR(50), `payment_method` ENUM('PIX','BOLETO','CREDIT'), `payment_in_cash` BOOLEAN, `payment_pagseguro` BOOLEAN, `payment_pagseguro_reference` VARCHAR(10), `coupon_id` INT, `products` VARCHAR(1000))  BEGIN

	DECLARE success BOOLEAN DEFAULT FALSE;
    DECLARE order_id INT DEFAULT 0;
    
	DECLARE numberOfProducts INT;
	DECLARE product_id INT;
	DECLARE size_id INT;
    DECLARE quantity INT;
    
    DECLARE price DECIMAL(10,2);
    DECLARE price_in_cash DECIMAL(10,2);
    
    DECLARE i INT default 0;
    
    START TRANSACTION;
    
    SET numberOfProducts = JSON_EXTRACT(products, "$.numberOfProducts");
    
    	
	SET i = 1;loop1: WHILE i <= numberOfProducts DO
    
    	SET product_id = JSON_EXTRACT(products, CONCAT("$.p", i, ".id"));
        SET size_id = JSON_EXTRACT(products, CONCAT("$.p", i, ".size_id"));
        SET quantity = JSON_EXTRACT(products, CONCAT("$.p", i, ".quantity"));
        IF (SELECT COUNT(*) FROM product_inventory WHERE product_inventory.product_id = product_id AND product_inventory.size_id = size_id AND product_inventory.status = 'AVAILABLE') < quantity THEN
            LEAVE loop1;
        END IF;
        
    	SET i = i + 1;
  	END WHILE loop1;
        
    IF i <= numberOfProducts THEN
    	SIGNAL SQLSTATE '45000'
      	SET MESSAGE_TEXT = 'Estoque insuficiente';
    	ROLLBACK;
    ELSE
    
    	        
                
        INSERT INTO `orders`(`customer_id`, `subtotal`, `extra_amount`, `coupon_discount`, `shipping_cost`, `total`, `creation_datetime`, `shipping_type`, `shipping_district_id`, `shipping_cep`, `shipping_street`, `shipping_complement`, `shipping_number`, `shipping_address_observation`, `status`, `payment_status`, `shipping_status`, `payment_method`, `payment_in_cash`, `payment_pagseguro`, `payment_pagseguro_reference`, `coupon_id`) VALUES (customer_id, subtotal, extra_amount, coupon_discount, shipping_cost, total, NOW(), shipping_type, shipping_district_id, shipping_cep, shipping_street, shipping_complement, shipping_number, shipping_address_observation, 'IN_PROGRESS', 'NAO_INICIADO', 'NAO_INICIADO', payment_method, payment_in_cash, payment_pagseguro, payment_pagseguro_reference, coupon_id);
        SET order_id = LAST_INSERT_ID();
        
                
        SET i = 1;loop2: WHILE i <= numberOfProducts DO

            SET product_id = JSON_EXTRACT(products, CONCAT("$.p", i, ".id"));
            SET size_id = JSON_EXTRACT(products, CONCAT("$.p", i, ".size_id"));
            SET quantity = JSON_EXTRACT(products, CONCAT("$.p", i, ".quantity"));
           	SET price = JSON_EXTRACT(products, CONCAT("$.p", i, ".price"));
            SET price_in_cash = JSON_EXTRACT(products, CONCAT("$.p", i, ".price_in_cash"));
			
            INSERT INTO `order_products`(`order_id`, `product_id`, `size_id`, `price`, `price_in_cash`, `quantity`) VALUES (order_id, product_id, size_id, price, price_in_cash, quantity);

            SET i = i + 1;
        END WHILE loop2;
        
                
        SET i = 1;loop3: WHILE i <= numberOfProducts DO

            SET product_id = JSON_EXTRACT(products, CONCAT("$.p", i, ".id"));
            SET size_id = JSON_EXTRACT(products, CONCAT("$.p", i, ".size_id"));
            SET quantity = JSON_EXTRACT(products, CONCAT("$.p", i, ".quantity"));
           	SET price = JSON_EXTRACT(products, CONCAT("$.p", i, ".price"));
            SET price_in_cash = JSON_EXTRACT(products, CONCAT("$.p", i, ".price_in_cash"));
			
            UPDATE product_inventory SET `order_id`=order_id,`status`='IN_ORDER' WHERE product_inventory.product_id = product_id AND product_inventory.size_id = size_id AND product_inventory.status = 'AVAILABLE' LIMIT quantity;

            SET i = i + 1;
        END WHILE loop3;
        
    	SET success = TRUE; 
    	COMMIT;
    END IF;
    
    SELECT success, order_id;

END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Estrutura da tabela `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(20) COLLATE utf8_bin NOT NULL,
  `visible` tinyint(1) NOT NULL DEFAULT '0',
  `position` int(11) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `categories`
--

INSERT INTO `categories` (`id`, `name`, `visible`, `position`) VALUES
(1, 'Destaque', 1, 0),
(2, 'T-Shirt', 1, 1),
(3, 'Body', 0, 2),
(4, 'Cropped', 1, 3);

-- --------------------------------------------------------

--
-- Estrutura da tabela `cities`
--

CREATE TABLE `cities` (
  `id` int(11) NOT NULL,
  `name` varchar(20) COLLATE utf8_bin NOT NULL,
  `uf` varchar(2) COLLATE utf8_bin NOT NULL DEFAULT 'GO'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `cities`
--

INSERT INTO `cities` (`id`, `name`, `uf`) VALUES
(1, 'Goiânia', 'GO');

-- --------------------------------------------------------

--
-- Estrutura da tabela `consultants`
--

CREATE TABLE `consultants` (
  `id` int(11) NOT NULL,
  `name` varchar(50) COLLATE utf8_bin NOT NULL,
  `code` varchar(10) COLLATE utf8_bin NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `consultants`
--

INSERT INTO `consultants` (`id`, `name`, `code`) VALUES
(1, 'Pedro Henrique', 'pedrohenri');

-- --------------------------------------------------------

--
-- Estrutura da tabela `coupons`
--

CREATE TABLE `coupons` (
  `id` int(11) NOT NULL,
  `code` varchar(20) COLLATE utf8_bin NOT NULL,
  `type` enum('PERCENT','GROSS','TWO_PERCENT','TWO_GROSS') COLLATE utf8_bin NOT NULL,
  `value` decimal(10,2) NOT NULL,
  `minimum_amount` decimal(10,2) NOT NULL,
  `max_uses` int(11) NOT NULL,
  `uses` int(11) NOT NULL DEFAULT '0',
  `max_units` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `coupons`
--

INSERT INTO `coupons` (`id`, `code`, `type`, `value`, `minimum_amount`, `max_uses`, `uses`, `max_units`) VALUES
(1, '5PORCENTO', 'PERCENT', '5.00', '40.00', 1, 0, 4),
(2, '10BRUTO', 'GROSS', '10.00', '50.00', 1, 0, 6),
(3, '10DUPLO', 'TWO_PERCENT', '10.00', '0.00', 1, 0, 4),
(4, '5DUPLO', 'TWO_GROSS', '5.00', '30.00', 1, 0, 6);

-- --------------------------------------------------------

--
-- Estrutura da tabela `customers`
--

CREATE TABLE `customers` (
  `id` int(11) NOT NULL,
  `name` varchar(50) COLLATE utf8_bin NOT NULL,
  `desired_name` varchar(20) COLLATE utf8_bin NOT NULL,
  `cpf` varchar(11) COLLATE utf8_bin NOT NULL,
  `birthday` date NOT NULL,
  `registration_datetime` datetime NOT NULL,
  `email` varchar(254) COLLATE utf8_bin NOT NULL,
  `password` char(60) COLLATE utf8_bin NOT NULL,
  `consultant_id` int(11) DEFAULT NULL,
  `whatsapp` varchar(11) COLLATE utf8_bin NOT NULL DEFAULT '',
  `mobile` varchar(11) COLLATE utf8_bin NOT NULL,
  `district_id` int(11) NOT NULL,
  `cep` varchar(8) COLLATE utf8_bin NOT NULL,
  `street` varchar(30) COLLATE utf8_bin NOT NULL,
  `complement` varchar(30) COLLATE utf8_bin NOT NULL,
  `number` varchar(10) COLLATE utf8_bin NOT NULL,
  `address_observation` varchar(50) COLLATE utf8_bin NOT NULL,
  `secret_question_id` int(11) NOT NULL,
  `secret_answer` varchar(60) COLLATE utf8_bin NOT NULL,
  `allow_email` tinyint(1) NOT NULL,
  `allow_whatsapp` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `customers`
--

INSERT INTO `customers` (`id`, `name`, `desired_name`, `cpf`, `birthday`, `registration_datetime`, `email`, `password`, `consultant_id`, `whatsapp`, `mobile`, `district_id`, `cep`, `street`, `complement`, `number`, `address_observation`, `secret_question_id`, `secret_answer`, `allow_email`, `allow_whatsapp`) VALUES
(1, 'Pedro Henrique Martins Candido da Silva', 'Pedro', '05551047105', '1999-01-31', '2021-10-25 03:00:00', 'pedropabline@hotmail.com', '$2a$08$9ZiaWX7NHxeCFhrFwlHnguiWqLK5dvGbIVdQaCJpcAbuyjm/9jaMC', 1, '62993547056', '62993547056', 1, '74730190', 'Rua 11', 'Quadra 7 Lote 8', 's/n', 'Próximo a pizzaria Império da Pizza', 1, '$2a$08$xlz7p4Bj1KyrdZskU06g3evfCHjc8e.TRilx8qV90YtGve7fEYuj6', 1, 1),
(40, 'Pedro Henrique', 'Pedro', '54845818000', '1999-01-31', '2021-10-27 22:25:24', 'pedropabline2@hotmail.com', '$2a$08$7FLyI1Mo4XearkTPwU3cXupZF.kqVweDxYOKvucaRSg280TvaJn6u', 1, '', '62993547056', 1, '74730190', 'Rua 11', 'Quadra 13 Lote 07', 's/n', 'Deixar com os gatos', 1, '$2a$08$mQjhuFzxif2j80Y4dOxRoeU.x6TAIL8W.9h5pB8xfqi0hWwHnSgYG', 1, 1),
(42, 'Patolino', 'Patolino', '14886180035', '1988-01-01', '2021-10-29 02:01:27', 'abc@hotmail.com', '$2a$08$bRnUTyxvwiR92nUVsylMRuDxrLO.LnwuBPNLAq.w3bNUm.B0Qwu9m', NULL, '', '12345678465', 1, '74730150', 'Rua 7', '', 's/n', '', 1, '$2a$08$17gK2n8AlRCQMGKtE7rkDuu2wtCECBIJomgtlFnDGV/0oBYeMmqsK', 1, 1);

-- --------------------------------------------------------

--
-- Estrutura da tabela `customer_wishlist`
--

CREATE TABLE `customer_wishlist` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `size_id` int(11) NOT NULL,
  `favorited_datetime` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `customer_wishlist`
--

INSERT INTO `customer_wishlist` (`id`, `customer_id`, `product_id`, `size_id`, `favorited_datetime`) VALUES
(52, 1, 2, 4, '2021-10-31 22:20:55'),
(54, 1, 1, 3, '2021-11-01 19:59:57'),
(58, 1, 1, 2, '2021-11-03 10:38:34'),
(64, 1, 1, 1, '2021-11-03 10:45:48');

-- --------------------------------------------------------

--
-- Estrutura da tabela `districts`
--

CREATE TABLE `districts` (
  `id` int(11) NOT NULL,
  `city_id` int(11) NOT NULL,
  `name` varchar(30) COLLATE utf8_bin NOT NULL,
  `api_name` varchar(30) COLLATE utf8_bin NOT NULL,
  `shipping_free_available` tinyint(1) NOT NULL,
  `shipping_express_price` decimal(10,2) NOT NULL,
  `shipping_normal_price` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `districts`
--

INSERT INTO `districts` (`id`, `city_id`, `name`, `api_name`, `shipping_free_available`, `shipping_express_price`, `shipping_normal_price`) VALUES
(1, 1, 'Conjunto Riviera', 'Conjunto Riviera', 0, '10.00', '5.00'),
(2, 1, 'Jardim Califórnia', 'Jardim Califórnia', 1, '10.00', '5.00');

-- --------------------------------------------------------

--
-- Estrutura da tabela `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `extra_amount` decimal(10,2) NOT NULL,
  `coupon_discount` decimal(4,2) NOT NULL,
  `shipping_cost` decimal(10,2) NOT NULL,
  `total` decimal(10,2) NOT NULL,
  `creation_datetime` datetime NOT NULL,
  `shipping_type` enum('FREE','NORMAL','EXPRESS') COLLATE utf8_bin NOT NULL,
  `shipping_district_id` int(11) NOT NULL,
  `shipping_cep` varchar(8) COLLATE utf8_bin NOT NULL,
  `shipping_street` varchar(15) COLLATE utf8_bin NOT NULL,
  `shipping_complement` varchar(20) COLLATE utf8_bin NOT NULL,
  `shipping_number` varchar(10) COLLATE utf8_bin NOT NULL,
  `shipping_address_observation` varchar(50) COLLATE utf8_bin NOT NULL,
  `status` enum('IN_PROGRESS','FINISHED','CANCELED') COLLATE utf8_bin NOT NULL,
  `payment_status` enum('NAO_INICIADO') COLLATE utf8_bin NOT NULL,
  `shipping_status` enum('NAO_INICIADO') COLLATE utf8_bin NOT NULL,
  `payment_method` enum('PIX','BOLETO','CREDIT') COLLATE utf8_bin NOT NULL,
  `payment_in_cash` tinyint(1) DEFAULT NULL,
  `payment_pagseguro` tinyint(1) NOT NULL,
  `payment_pagseguro_code` varchar(50) COLLATE utf8_bin DEFAULT NULL,
  `payment_pagseguro_reference` varchar(10) COLLATE utf8_bin DEFAULT NULL,
  `payment_boleto_link` varchar(255) COLLATE utf8_bin DEFAULT NULL,
  `coupon_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `orders`
--

INSERT INTO `orders` (`id`, `customer_id`, `subtotal`, `extra_amount`, `coupon_discount`, `shipping_cost`, `total`, `creation_datetime`, `shipping_type`, `shipping_district_id`, `shipping_cep`, `shipping_street`, `shipping_complement`, `shipping_number`, `shipping_address_observation`, `status`, `payment_status`, `shipping_status`, `payment_method`, `payment_in_cash`, `payment_pagseguro`, `payment_pagseguro_code`, `payment_pagseguro_reference`, `payment_boleto_link`, `coupon_id`) VALUES
(2, 1, '10.00', '1.00', '2.00', '3.00', '4.00', '2021-11-05 02:39:01', 'FREE', 1, '74730190', 'Rua 11', 'Quadra 22', 's/n', 'Obs', 'CANCELED', 'NAO_INICIADO', 'NAO_INICIADO', 'PIX', 1, 1, NULL, 'ABC', NULL, 1),
(3, 1, '10.00', '1.00', '2.00', '3.00', '4.00', '2021-11-05 02:42:01', 'FREE', 1, '74730190', 'Rua 11', 'Quadra 22', 's/n', 'Obs', 'CANCELED', 'NAO_INICIADO', 'NAO_INICIADO', 'PIX', 1, 1, NULL, 'ABC', NULL, 1);

-- --------------------------------------------------------

--
-- Estrutura da tabela `order_events`
--

CREATE TABLE `order_events` (
  `id` int(11) NOT NULL,
  `date` datetime NOT NULL,
  `name` varchar(30) COLLATE utf8_bin NOT NULL,
  `description` varchar(200) COLLATE utf8_bin NOT NULL,
  `order_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- --------------------------------------------------------

--
-- Estrutura da tabela `order_products`
--

CREATE TABLE `order_products` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `size_id` int(11) NOT NULL,
  `price` decimal(4,2) NOT NULL,
  `price_in_cash` decimal(4,2) NOT NULL,
  `quantity` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `order_products`
--

INSERT INTO `order_products` (`id`, `order_id`, `product_id`, `size_id`, `price`, `price_in_cash`, `quantity`) VALUES
(1, 2, 1, 1, '3.00', '2.00', 2),
(2, 2, 1, 2, '1.00', '2.00', 1),
(3, 3, 2, 4, '3.00', '2.00', 1);

-- --------------------------------------------------------

--
-- Estrutura da tabela `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `name` varchar(30) COLLATE utf8_bin NOT NULL,
  `price` decimal(4,2) NOT NULL,
  `price_in_cash` decimal(4,2) NOT NULL,
  `description` text COLLATE utf8_bin NOT NULL,
  `img_number` int(11) NOT NULL DEFAULT '0',
  `position` tinyint(3) UNSIGNED NOT NULL,
  `visible` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `products`
--

INSERT INTO `products` (`id`, `name`, `price`, `price_in_cash`, `description`, `img_number`, `position`, `visible`) VALUES
(1, 'T-Shirt Exemplo', '35.00', '30.00', 'Exemplo de descrição', 2, 1, 1),
(2, 'Cropped Exemplo', '25.00', '20.00', 'Exemplo de descrição<br/>pro cropped', 1, 2, 1);

-- --------------------------------------------------------

--
-- Estrutura da tabela `product_categories`
--

CREATE TABLE `product_categories` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `product_categories`
--

INSERT INTO `product_categories` (`id`, `product_id`, `category_id`) VALUES
(1, 1, 1),
(2, 1, 2),
(3, 2, 4),
(4, 2, 1);

-- --------------------------------------------------------

--
-- Estrutura da tabela `product_inventory`
--

CREATE TABLE `product_inventory` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `size_id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `status` enum('AVAILABLE','IN_ORDER','UNAVAILABLE') COLLATE utf8_bin NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `product_inventory`
--

INSERT INTO `product_inventory` (`id`, `product_id`, `size_id`, `order_id`, `status`) VALUES
(1, 1, 1, 2, 'AVAILABLE'),
(2, 1, 2, 2, 'AVAILABLE'),
(3, 1, 1, 2, 'AVAILABLE'),
(4, 2, 4, 3, 'AVAILABLE');

-- --------------------------------------------------------

--
-- Estrutura da tabela `product_sizes`
--

CREATE TABLE `product_sizes` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `size_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `product_sizes`
--

INSERT INTO `product_sizes` (`id`, `product_id`, `size_id`) VALUES
(1, 1, 1),
(2, 1, 2),
(3, 1, 3),
(4, 2, 4);

-- --------------------------------------------------------

--
-- Estrutura da tabela `secret_questions`
--

CREATE TABLE `secret_questions` (
  `id` int(11) NOT NULL,
  `question` varchar(40) COLLATE utf8_bin NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `secret_questions`
--

INSERT INTO `secret_questions` (`id`, `question`) VALUES
(1, 'Qual o nome do meio do meu pai?'),
(2, 'Qual a minha série favorita?');

-- --------------------------------------------------------

--
-- Estrutura da tabela `sizes`
--

CREATE TABLE `sizes` (
  `id` int(11) NOT NULL,
  `name` varchar(15) COLLATE utf8_bin NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `sizes`
--

INSERT INTO `sizes` (`id`, `name`) VALUES
(1, 'P'),
(2, 'M'),
(3, 'G'),
(4, 'Único');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `cities`
--
ALTER TABLE `cities`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `consultants`
--
ALTER TABLE `consultants`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `coupons`
--
ALTER TABLE `coupons`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`) USING BTREE,
  ADD UNIQUE KEY `cpf` (`cpf`),
  ADD KEY `district_id` (`district_id`),
  ADD KEY `secret_question` (`secret_question_id`),
  ADD KEY `consultant_id` (`consultant_id`);

--
-- Indexes for table `customer_wishlist`
--
ALTER TABLE `customer_wishlist`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `product_id_2` (`product_id`,`size_id`,`customer_id`) USING BTREE,
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `size_id` (`size_id`);

--
-- Indexes for table `districts`
--
ALTER TABLE `districts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `city_id` (`city_id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `shipping_district_id` (`shipping_district_id`),
  ADD KEY `coupon` (`coupon_id`);

--
-- Indexes for table `order_events`
--
ALTER TABLE `order_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`);

--
-- Indexes for table `order_products`
--
ALTER TABLE `order_products`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `size_id` (`size_id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `product_categories`
--
ALTER TABLE `product_categories`
  ADD PRIMARY KEY (`id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `category_id` (`category_id`);

--
-- Indexes for table `product_inventory`
--
ALTER TABLE `product_inventory`
  ADD PRIMARY KEY (`id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `size_id` (`size_id`),
  ADD KEY `order_id` (`order_id`);

--
-- Indexes for table `product_sizes`
--
ALTER TABLE `product_sizes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `size_id` (`size_id`);

--
-- Indexes for table `secret_questions`
--
ALTER TABLE `secret_questions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `sizes`
--
ALTER TABLE `sizes`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;
--
-- AUTO_INCREMENT for table `cities`
--
ALTER TABLE `cities`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;
--
-- AUTO_INCREMENT for table `consultants`
--
ALTER TABLE `consultants`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;
--
-- AUTO_INCREMENT for table `coupons`
--
ALTER TABLE `coupons`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;
--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;
--
-- AUTO_INCREMENT for table `customer_wishlist`
--
ALTER TABLE `customer_wishlist`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=65;
--
-- AUTO_INCREMENT for table `districts`
--
ALTER TABLE `districts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;
--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;
--
-- AUTO_INCREMENT for table `order_events`
--
ALTER TABLE `order_events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
--
-- AUTO_INCREMENT for table `order_products`
--
ALTER TABLE `order_products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;
--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;
--
-- AUTO_INCREMENT for table `product_categories`
--
ALTER TABLE `product_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;
--
-- AUTO_INCREMENT for table `product_inventory`
--
ALTER TABLE `product_inventory`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;
--
-- AUTO_INCREMENT for table `product_sizes`
--
ALTER TABLE `product_sizes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;
--
-- AUTO_INCREMENT for table `secret_questions`
--
ALTER TABLE `secret_questions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;
--
-- AUTO_INCREMENT for table `sizes`
--
ALTER TABLE `sizes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;
--
-- Constraints for dumped tables
--

--
-- Limitadores para a tabela `customers`
--
ALTER TABLE `customers`
  ADD CONSTRAINT `customers_ibfk_1` FOREIGN KEY (`district_id`) REFERENCES `districts` (`id`),
  ADD CONSTRAINT `customers_ibfk_2` FOREIGN KEY (`secret_question_id`) REFERENCES `secret_questions` (`id`),
  ADD CONSTRAINT `customers_ibfk_3` FOREIGN KEY (`consultant_id`) REFERENCES `consultants` (`id`);

--
-- Limitadores para a tabela `customer_wishlist`
--
ALTER TABLE `customer_wishlist`
  ADD CONSTRAINT `customer_wishlist_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `customer_wishlist_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `customer_wishlist_ibfk_3` FOREIGN KEY (`size_id`) REFERENCES `sizes` (`id`);

--
-- Limitadores para a tabela `districts`
--
ALTER TABLE `districts`
  ADD CONSTRAINT `districts_ibfk_1` FOREIGN KEY (`city_id`) REFERENCES `cities` (`id`);

--
-- Limitadores para a tabela `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`shipping_district_id`) REFERENCES `districts` (`id`),
  ADD CONSTRAINT `orders_ibfk_3` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`);

--
-- Limitadores para a tabela `order_events`
--
ALTER TABLE `order_events`
  ADD CONSTRAINT `order_events_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`);

--
-- Limitadores para a tabela `order_products`
--
ALTER TABLE `order_products`
  ADD CONSTRAINT `order_products_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  ADD CONSTRAINT `order_products_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `order_products_ibfk_3` FOREIGN KEY (`size_id`) REFERENCES `sizes` (`id`);

--
-- Limitadores para a tabela `product_categories`
--
ALTER TABLE `product_categories`
  ADD CONSTRAINT `product_categories_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`),
  ADD CONSTRAINT `product_categories_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Limitadores para a tabela `product_inventory`
--
ALTER TABLE `product_inventory`
  ADD CONSTRAINT `product_inventory_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `product_inventory_ibfk_2` FOREIGN KEY (`size_id`) REFERENCES `sizes` (`id`);

--
-- Limitadores para a tabela `product_sizes`
--
ALTER TABLE `product_sizes`
  ADD CONSTRAINT `product_sizes_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `product_sizes_ibfk_2` FOREIGN KEY (`size_id`) REFERENCES `sizes` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
