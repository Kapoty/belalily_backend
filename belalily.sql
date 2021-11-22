-- phpMyAdmin SQL Dump
-- version 4.7.0
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: 22-Nov-2021 às 19:43
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
    DECLARE coupon_id INT DEFAULT NULL;
    
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
                    orders.payment_status = 'NOT_STARTED'
                LIMIT 1
                )
             THEN
        UPDATE orders SET status = 'CANCELED' WHERE orders.id = order_id;
        UPDATE product_inventory SET status = 'AVAILABLE', product_inventory.order_id = NULL WHERE product_inventory.order_id = order_id;
        SELECT orders.coupon_id INTO coupon_id FROM orders WHERE orders.id = order_id;
        IF coupon_id IS NOT NULL THEN
            UPDATE coupons SET coupons.uses = (coupons.uses - 1) WHERE coupons.id = coupon_id;
        END IF;
        COMMIT;
        SET success = TRUE;
    ELSE
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'order not found';
        ROLLBACK;
    END IF;
    
    SELECT success;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `createOrder` (`customer_id` INT, `subtotal` DECIMAL(10,2), `extra_amount` DECIMAL(10,2), `coupon_discount` DECIMAL(10,2), `shipping_cost` DECIMAL(10,2), `fees` DECIMAL(10,2), `total` DECIMAL(10,2), `shipping_type` ENUM('FREE','NORMAL','EXPRESS'), `shipping_district_id` INT, `shipping_cep` VARCHAR(8), `shipping_street` VARCHAR(15), `shipping_complement` VARCHAR(20), `shipping_number` VARCHAR(10), `shipping_address_observation` VARCHAR(50), `payment_status` ENUM('NOT_STARTED','STARTED'), `payment_method` ENUM('PIX','BOLETO','CREDIT'), `payment_installment_quantity` INT, `payment_in_cash` BOOLEAN, `payment_pagseguro` BOOLEAN, `coupon_id` INT, `products` VARCHAR(1000))  BEGIN

    DECLARE success BOOLEAN DEFAULT FALSE;
    DECLARE order_id INT DEFAULT 0;
    DECLARE payment_pagseguro_reference VARCHAR(10);
    
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
        SET MESSAGE_TEXT = 'not enough inventory';
        ROLLBACK;
    ELSE
    
                
                
        INSERT INTO `orders`(`customer_id`, `subtotal`, `extra_amount`, `coupon_discount`, `shipping_cost`, `fees`, `total`, `creation_datetime`, `shipping_type`, `shipping_district_id`, `shipping_cep`, `shipping_street`, `shipping_complement`, `shipping_number`, `shipping_address_observation`, `status`, `payment_status`, `shipping_status`, `payment_method`,  `payment_installment_quantity`, `payment_in_cash`, `payment_pagseguro`, `payment_pagseguro_reference`, `coupon_id`) VALUES (customer_id, subtotal, extra_amount, coupon_discount, shipping_cost, fees, total, NOW(), shipping_type, shipping_district_id, shipping_cep, shipping_street, shipping_complement, shipping_number, shipping_address_observation, 'IN_PROGRESS', payment_status, 'NOT_STARTED', payment_method, payment_installment_quantity, payment_in_cash, payment_pagseguro, payment_pagseguro_reference, coupon_id);
        
        SET order_id = LAST_INSERT_ID();
        SET payment_pagseguro_reference = CONCAT('REF', order_id);

        UPDATE orders SET orders.payment_pagseguro_reference = payment_pagseguro_reference WHERE orders.id = order_id;
        
                
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

        
        IF coupon_id IS NOT NULL THEN
            UPDATE coupons SET coupons.uses = (coupons.uses + 1) WHERE coupons.id = coupon_id;
        END IF;
        
        SET success = TRUE; 
        COMMIT;
    END IF;
    
    SELECT success, order_id, payment_pagseguro_reference;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `deleteOrder` (`order_id` INT)  BEGIN

	DECLARE success BOOLEAN DEFAULT FALSE;
    DECLARE coupon_id INT DEFAULT NULL;
    
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
                    orders.payment_status = 'NOT_STARTED'
                LIMIT 1
                )
             THEN
        SELECT orders.coupon_id INTO coupon_id FROM orders WHERE orders.id = order_id;
        IF coupon_id IS NOT NULL THEN
            UPDATE coupons SET coupons.uses = (coupons.uses - 1) WHERE coupons.id = coupon_id;
        END IF;
        DELETE FROM order_products WHERE order_products.order_id = order_id;
        UPDATE product_inventory SET status = 'AVAILABLE', product_inventory.order_id = NULL WHERE product_inventory.order_id = order_id;
        DELETE FROM orders WHERE orders.id = order_id;
        
        COMMIT;
        SET success = TRUE;
    ELSE
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'order not found';
        ROLLBACK;
    END IF;
    
    SELECT success;

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
  `position` tinyint(3) UNSIGNED NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `categories`
--

INSERT INTO `categories` (`id`, `name`, `visible`, `position`) VALUES
(1, 'Destaque', 1, 1),
(2, 'T-Shirt', 1, 1),
(3, 'Body', 0, 2),
(4, 'Cropped', 1, 3),
(11, 'Teste', 0, 12);

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
(1, 'Goiânia', 'GO'),
(4, 'Anápolis', 'GO');

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
(1, '5PORCENTO', 'PERCENT', '5.00', '10.00', 1, 1, 4),
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
  `secret_answer` char(60) COLLATE utf8_bin NOT NULL,
  `allow_email` tinyint(1) NOT NULL,
  `allow_whatsapp` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `customers`
--

INSERT INTO `customers` (`id`, `name`, `desired_name`, `cpf`, `birthday`, `registration_datetime`, `email`, `password`, `consultant_id`, `whatsapp`, `mobile`, `district_id`, `cep`, `street`, `complement`, `number`, `address_observation`, `secret_question_id`, `secret_answer`, `allow_email`, `allow_whatsapp`) VALUES
(1, 'Pedro Henrique Martins Candido da Silva', 'Pedro', '05551047105', '1999-01-31', '2021-10-25 03:00:00', 'pedropabline@hotmail.com', '$2a$08$9ZiaWX7NHxeCFhrFwlHnguiWqLK5dvGbIVdQaCJpcAbuyjm/9jaMC', 1, '62993547056', '62993547056', 1, '74730190', 'Rua 11', 'Quadra 7 Lote 8', 's/n', 'Próximo a pizzaria Império da Pizza', 1, '$2a$08$xlz7p4Bj1KyrdZskU06g3evfCHjc8e.TRilx8qV90YtGve7fEYuj6', 1, 1),
(40, 'Pedro Henrique', 'Pedro', '54845818000', '1999-01-31', '2021-10-27 22:25:24', 'pedropabline2@hotmail.com', '$2a$08$7FLyI1Mo4XearkTPwU3cXupZF.kqVweDxYOKvucaRSg280TvaJn6u', 1, '', '62993547056', 1, '74730190', 'Rua 11', 'Quadra 13 Lote 07', 's/n', 'Deixar com os gatos', 1, '$2a$08$mQjhuFzxif2j80Y4dOxRoeU.x6TAIL8W.9h5pB8xfqi0hWwHnSgYG', 1, 1),
(42, 'Patolino', 'Patolino', '14886180035', '1988-01-01', '2021-10-29 02:01:27', 'abc@hotmail.com', '$2a$08$bRnUTyxvwiR92nUVsylMRuDxrLO.LnwuBPNLAq.w3bNUm.B0Qwu9m', NULL, '', '12345678465', 1, '74730150', 'Rua 7', '', 's/n', '', 1, '$2a$08$17gK2n8AlRCQMGKtE7rkDuu2wtCECBIJomgtlFnDGV/0oBYeMmqsK', 1, 1),
(43, 'Anderson', 'Anderson', '05563590119', '1999-03-05', '2021-11-05 18:39:03', 'andsinhox@hotmail.com', '$2a$08$hnXippoZ1fAXhhJqg2pBV.CwahJnvsxftOy//Ga.0BfrOquNpScQO', 1, '', '62812398721', 1, '74730190', 'Rua 11', '', 's/n', '', 2, '$2a$08$MHOjc8ooIUsopPWuZZ4KXe4SsJrT0VNYfHHFUOPVWM6Ffb4IotaTS', 1, 1),
(44, 'Rhubya Braz', 'Binha', '04323175116', '1998-06-03', '2021-11-06 12:44:51', 'rbrazrs@gmail.com', '$2a$08$6xeEwNqrGR0grjyX3/3SMuUaJyXOApnnNVKeo9Ct1/OAyffV0gmQW', NULL, '', '62991394927', 2, '74730190', 'Rua 11', '', 's/n', '', 1, '$2a$08$.I6QGniGGcg1vR0tKPo6t.GRhsJ2ZabD3bDGP7/bAFs65ZtQCTVye', 1, 1),
(45, 'Tewst', 'Tewst', '70306626101', '1999-06-08', '2021-11-06 13:41:54', 'vinicius@gmail.com', '$2a$08$AYkm78LauyG4uTYCD1Evruhe7NNlygxBRELqOLcolqU4j/D1INPDa', NULL, '', '21389210372', 1, '74730190', 'Rua 11', '', '1', '', 1, '$2a$08$xJkRjCl7V/0soHhnQ0C6VOix8aYDIhcZGWD2gxylaWcpGQ0vFb716', 1, 1),
(46, 'Tewst', 'Tewst', '33357072149', '1999-01-31', '2021-11-06 13:44:22', 'vinicius2@gmail.com', '$2a$08$blQR2AMrln8oc72m95nnKOJSCHrgLzDV1Bcd5U6qYbTSOWYK0qkV6', 1, '', '21122222222', 2, '74485030', 'Rua Barão de Mauá', '', 's/n', '', 1, '$2a$08$MHou2ElLE5v4WY8Qnm.ADeDnRbuWtZMNyAAIkczG2Rem9Mzzzw9bm', 1, 1);

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
(54, 1, 1, 3, '2021-11-01 19:59:57'),
(58, 1, 1, 2, '2021-11-03 10:38:34'),
(64, 1, 1, 1, '2021-11-03 10:45:48'),
(66, 1, 2, 4, '2021-11-05 18:12:25'),
(67, 44, 2, 4, '2021-11-06 13:07:02');

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
(1, 1, 'Conjunto Riviera', 'Conjunto Riviera', 1, '10.00', '5.00'),
(2, 1, 'Jardim Califórnia', 'Jardim Califórnia', 1, '10.00', '5.00'),
(6, 1, 'Três', 'Três', 0, '0.01', '0.01'),
(7, 1, 'Quatro', 'Quatro', 0, '0.01', '0.01'),
(8, 1, 'Cinco', 'Cinco', 0, '0.01', '0.01');

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
  `fees` decimal(10,2) NOT NULL,
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
  `payment_status` enum('NOT_STARTED','STARTED','AWAITING_PAYMENT','CONFIRMED') COLLATE utf8_bin NOT NULL,
  `shipping_status` enum('NOT_STARTED','IN_SEPARATION') COLLATE utf8_bin NOT NULL,
  `payment_method` enum('PIX','BOLETO','CREDIT') COLLATE utf8_bin NOT NULL,
  `payment_installment_quantity` int(11) DEFAULT NULL,
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

INSERT INTO `orders` (`id`, `customer_id`, `subtotal`, `extra_amount`, `coupon_discount`, `shipping_cost`, `fees`, `total`, `creation_datetime`, `shipping_type`, `shipping_district_id`, `shipping_cep`, `shipping_street`, `shipping_complement`, `shipping_number`, `shipping_address_observation`, `status`, `payment_status`, `shipping_status`, `payment_method`, `payment_installment_quantity`, `payment_in_cash`, `payment_pagseguro`, `payment_pagseguro_code`, `payment_pagseguro_reference`, `payment_boleto_link`, `coupon_id`) VALUES
(9, 1, '25.00', '0.00', '0.00', '10.00', '4.31', '39.31', '2021-11-11 20:45:57', 'EXPRESS', 1, '74730190', 'Rua 11', 'Quadra 7 Lote 8', 's/n', 'Próximo a pizzaria Império da Pizza', 'IN_PROGRESS', 'AWAITING_PAYMENT', 'NOT_STARTED', 'CREDIT', 7, 0, 1, '4026E4EB-ED4B-4599-9FF2-C2A9404CA643', 'REF9', NULL, NULL),
(10, 1, '35.00', '-5.00', '0.00', '10.00', '0.00', '40.00', '2021-11-11 20:48:18', 'EXPRESS', 1, '74730190', 'Rua 11', 'Quadra 7 Lote 8', 's/n', 'Próximo a pizzaria Império da Pizza', 'IN_PROGRESS', 'AWAITING_PAYMENT', 'NOT_STARTED', 'PIX', NULL, 1, 0, NULL, 'REF10', NULL, NULL),
(11, 1, '35.00', '-5.00', '0.00', '10.00', '0.00', '40.00', '2021-11-11 20:48:38', 'EXPRESS', 1, '74730190', 'Rua 11', 'Quadra 7 Lote 8', 's/n', 'Próximo a pizzaria Império da Pizza', 'CANCELED', 'AWAITING_PAYMENT', 'NOT_STARTED', 'BOLETO', NULL, 1, 1, '1F251DF5-E80F-4FF8-A2EF-B692EFF8CD50', 'REF11', 'https://sandbox.pagseguro.uol.com.br/checkout/payment/booklet/print.jhtml?c=120a06d59fadef3e9cf8b6e8b704e66b4241de2e4799e423733b2b86c531acf4294f639e687c9986', NULL),
(12, 1, '35.00', '-5.00', '0.00', '10.00', '0.00', '40.00', '2021-11-11 20:50:33', 'EXPRESS', 1, '74730190', 'Rua 11', 'Quadra 7 Lote 8', 's/n', 'Próximo a pizzaria Império da Pizza', 'FINISHED', 'CONFIRMED', 'IN_SEPARATION', 'BOLETO', NULL, 1, 1, 'F409407D-C7DF-4C14-A057-1A906FA35510', 'REF12', 'https://sandbox.pagseguro.uol.com.br/checkout/payment/booklet/print.jhtml?c=f6fa0fc229b28c002def0989bed3febb7c5811e7a8172d0a6c0ce820bbe2a8a6dbabd3803970bf31', NULL),
(13, 1, '95.00', '-15.00', '4.00', '10.00', '0.00', '86.00', '2021-11-12 17:13:59', 'EXPRESS', 1, '74730190', 'Rua 11', 'Quadra 7 Lote 8', 's/n', 'Próximo a pizzaria Império da Pizza', 'IN_PROGRESS', 'AWAITING_PAYMENT', 'NOT_STARTED', 'PIX', NULL, 1, 0, NULL, 'REF13', NULL, 1);

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
(12, 9, 2, 4, '25.00', '20.00', 1),
(13, 10, 1, 2, '35.00', '30.00', 1),
(14, 11, 1, 1, '35.00', '30.00', 1),
(15, 12, 1, 1, '35.00', '30.00', 1),
(16, 13, 2, 4, '25.00', '20.00', 1),
(17, 13, 1, 1, '35.00', '30.00', 2);

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
  `img_number` int(11) UNSIGNED NOT NULL DEFAULT '0',
  `position` tinyint(3) UNSIGNED NOT NULL,
  `visible` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `products`
--

INSERT INTO `products` (`id`, `name`, `price`, `price_in_cash`, `description`, `img_number`, `position`, `visible`) VALUES
(1, 'T-Shirt Exemplo', '35.00', '30.00', 'Exemplo de descrição', 1, 1, 1),
(2, 'Cropped Exemplo', '25.00', '20.00', 'Exemplo de descrição<br/>pro cropped', 1, 2, 1),
(5, 'Body Preto', '35.00', '34.00', 'Exemplo de descrição<br/>Com duas linhas<br/>Ou talvez três<br/><br/>Que tal cinco?', 1, 21, 1),
(6, 'Body Rosa', '35.00', '33.00', 'Teste', 1, 123, 0);

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
(43, 1, 1),
(45, 1, 2),
(4, 2, 1),
(3, 2, 4),
(47, 5, 1),
(49, 5, 3),
(38, 6, 1),
(40, 6, 2);

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
(1, 1, 1, 11, 'IN_ORDER'),
(2, 1, 2, 10, 'IN_ORDER'),
(3, 1, 1, 12, 'IN_ORDER'),
(4, 2, 4, 9, 'IN_ORDER'),
(5, 2, 4, 13, 'IN_ORDER'),
(6, 1, 1, 13, 'IN_ORDER'),
(7, 1, 1, 13, 'IN_ORDER');

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
(8, 1, 4),
(4, 2, 4),
(10, 6, 1);

-- --------------------------------------------------------

--
-- Estrutura da tabela `profiles`
--

CREATE TABLE `profiles` (
  `id` int(11) NOT NULL,
  `name` varchar(50) COLLATE utf8_bin NOT NULL,
  `users_module` tinyint(1) NOT NULL,
  `profiles_module` tinyint(1) NOT NULL,
  `products_module` tinyint(1) NOT NULL,
  `product_categories_module` tinyint(1) NOT NULL,
  `sizes_module` tinyint(1) NOT NULL,
  `product_inventory_module` tinyint(1) NOT NULL,
  `customers_module` tinyint(1) NOT NULL,
  `orders_module` tinyint(1) NOT NULL,
  `cities_module` tinyint(1) NOT NULL,
  `districts_module` tinyint(1) NOT NULL,
  `coupons_module` tinyint(1) NOT NULL,
  `consultants_module` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `profiles`
--

INSERT INTO `profiles` (`id`, `name`, `users_module`, `profiles_module`, `products_module`, `product_categories_module`, `sizes_module`, `product_inventory_module`, `customers_module`, `orders_module`, `cities_module`, `districts_module`, `coupons_module`, `consultants_module`) VALUES
(1, 'Administrador', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1),
(2, 'Funcionario', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(14, 'Entregador', 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0);

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
(3, 'G'),
(2, 'M'),
(1, 'P'),
(4, 'Único');

-- --------------------------------------------------------

--
-- Estrutura da tabela `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(12) COLLATE utf8_bin NOT NULL,
  `password` char(60) COLLATE utf8_bin NOT NULL,
  `profile_id` int(11) NOT NULL,
  `active` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `profile_id`, `active`) VALUES
(1, 'pedro', '$2a$08$/TaLh7HToYBoK2EAbFm/XuEbfhqFHmIIv6kHs8N9MzzHAEpt84nD2', 1, 1),
(5, 'inativo', '$2a$08$fJGSGyaZJxWSBWYoB/KDaea48LNOs6rb0Mo57VxwcvB3RfWpUeD.u', 1, 0),
(19, 'funcionario', '$2a$08$levjn9rylDTqBkAZQzR4quDasXbrO97Z/6WCsyUD.5YvX3M4t1uiC', 2, 1),
(21, 'entregador', '$2a$08$aimm2PltzNaXeU31k5PMJ.XVbsrUgGwHcJA/9wVeJxdedal.V8v6i', 14, 1);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `cities`
--
ALTER TABLE `cities`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

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
  ADD UNIQUE KEY `product_id_2` (`product_id`,`category_id`),
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
  ADD UNIQUE KEY `product_id_2` (`product_id`,`size_id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `size_id` (`size_id`);

--
-- Indexes for table `profiles`
--
ALTER TABLE `profiles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `secret_questions`
--
ALTER TABLE `secret_questions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `sizes`
--
ALTER TABLE `sizes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `profile_id` (`profile_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;
--
-- AUTO_INCREMENT for table `cities`
--
ALTER TABLE `cities`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;
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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=47;
--
-- AUTO_INCREMENT for table `customer_wishlist`
--
ALTER TABLE `customer_wishlist`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=68;
--
-- AUTO_INCREMENT for table `districts`
--
ALTER TABLE `districts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;
--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;
--
-- AUTO_INCREMENT for table `order_events`
--
ALTER TABLE `order_events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
--
-- AUTO_INCREMENT for table `order_products`
--
ALTER TABLE `order_products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;
--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;
--
-- AUTO_INCREMENT for table `product_categories`
--
ALTER TABLE `product_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=50;
--
-- AUTO_INCREMENT for table `product_inventory`
--
ALTER TABLE `product_inventory`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;
--
-- AUTO_INCREMENT for table `product_sizes`
--
ALTER TABLE `product_sizes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;
--
-- AUTO_INCREMENT for table `profiles`
--
ALTER TABLE `profiles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;
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
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;
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

--
-- Limitadores para a tabela `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
