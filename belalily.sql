-- phpMyAdmin SQL Dump
-- version 4.7.0
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: 26-Nov-2021 às 07:07
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
CREATE DEFINER=`root`@`localhost` PROCEDURE `addProductInventory` (`product_id` INT, `size_id` INT, `status` ENUM('AVAILABLE','UNAVAILABLE'), `reason` VARCHAR(100), `user_id` INT)  BEGIN

    DECLARE success BOOLEAN DEFAULT FALSE;
    DECLARE product_inventory_id INT DEFAULT 0;
    
    START TRANSACTION;
        
    INSERT INTO `product_inventory`(`product_id`, `size_id`, `status`) VALUES (product_id, size_id, status);

    SET product_inventory_id = LAST_INSERT_ID();

    INSERT INTO `product_inventory_events`(`date`, `type`, `description`, `product_inventory_id`, `user_id`) VALUES (NOW(), 'STATUS_UPDATE', concat('Estado inicial: ', status, '\nMotivo: ', reason), product_inventory_id, user_id);

    SET success = TRUE; 
    COMMIT;
    
    SELECT success, product_inventory_id;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `cancelOrder` (`order_id` INT, `reason` VARCHAR(100), `user_id` INT)  BEGIN

	DECLARE success BOOLEAN DEFAULT FALSE;
    DECLARE coupon_id INT DEFAULT NULL;

    DECLARE done TINYINT DEFAULT FALSE;
    DECLARE product_inventory_id INT;
    DECLARE c CURSOR FOR SELECT id FROM product_inventory WHERE product_inventory.order_id = order_id;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
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
                    orders.payment_status = 'CANCELED'
                LIMIT 1
                )
             THEN

                UPDATE orders SET status = 'CANCELED' WHERE orders.id = order_id;

                OPEN c;loop1: LOOP

                    FETCH NEXT FROM c INTO product_inventory_id; 
                    IF done THEN
                        LEAVE loop1; 
                    ELSE
                        INSERT INTO `product_inventory_events`(`date`, `type`, `description`, `product_inventory_id`) VALUES (NOW(), 'STATUS_UPDATE', concat('De: ', 'IN_ORDER', '\nPara: ', 'AVAILABLE', '\nMotivo: ', 'Produto desvinculado do pedido id ', order_id, ' por cancelamento do pedido'), product_inventory_id);

                        UPDATE product_inventory SET status = 'AVAILABLE', product_inventory.order_id = NULL WHERE product_inventory.id = product_inventory_id;
                    END IF;

                END LOOP;

                SELECT orders.coupon_id INTO coupon_id FROM orders WHERE orders.id = order_id;
                IF coupon_id IS NOT NULL THEN
                    UPDATE coupons SET coupons.uses = (coupons.uses - 1) WHERE coupons.id = coupon_id;
                END IF;
                INSERT INTO `order_events`(`date`, `type`, `description`, `order_id`, `user_id`) VALUES (NOW(), 'STATUS_UPDATE', concat('De: ', 'IN_PROGRESS', '\nPara: ', 'CANCELED', '\nMotivo: ', reason), order_id, user_id);
                COMMIT;
                SET success = TRUE;
    ELSE
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'order not found';
        ROLLBACK;
    END IF;
    
    SELECT success;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `createOrder` (`customer_id` INT, `subtotal` DECIMAL(10,2), `extra_amount` DECIMAL(10,2), `coupon_discount` DECIMAL(10,2), `shipping_cost` DECIMAL(10,2), `fees` DECIMAL(10,2), `total` DECIMAL(10,2), `shipping_type` ENUM('FREE','NORMAL','EXPRESS'), `shipping_district_id` INT, `shipping_cep` VARCHAR(8), `shipping_street` VARCHAR(15), `shipping_complement` VARCHAR(20), `shipping_number` VARCHAR(10), `shipping_address_observation` VARCHAR(50), `payment_method` ENUM('PIX','BOLETO','CREDIT'), `payment_installment_quantity` INT, `payment_in_cash` BOOLEAN, `payment_pagseguro` BOOLEAN, `coupon_id` INT, `products` VARCHAR(1000))  BEGIN

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
    DECLARE j INT default 0;
    DECLARE product_inventory_id INT;

    DECLARE payment_status ENUM('NOT_STARTED', 'AWAITING_PAYMENT') DEFAULT 'NOT_STARTED';

    IF payment_method = 'PIX' THEN
        SET payment_status = 'AWAITING_PAYMENT';
    END IF;
    
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

            SET j = 1;loop4: WHILE j <= quantity DO

                SELECT product_inventory.id INTO product_inventory_id FROM product_inventory WHERE product_inventory.product_id = product_id AND product_inventory.size_id = size_id AND product_inventory.status = 'AVAILABLE' LIMIT 1;

                INSERT INTO `product_inventory_events`(`date`, `type`, `description`, `product_inventory_id`) VALUES (NOW(), 'STATUS_UPDATE', concat('De: ', 'AVAILABLE', '\nPara: ', 'IN_ORDER', '\nMotivo: ', 'Produto vinculado ao pedido id ', order_id), product_inventory_id);
            
                UPDATE product_inventory SET `order_id`=order_id,`status`='IN_ORDER' WHERE id = product_inventory_id;

                SET j = j + 1;
            END WHILE loop4;


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

    DECLARE done TINYINT DEFAULT FALSE;
    DECLARE product_inventory_id INT;
    DECLARE c CURSOR FOR SELECT id FROM product_inventory WHERE product_inventory.order_id = order_id;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
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

                OPEN c;loop1: LOOP

                    FETCH NEXT FROM c INTO product_inventory_id; 
                    IF done THEN
                        LEAVE loop1; 
                    ELSE
                        INSERT INTO `product_inventory_events`(`date`, `type`, `description`, `product_inventory_id`) VALUES (NOW(), 'STATUS_UPDATE', concat('De: ', 'IN_ORDER', '\nPara: ', 'AVAILABLE', '\nMotivo: ', 'Produto desvinculado do pedido id ', order_id, ' por exclusão do pedido'), product_inventory_id);

                        UPDATE product_inventory SET status = 'AVAILABLE', product_inventory.order_id = NULL WHERE product_inventory.id = product_inventory_id;
                    END IF;

                END LOOP;

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

CREATE DEFINER=`root`@`localhost` PROCEDURE `updateOrderPaymentStatus` (`order_id` INT, `payment_status` ENUM('AWAITING_PAYMENT','CONFIRMED','CANCELED'), `reason` VARCHAR(100), `user_id` INT)  BEGIN

    DECLARE success BOOLEAN DEFAULT FALSE;
    DECLARE current_status VARCHAR(50);
    DECLARE current_payment_status VARCHAR(50);
    
    START TRANSACTION;
    
    SELECT orders.status, orders.payment_status INTO current_status, current_payment_status FROM orders WHERE id = order_id;

    IF (current_status = 'IN_PROGRESS' AND current_payment_status != payment_status) THEN

	    UPDATE `orders` SET `payment_status` = payment_status WHERE id = order_id;

        INSERT INTO `order_events`(`date`, `type`, `description`, `order_id`, `user_id`) VALUES (NOW(), 'PAYMENT_STATUS_UPDATE', concat('De: ', current_payment_status, '\nPara: ', payment_status, '\nMotivo: ', reason), order_id, user_id);

	    SET success = TRUE; 
	    COMMIT;
    ELSE
    	SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'order not found';
        ROLLBACK;
    END IF;

    
    SELECT success;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `updateOrderShippingStatus` (`order_id` INT, `shipping_status` ENUM('NOT_STARTED','IN_SEPARATION','READY_FOR_DELIVERY','OUT_TO_DELIVERY','DELIVERED','DELIVERY_FAILURE'), `reason` VARCHAR(100), `user_id` INT)  BEGIN

    DECLARE success BOOLEAN DEFAULT FALSE;
    DECLARE current_status VARCHAR(50);
    DECLARE current_shipping_status VARCHAR(50);
    
    START TRANSACTION;
    
    SELECT orders.status, orders.shipping_status INTO current_status, current_shipping_status FROM orders WHERE id = order_id;

    IF (current_status = 'IN_PROGRESS' AND current_shipping_status != shipping_status) THEN

	    UPDATE `orders` SET `shipping_status` = shipping_status WHERE id = order_id;

        INSERT INTO `order_events`(`date`, `type`, `description`, `order_id`, `user_id`) VALUES (NOW(), 'SHIPPING_STATUS_UPDATE', concat('De: ', current_shipping_status, '\nPara: ', shipping_status, '\nMotivo: ', reason), order_id, user_id);

	    SET success = TRUE; 
	    COMMIT;
    ELSE
    	SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'order not found';
        ROLLBACK;
    END IF;

    
    SELECT success;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `updateOrderStatus` (`order_id` INT, `status` ENUM('IN_PROGRESS','FINISHED','CANCELED'), `reason` VARCHAR(100), `user_id` INT)  BEGIN

    DECLARE success BOOLEAN DEFAULT FALSE;
    DECLARE current_status ENUM('IN_PROGRESS', 'FINISHED', 'CANCELED', '') DEFAULT '';
    DECLARE current_payment_status VARCHAR(50);
    
    START TRANSACTION;
    
    SELECT orders.status, orders.payment_status INTO current_status, current_payment_status FROM orders WHERE id = order_id;

    IF ((status = 'FINISHED' AND current_status = 'IN_PROGRESS' AND current_payment_status = 'CONFIRMED') OR
        (status = 'CANCELED' AND current_status = 'IN_PROGRESS' AND current_payment_status = 'CANCELED') OR
        (status = 'IN_PROGRESS' AND current_status = 'FINISHED')) THEN

        IF (status = 'CANCELED') THEN
            CALL cancelOrder(order_id, reason, user_id);
        ELSE
    	   UPDATE `orders` SET `status` = status WHERE id = order_id;

           INSERT INTO `order_events`(`date`, `type`, `description`, `order_id`, `user_id`) VALUES (NOW(), 'STATUS_UPDATE', concat('De: ', current_status, '\nPara: ', status, '\nMotivo: ', reason), order_id, user_id);
        END IF;

	    SET success = TRUE; 
	    COMMIT;
    ELSE
    	SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'order not found';
        ROLLBACK;
    END IF;

    
    SELECT success, current_status;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `updateProductInventoryStatus` (`product_inventory_id` INT, `status` ENUM('AVAILABLE','UNAVAILABLE'), `reason` VARCHAR(100), `user_id` INT)  BEGIN

    DECLARE success BOOLEAN DEFAULT FALSE;
    DECLARE current_status ENUM('AVAILABLE', 'UNAVAILABLE', 'IN_ORDER', '') DEFAULT '';
    
    START TRANSACTION;
    
    SELECT product_inventory.status INTO current_status FROM product_inventory WHERE id = product_inventory_id;

    IF ((current_status = 'AVAILABLE' OR current_status = 'UNAVAILABLE') AND current_status != status) THEN
    	UPDATE `product_inventory` SET `status` = status WHERE id = product_inventory_id;

	    INSERT INTO `product_inventory_events`(`date`, `type`, `description`, `product_inventory_id`, `user_id`) VALUES (NOW(), 'STATUS_UPDATE', concat('De: ', current_status, '\nPara: ', status, '\nMotivo: ', reason), product_inventory_id, user_id);

	    SET success = TRUE; 
	    COMMIT;
    ELSE
    	SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'product_inventory not found';
        ROLLBACK;
    END IF;

    
    SELECT success, current_status;

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
  `code` varchar(20) COLLATE utf8_bin NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `consultants`
--

INSERT INTO `consultants` (`id`, `name`, `code`) VALUES
(1, 'Pedro Henrique', 'PEDROHENRI');

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
  `max_units` int(11) NOT NULL,
  `consultant_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `coupons`
--

INSERT INTO `coupons` (`id`, `code`, `type`, `value`, `minimum_amount`, `max_uses`, `uses`, `max_units`, `consultant_id`) VALUES
(1, '5PORCENTO', 'PERCENT', '5.00', '10.00', 1, 1, 4, NULL),
(2, '10BRUTO', 'GROSS', '10.00', '50.00', 1, 0, 6, NULL),
(3, '10DUPLO', 'TWO_PERCENT', '10.00', '0.00', 1, 0, 4, NULL),
(4, '5DUPLO', 'TWO_GROSS', '5.00', '30.00', 1, 0, 6, NULL),
(8, 'TESTE1234', 'PERCENT', '5.00', '4.00', 3, 0, 2, 1);

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
  `payment_status` enum('NOT_STARTED','AWAITING_PAYMENT','CONFIRMED','CANCELED') COLLATE utf8_bin NOT NULL,
  `shipping_status` enum('NOT_STARTED','IN_SEPARATION','READY_FOR_DELIVERY','OUT_TO_DELIVERY','DELIVERED','DELIVERY_FAILURE') COLLATE utf8_bin NOT NULL,
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
(10, 1, '35.00', '-5.00', '0.00', '10.00', '0.00', '40.00', '2021-11-11 20:48:18', 'FREE', 1, '74730190', 'Rua 11', 'Quadra 7 Lote 8', 's/n', 'Próximo a pizzaria Império da Pizza', 'IN_PROGRESS', 'AWAITING_PAYMENT', 'NOT_STARTED', 'PIX', NULL, 1, 0, NULL, 'REF10', NULL, NULL),
(11, 1, '35.00', '-5.00', '0.00', '10.00', '0.00', '40.00', '2021-11-11 20:48:38', 'NORMAL', 1, '74730190', 'Rua 11', 'Quadra 7 Lote 8', 's/n', 'Próximo a pizzaria Império da Pizza', 'CANCELED', 'AWAITING_PAYMENT', 'NOT_STARTED', 'BOLETO', NULL, 1, 1, '1F251DF5-E80F-4FF8-A2EF-B692EFF8CD50', 'REF11', 'https://sandbox.pagseguro.uol.com.br/checkout/payment/booklet/print.jhtml?c=120a06d59fadef3e9cf8b6e8b704e66b4241de2e4799e423733b2b86c531acf4294f639e687c9986', NULL),
(12, 1, '35.00', '-5.00', '0.00', '10.00', '0.00', '40.00', '2021-11-11 20:50:33', 'EXPRESS', 1, '74730190', 'Rua 11', 'Quadra 7 Lote 8', 's/n', 'Próximo a pizzaria Império da Pizza', 'FINISHED', 'CONFIRMED', 'IN_SEPARATION', 'BOLETO', NULL, 1, 1, 'F409407D-C7DF-4C14-A057-1A906FA35510', 'REF12', 'https://sandbox.pagseguro.uol.com.br/checkout/payment/booklet/print.jhtml?c=f6fa0fc229b28c002def0989bed3febb7c5811e7a8172d0a6c0ce820bbe2a8a6dbabd3803970bf31', NULL),
(13, 1, '95.00', '-15.00', '4.00', '10.00', '0.00', '86.00', '2021-11-12 17:13:59', 'EXPRESS', 1, '74730190', 'Rua 11', 'Quadra 7 Lote 8', 's/n', 'Próximo a pizzaria Império da Pizza', 'IN_PROGRESS', 'AWAITING_PAYMENT', 'NOT_STARTED', 'PIX', NULL, 1, 0, NULL, 'REF13', NULL, 1),
(16, 1, '200.00', '-30.00', '0.00', '10.00', '0.00', '180.00', '2021-11-25 19:44:37', 'EXPRESS', 1, '74730190', 'Rua 11', 'Quadra 7 Lote 8', 's/n', 'Próximo a pizzaria Império da Pizza', 'IN_PROGRESS', 'AWAITING_PAYMENT', 'NOT_STARTED', 'PIX', NULL, 1, 0, NULL, 'REF16', NULL, NULL),
(17, 1, '200.00', '-30.00', '0.00', '10.00', '0.00', '180.00', '2021-11-25 19:45:47', 'EXPRESS', 1, '74730190', 'Rua 11', 'Quadra 7 Lote 8', 's/n', 'Próximo a pizzaria Império da Pizza', 'IN_PROGRESS', 'AWAITING_PAYMENT', 'NOT_STARTED', 'PIX', NULL, 1, 0, NULL, 'REF17', NULL, NULL),
(22, 1, '25.00', '-5.00', '0.00', '10.00', '0.00', '30.00', '2021-11-25 20:16:28', 'EXPRESS', 1, '74730190', 'Rua 11', 'Quadra 7 Lote 8', 's/n', 'Próximo a pizzaria Império da Pizza', 'IN_PROGRESS', 'AWAITING_PAYMENT', 'NOT_STARTED', 'BOLETO', NULL, 1, 1, '67B1DB70-58A0-4F96-8688-FB97F062B97E', 'REF22', 'https://sandbox.pagseguro.uol.com.br/checkout/payment/booklet/print.jhtml?c=82ac83fab168705d5fb68b69ab6cfd0ee46697161a789d1422c7acd4c21c0f581b18fd716862031f', NULL),
(23, 1, '35.00', '-5.00', '0.00', '10.00', '0.00', '40.00', '2021-11-26 00:49:57', 'EXPRESS', 1, '74730190', 'Rua 11', 'Quadra 7 Lote 8', 's/n', 'Próximo a pizzaria Império da Pizza', 'IN_PROGRESS', 'AWAITING_PAYMENT', 'DELIVERY_FAILURE', 'PIX', NULL, 1, 0, NULL, 'REF23', NULL, NULL),
(24, 1, '35.00', '-5.00', '0.00', '10.00', '0.00', '40.00', '2021-11-26 00:50:17', 'EXPRESS', 1, '74730190', 'Rua 11', 'Quadra 7 Lote 8', 's/n', 'Próximo a pizzaria Império da Pizza', 'IN_PROGRESS', 'CONFIRMED', 'DELIVERY_FAILURE', 'BOLETO', NULL, 1, 1, '825B1FCD-C842-447F-B6FB-9F15C5A556B4', 'REF24', 'https://sandbox.pagseguro.uol.com.br/checkout/payment/booklet/print.jhtml?c=475a23a9f11addc22c2159877d54710299d9631b4ae0d12657b7f1dae7e800e6d7d90cb84ce985d1', NULL),
(25, 1, '35.00', '0.00', '0.00', '10.00', '6.26', '51.26', '2021-11-26 00:50:54', 'EXPRESS', 1, '74730190', 'Rua 11', 'Quadra 7 Lote 8', 's/n', 'Próximo a pizzaria Império da Pizza', 'FINISHED', 'CONFIRMED', 'DELIVERY_FAILURE', 'CREDIT', 8, 0, 1, '045D0DFD-F30D-4739-9704-AE5DF060CF1F', 'REF25', NULL, NULL);

-- --------------------------------------------------------

--
-- Estrutura da tabela `order_events`
--

CREATE TABLE `order_events` (
  `id` int(11) NOT NULL,
  `date` datetime NOT NULL,
  `type` enum('STATUS_UPDATE','PAYMENT_STATUS_UPDATE','SHIPPING_STATUS_UPDATE','OTHER') COLLATE utf8_bin NOT NULL,
  `description` varchar(500) COLLATE utf8_bin NOT NULL,
  `order_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `order_events`
--

INSERT INTO `order_events` (`id`, `date`, `type`, `description`, `order_id`, `user_id`) VALUES
(1, '2021-11-30 00:00:00', 'OTHER', 'teste', 25, 19),
(2, '2021-11-26 02:50:24', 'STATUS_UPDATE', 'De: IN_PROGRESS\nPara: CANCELED\nMotivo: teste', 25, 1),
(3, '2021-11-26 02:52:10', 'STATUS_UPDATE', 'De: IN_PROGRESS\nPara: FINISHED\nMotivo: teste', 24, 1),
(4, '2021-11-26 02:52:46', 'STATUS_UPDATE', 'De: FINISHED\nPara: IN_PROGRESS\nMotivo: aaa', 24, 1),
(5, '2021-11-26 02:59:27', 'STATUS_UPDATE', 'De: IN_PROGRESS\nPara: FINISHED\nMotivo: teste', 24, 1),
(6, '2021-11-26 02:59:41', 'STATUS_UPDATE', 'De: FINISHED\nPara: IN_PROGRESS\nMotivo: agr', 24, 1),
(7, '2021-11-26 03:00:02', 'STATUS_UPDATE', 'De: IN_PROGRESS\nPara: CANCELED\nMotivo: cancelar', 25, 1),
(8, '2021-11-26 03:05:04', 'STATUS_UPDATE', 'De: IN_PROGRESS\nPara: CANCELED\nMotivo: sim', 25, 1),
(9, '2021-11-26 03:13:28', 'STATUS_UPDATE', 'De: IN_PROGRESS\nPara: FINISHED\nMotivo: a', 25, 1),
(10, '2021-11-26 03:40:25', 'PAYMENT_STATUS_UPDATE', 'De: CONFIRMED\nPara: AWAITING_PAYMENT\nMotivo: teste', 24, 1),
(11, '2021-11-26 03:40:36', 'PAYMENT_STATUS_UPDATE', 'De: AWAITING_PAYMENT\nPara: CONFIRMED\nMotivo: aa', 24, 1),
(12, '2021-11-26 03:40:53', 'PAYMENT_STATUS_UPDATE', 'De: CONFIRMED\nPara: CANCELED\nMotivo: q', 24, 1),
(13, '2021-11-26 04:02:03', 'SHIPPING_STATUS_UPDATE', 'De: NOT_STARTED\nPara: IN_SEPARATION\nMotivo: teste', 24, 1),
(14, '2021-11-26 04:02:23', 'SHIPPING_STATUS_UPDATE', 'De: IN_SEPARATION\nPara: READY_FOR_DELIVERY\nMotivo: teste', 24, 1),
(15, '2021-11-26 04:02:49', 'PAYMENT_STATUS_UPDATE', 'De: CANCELED\nPara: CONFIRMED\nMotivo: a', 24, 1),
(16, '2021-11-26 04:02:55', 'STATUS_UPDATE', 'De: IN_PROGRESS\nPara: FINISHED\nMotivo: a', 24, 1),
(17, '2021-11-26 04:03:01', 'STATUS_UPDATE', 'De: FINISHED\nPara: IN_PROGRESS\nMotivo: a', 24, 1),
(18, '2021-11-26 04:03:06', 'SHIPPING_STATUS_UPDATE', 'De: READY_FOR_DELIVERY\nPara: OUT_TO_DELIVERY\nMotivo: a', 24, 1),
(19, '2021-11-26 04:03:17', 'SHIPPING_STATUS_UPDATE', 'De: NOT_STARTED\nPara: DELIVERY_FAILURE\nMotivo: a', 23, 1),
(20, '2021-11-26 04:03:34', 'SHIPPING_STATUS_UPDATE', 'De: OUT_TO_DELIVERY\nPara: DELIVERY_FAILURE\nMotivo: a', 24, 1);

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
(17, 13, 1, 1, '35.00', '30.00', 2),
(24, 16, 2, 4, '25.00', '20.00', 1),
(25, 16, 1, 2, '35.00', '30.00', 2),
(26, 16, 1, 3, '35.00', '30.00', 3),
(27, 17, 2, 4, '25.00', '20.00', 1),
(28, 17, 1, 2, '35.00', '30.00', 2),
(29, 17, 1, 3, '35.00', '30.00', 3),
(42, 22, 2, 4, '25.00', '20.00', 1),
(43, 23, 1, 1, '35.00', '30.00', 1),
(44, 24, 1, 1, '35.00', '30.00', 1),
(45, 25, 1, 1, '35.00', '30.00', 1);

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
(6, 'Body Rosa', '35.00', '33.00', 'Teste', 1, 123, 1);

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
(7, 1, 1, 13, 'IN_ORDER'),
(14, 1, 4, NULL, 'AVAILABLE'),
(15, 1, 1, 23, 'IN_ORDER'),
(16, 1, 4, NULL, 'AVAILABLE'),
(17, 1, 4, NULL, 'UNAVAILABLE'),
(18, 1, 1, 24, 'IN_ORDER'),
(19, 1, 1, NULL, 'AVAILABLE'),
(20, 1, 1, NULL, 'AVAILABLE'),
(21, 1, 1, NULL, 'AVAILABLE'),
(22, 1, 2, NULL, 'AVAILABLE'),
(23, 1, 2, NULL, 'AVAILABLE'),
(24, 1, 3, NULL, 'AVAILABLE'),
(25, 1, 3, NULL, 'AVAILABLE'),
(26, 1, 3, NULL, 'AVAILABLE'),
(27, 2, 4, 22, 'IN_ORDER');

-- --------------------------------------------------------

--
-- Estrutura da tabela `product_inventory_events`
--

CREATE TABLE `product_inventory_events` (
  `id` int(11) NOT NULL,
  `date` datetime NOT NULL,
  `type` enum('STATUS_UPDATE','OTHER') COLLATE utf8_bin NOT NULL,
  `description` varchar(500) COLLATE utf8_bin NOT NULL,
  `product_inventory_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `product_inventory_events`
--

INSERT INTO `product_inventory_events` (`id`, `date`, `type`, `description`, `product_inventory_id`, `user_id`) VALUES
(1, '2021-11-10 00:00:00', 'STATUS_UPDATE', 'Alterado de A para B por C', 1, NULL),
(5, '2021-11-25 02:01:00', 'STATUS_UPDATE', 'Unidade adicionada pelo usuário id 1\nEstado inicial: AVAILABLE', 14, 1),
(6, '2021-11-25 02:11:12', 'STATUS_UPDATE', 'Unidade adicionada pelo usuário id 1\nEstado inicial: AVAILABLE', 15, 1),
(7, '2021-11-25 02:12:20', 'STATUS_UPDATE', 'Estado inicial: AVAILABLE', 16, 1),
(8, '2021-11-25 02:48:00', 'STATUS_UPDATE', 'De: AVAILABLE Para: AVAILABLE', 1, 1),
(9, '2021-11-25 02:48:43', 'STATUS_UPDATE', 'De: AVAILABLE Para: AVAILABLE', 1, 1),
(10, '2021-11-25 02:49:30', 'STATUS_UPDATE', 'De:  Para: AVAILABLE', 1, 1),
(13, '2021-11-25 02:51:50', 'STATUS_UPDATE', 'De: AVAILABLE Para: UNAVAILABLE', 14, 1),
(14, '2021-11-25 02:52:29', 'STATUS_UPDATE', 'De: UNAVAILABLE Para: AVAILABLE', 14, NULL),
(15, '2021-11-25 02:53:21', 'STATUS_UPDATE', 'De: AVAILABLE Para: UNAVAILABLE Motivo: motivo de teste', 14, 1),
(16, '2021-11-25 02:53:59', 'STATUS_UPDATE', 'De: UNAVAILABLE Para: UNAVAILABLE Motivo: hahaha', 14, 1),
(17, '2021-11-25 02:54:11', 'STATUS_UPDATE', 'De: UNAVAILABLE Para: AVAILABLE Motivo: hahahaha', 14, 1),
(18, '2021-11-25 02:55:36', 'STATUS_UPDATE', 'De: AVAILABLE Para: UNAVAILABLE Motivo: 11', 14, 1),
(19, '2021-11-25 02:57:00', 'STATUS_UPDATE', 'De: UNAVAILABLE Para: AVAILABLE Motivo: pq eu quis', 14, 1),
(20, '2021-11-25 02:57:52', 'STATUS_UPDATE', 'Estado inicial: UNAVAILABLE', 17, 1),
(21, '2021-11-25 02:58:31', 'STATUS_UPDATE', 'De: UNAVAILABLE Para: AVAILABLE Motivo: Unidade colocada no estoque', 17, 1),
(22, '2021-11-25 02:58:48', 'STATUS_UPDATE', 'De: AVAILABLE Para: UNAVAILABLE Motivo: !@#E!@1- 1231 1´´', 17, 1),
(23, '2021-11-25 02:59:26', 'STATUS_UPDATE', 'De: UNAVAILABLE Para: AVAILABLE Motivo: \'a\' or \'1\' \'', 17, 1),
(24, '2021-11-25 03:04:52', 'STATUS_UPDATE', 'De: AVAILABLE Para: UNAVAILABLE\nMotivo: Exemplo de motivo', 17, 1),
(25, '2021-11-25 03:07:23', 'STATUS_UPDATE', 'De: UNAVAILABLE\nPara: AVAILABLE\nMotivo: Outro exemplo de motivo', 17, 1),
(26, '2021-11-25 03:29:29', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: UNAVAILABLE\nMotivo: teste', 17, 1),
(27, '2021-11-25 03:49:27', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: UNAVAILABLE\nMotivo: aaa', 15, 1),
(28, '2021-11-25 03:49:37', 'STATUS_UPDATE', 'De: UNAVAILABLE\nPara: AVAILABLE\nMotivo: bbbb', 15, 1),
(29, '2021-11-25 04:00:36', 'STATUS_UPDATE', 'Estado inicial: AVAILABLE', 18, 1),
(30, '2021-11-25 04:00:47', 'STATUS_UPDATE', 'Estado inicial: AVAILABLE', 19, 1),
(31, '2021-11-25 04:05:58', 'STATUS_UPDATE', 'Estado inicial: AVAILABLE', 20, 1),
(32, '2021-11-25 04:06:08', 'STATUS_UPDATE', 'Estado inicial: AVAILABLE', 21, 1),
(33, '2021-11-25 04:19:20', 'STATUS_UPDATE', 'Estado inicial: UNAVAILABLE\nMotivo: Quis adicionar um M', 22, 1),
(34, '2021-11-25 04:23:08', 'STATUS_UPDATE', 'De: UNAVAILABLE\nPara: AVAILABLE\nMotivo: a', 22, 1),
(35, '2021-11-25 19:30:52', 'STATUS_UPDATE', 'Estado inicial: AVAILABLE\nMotivo: teste', 23, 1),
(36, '2021-11-25 19:30:59', 'STATUS_UPDATE', 'Estado inicial: AVAILABLE\nMotivo: teste', 24, 1),
(37, '2021-11-25 19:31:00', 'STATUS_UPDATE', 'Estado inicial: AVAILABLE\nMotivo: teste', 25, 1),
(38, '2021-11-25 19:31:03', 'STATUS_UPDATE', 'Estado inicial: AVAILABLE\nMotivo: teste', 26, 1),
(39, '2021-11-25 19:31:29', 'STATUS_UPDATE', 'Estado inicial: AVAILABLE\nMotivo: teste', 27, 1),
(41, '2021-11-25 19:48:09', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 19', 27, NULL),
(42, '2021-11-25 19:48:09', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 19', 22, NULL),
(43, '2021-11-25 19:48:09', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 19', 23, NULL),
(44, '2021-11-25 19:48:09', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 19', 24, NULL),
(45, '2021-11-25 19:48:09', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 19', 25, NULL),
(46, '2021-11-25 19:48:09', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 19', 26, NULL),
(47, '2021-11-25 20:08:45', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 20', 27, NULL),
(48, '2021-11-25 20:08:45', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 20', 22, NULL),
(49, '2021-11-25 20:08:45', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 20', 23, NULL),
(50, '2021-11-25 20:08:45', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 20', 24, NULL),
(51, '2021-11-25 20:08:45', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 20', 25, NULL),
(52, '2021-11-25 20:08:45', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 20', 26, NULL),
(53, '2021-11-25 20:09:48', 'STATUS_UPDATE', 'De: IN_ORDER\nPara: AVAILABLE\nMotivo: Produto desvinculado do pedido id 20 por cancelamento do pedido', 22, NULL),
(54, '2021-11-25 20:09:48', 'STATUS_UPDATE', 'De: IN_ORDER\nPara: AVAILABLE\nMotivo: Produto desvinculado do pedido id 20 por cancelamento do pedido', 23, NULL),
(55, '2021-11-25 20:09:48', 'STATUS_UPDATE', 'De: IN_ORDER\nPara: AVAILABLE\nMotivo: Produto desvinculado do pedido id 20 por cancelamento do pedido', 24, NULL),
(56, '2021-11-25 20:09:48', 'STATUS_UPDATE', 'De: IN_ORDER\nPara: AVAILABLE\nMotivo: Produto desvinculado do pedido id 20 por cancelamento do pedido', 25, NULL),
(57, '2021-11-25 20:09:48', 'STATUS_UPDATE', 'De: IN_ORDER\nPara: AVAILABLE\nMotivo: Produto desvinculado do pedido id 20 por cancelamento do pedido', 26, NULL),
(58, '2021-11-25 20:09:48', 'STATUS_UPDATE', 'De: IN_ORDER\nPara: AVAILABLE\nMotivo: Produto desvinculado do pedido id 20 por cancelamento do pedido', 27, NULL),
(59, '2021-11-25 20:15:12', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 21', 27, NULL),
(60, '2021-11-25 20:15:12', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 21', 22, NULL),
(61, '2021-11-25 20:15:12', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 21', 23, NULL),
(62, '2021-11-25 20:15:12', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 21', 24, NULL),
(63, '2021-11-25 20:15:12', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 21', 25, NULL),
(64, '2021-11-25 20:15:12', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 21', 26, NULL),
(65, '2021-11-25 20:15:41', 'STATUS_UPDATE', 'De: IN_ORDER\nPara: AVAILABLE\nMotivo: Produto desvinculado do pedido id 21 por exclusão do pedido', 22, NULL),
(66, '2021-11-25 20:15:41', 'STATUS_UPDATE', 'De: IN_ORDER\nPara: AVAILABLE\nMotivo: Produto desvinculado do pedido id 21 por exclusão do pedido', 23, NULL),
(67, '2021-11-25 20:15:41', 'STATUS_UPDATE', 'De: IN_ORDER\nPara: AVAILABLE\nMotivo: Produto desvinculado do pedido id 21 por exclusão do pedido', 24, NULL),
(68, '2021-11-25 20:15:41', 'STATUS_UPDATE', 'De: IN_ORDER\nPara: AVAILABLE\nMotivo: Produto desvinculado do pedido id 21 por exclusão do pedido', 25, NULL),
(69, '2021-11-25 20:15:41', 'STATUS_UPDATE', 'De: IN_ORDER\nPara: AVAILABLE\nMotivo: Produto desvinculado do pedido id 21 por exclusão do pedido', 26, NULL),
(70, '2021-11-25 20:15:41', 'STATUS_UPDATE', 'De: IN_ORDER\nPara: AVAILABLE\nMotivo: Produto desvinculado do pedido id 21 por exclusão do pedido', 27, NULL),
(71, '2021-11-25 20:16:28', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 22', 27, NULL),
(72, '2021-11-26 00:49:57', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 23', 15, NULL),
(73, '2021-11-26 00:50:17', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 24', 18, NULL),
(74, '2021-11-26 00:50:54', 'STATUS_UPDATE', 'De: AVAILABLE\nPara: IN_ORDER\nMotivo: Produto vinculado ao pedido id 25', 19, NULL),
(75, '2021-11-26 03:00:02', 'STATUS_UPDATE', 'De: IN_ORDER\nPara: AVAILABLE\nMotivo: Produto desvinculado do pedido id 25 por cancelamento do pedido', 19, NULL);

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
(11, 5, 4),
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
  `change_order_status` tinyint(1) NOT NULL,
  `change_order_payment_status` tinyint(1) NOT NULL,
  `change_order_shipping_status` tinyint(1) NOT NULL,
  `cities_module` tinyint(1) NOT NULL,
  `districts_module` tinyint(1) NOT NULL,
  `coupons_module` tinyint(1) NOT NULL,
  `consultants_module` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

--
-- Extraindo dados da tabela `profiles`
--

INSERT INTO `profiles` (`id`, `name`, `users_module`, `profiles_module`, `products_module`, `product_categories_module`, `sizes_module`, `product_inventory_module`, `customers_module`, `orders_module`, `change_order_status`, `change_order_payment_status`, `change_order_shipping_status`, `cities_module`, `districts_module`, `coupons_module`, `consultants_module`) VALUES
(1, 'Administrador', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1),
(2, 'Funcionario', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(14, 'Entregador', 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0);

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
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Indexes for table `coupons`
--
ALTER TABLE `coupons`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `consultant_id` (`consultant_id`);

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
  ADD KEY `order_id` (`order_id`),
  ADD KEY `user_id` (`user_id`);

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
-- Indexes for table `product_inventory_events`
--
ALTER TABLE `product_inventory_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`product_inventory_id`),
  ADD KEY `user_id` (`user_id`);

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;
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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;
--
-- AUTO_INCREMENT for table `order_events`
--
ALTER TABLE `order_events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;
--
-- AUTO_INCREMENT for table `order_products`
--
ALTER TABLE `order_products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=46;
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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;
--
-- AUTO_INCREMENT for table `product_inventory_events`
--
ALTER TABLE `product_inventory_events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=76;
--
-- AUTO_INCREMENT for table `product_sizes`
--
ALTER TABLE `product_sizes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;
--
-- AUTO_INCREMENT for table `profiles`
--
ALTER TABLE `profiles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;
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
-- Limitadores para a tabela `coupons`
--
ALTER TABLE `coupons`
  ADD CONSTRAINT `coupons_ibfk_1` FOREIGN KEY (`consultant_id`) REFERENCES `consultants` (`id`);

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
  ADD CONSTRAINT `order_events_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  ADD CONSTRAINT `order_events_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

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
-- Limitadores para a tabela `product_inventory_events`
--
ALTER TABLE `product_inventory_events`
  ADD CONSTRAINT `product_inventory_events_ibfk_1` FOREIGN KEY (`product_inventory_id`) REFERENCES `product_inventory` (`id`),
  ADD CONSTRAINT `product_inventory_events_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

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
