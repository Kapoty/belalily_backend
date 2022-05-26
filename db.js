const mysql = require('mysql');
const logger = require('./logger');

/*var config =
{
	host: '127.0.0.1',
	user: 'root',
	password: 'vertrigo',
	database: 'belalily',
	port: 3306,
	ssl: false,
	multipleStatements: true
};*/
const config = require('./db-config');

var conn;

function handleDisconnect() {
	conn = mysql.createConnection(config);  // Recreate the connection, since the old one cannot be reused.
	conn.connect( function onConnect(err) {   // The server is either down
		if (err) {                                  // or restarting (takes a while sometimes).
			logger.error('error when connecting to db:'+ err.code);
			setTimeout(handleDisconnect, 10000);    // We introduce a delay before attempting to reconnect,
		}                                           // to avoid a hot loop, and to allow our node script to
	});                                             // process asynchronous requests in the meantime.
													// If you're also serving http, display a 503 error.
	conn.on('error', function onError(err) {
		logger.error('db error' + err.code);
		if (err.code == 'PROTOCOL_CONNECTION_LOST' || err.code == 'ECONNRESET') {   // Connection to the MySQL server is usually
			handleDisconnect();                         // lost due to either server restart, or a
		}                                       // connnection idle timeout (the wait_timeout
												// server variable configures this)
	});
}

handleDisconnect();

function mysqlEscape(stringToEscape){
	if (typeof stringToEscape == 'number')
		stringToEscape = stringToEscape.toString();

	if(stringToEscape == '') {
		return stringToEscape;
	}

	if (!(typeof stringToEscape === 'string' || stringToEscape instanceof String)) {
		return '';
	}

	return stringToEscape
		.replace(/\\/g, "\\\\")
		.replace(/\'/g, "\\\'")
		.replace(/\"/g, "\\\"")
		.replace(/\n/g, "\\\n")
		.replace(/\r/g, "\\\r")
		.replace(/\x00/g, "\\\x00")
		.replace(/\x1a/g, "\\\x1a");
}

/* Categories */

function getCategoriesList(callback) {
	conn.query(`SELECT id, name, position FROM categories WHERE visible = 1;`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function getCategoriesListForModule(callback) {
	conn.query(`SELECT id, name, position, visible FROM categories WHERE 1;`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function getCategoriesListAll(callback) {
	conn.query(`SELECT id, name, position FROM categories WHERE 1;`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function addCategory(name, position, callback) {

	conn.query(`
			INSERT INTO categories(name, visible, position)
			VALUES ('${mysqlEscape(name)}', 0, '${mysqlEscape(position)}');
	   `, (error, results, fields) => {
		if (error) return callback(error)
		if (results.length < 1) return callback({code: 'UNEXPECTED', message: "unexpected"})
		else callback(null, results.insertId);
	});
}

function deleteCategoryById(categoryId, callback) {
	conn.query(`DELETE FROM categories WHERE id = '${mysqlEscape(categoryId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no category matches given id")
		else callback(null, null);
	});
}

function getCategoryInfo(categoryId, callback) {
	conn.query(`SELECT name, visible, position FROM categories WHERE id = '${mysqlEscape(categoryId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no category matches given id")
		else callback(null, results[0]);
	});
}

function updateCategoryById(categoryId, name, visible, position, callback) {
	conn.query(`UPDATE categories SET name='${mysqlEscape(name)}',visible=${Boolean(visible)},position='${mysqlEscape(position)}'
	 WHERE id = '${mysqlEscape(categoryId)}'`, (error, results, fields) => {
		if (error) return callback(error)
		if (results.affectedRows == 0) return callback({code: 'UNEXPECTED', message: "unexpected"});
		else callback(null, results);
	});
}

/* Products */

function getProductsList(callback) {
	conn.query(`SELECT id, name, price, price_in_cash, img_number, position,
		(SELECT GROUP_CONCAT(c.category_id) FROM product_categories c WHERE c.product_id = products.id)
		 AS categories,
		 (SELECT GROUP_CONCAT(s.size_id) FROM product_sizes s WHERE s.product_id = products.id)
		 AS sizes,
		 (SELECT EXISTS (SELECT pi.id FROM product_inventory pi WHERE pi.product_id = products.id AND status = 'AVAILABLE' LIMIT 1))
         as available
		 FROM products WHERE visible = 1;`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function getProductById(productId, callback) {
	conn.query(`SELECT products.*, 
		(SELECT GROUP_CONCAT(c.category_id) FROM product_categories c WHERE c.product_id = products.id)
		 AS categories,
		 (SELECT GROUP_CONCAT(s.size_id) FROM product_sizes s WHERE s.product_id = products.id)
		 AS sizes
		 FROM products WHERE products.id = ${mysqlEscape(productId)};`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no product matches given id")
		else callback(null, results[0]);
	});
}

function getProductInventoryBySize(productId, sizeId, callback) {
	conn.query(`SELECT COUNT(*) FROM product_inventory WHERE product_id = ${mysqlEscape(productId)}
		AND size_id = ${mysqlEscape(sizeId)} AND status = 'AVAILABLE';`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results[0]['COUNT(*)']);
	});
}

function getProductsListWithFilter(text, callback) {
	conn.query(`SELECT id, name, visible FROM products WHERE LOWER(name) LIKE LOWER('%${mysqlEscape(text)}%') OR id LIKE '%${mysqlEscape(text)}%';`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function addProduct(name, price, price_in_cash, description, position, callback) {
	conn.query(`
			INSERT INTO products(name, price, price_in_cash, description, position, visible)
			VALUES ('${mysqlEscape(name)}', ${mysqlEscape(price)}, ${mysqlEscape(price_in_cash)},
			'${mysqlEscape(description)}', ${mysqlEscape(position)}, 0);
	   `, (error, results, fields) => {
		if (error) return callback(error)
		if (results.length < 1) return callback({code: 'UNEXPECTED', message: "unexpected"})
		else callback(null, results.insertId);
	});
}

function deleteProductById(productId, callback) {
	conn.query(`DELETE FROM products WHERE id = '${mysqlEscape(productId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no product matches given id")
		else callback(null, null);
	});
}

function updateProductById(productId, name, price, price_in_cash, description, position, visible, callback) {
	conn.query(`UPDATE products SET name='${mysqlEscape(name)}',price=${mysqlEscape(price)},price_in_cash='${mysqlEscape(price_in_cash)}',
		description='${mysqlEscape(description)}',position='${mysqlEscape(position)}',visible=${Boolean(visible)}
	 WHERE id = '${mysqlEscape(productId)}'`, (error, results, fields) => {
		if (error) return callback(error)
		if (results.affectedRows == 0) return callback({code: 'UNEXPECTED', message: "unexpected"});
		else callback(null, results);
	});
}

function getProductCategories(productId, callback) {
	conn.query(`SELECT * FROM product_categories WHERE product_id = '${mysqlEscape(productId)}';`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function addProductCategory(productId, category_id, callback) {
	conn.query(`
			INSERT INTO product_categories(product_id, category_id)
			VALUES ('${mysqlEscape(productId)}', ${mysqlEscape(category_id)});
	   `, (error, results, fields) => {
		if (error) return callback(error)
		if (results.length < 1) return callback({code: 'UNEXPECTED', message: "unexpected"})
		else callback(null, results.insertId);
	});
}

function deleteProductCategory(productId, category_id, callback) {
	conn.query(`DELETE FROM product_categories WHERE product_id = '${mysqlEscape(productId)}' AND category_id = '${mysqlEscape(category_id)}';`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no product's category matches given id")
		else callback(null, null);
	});
}

function getProductSizes(productId, callback) {
	conn.query(`SELECT * FROM product_sizes WHERE product_id = '${mysqlEscape(productId)}';`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function addProductSize(productId, size_id, callback) {
	conn.query(`
			INSERT INTO product_sizes(product_id, size_id)
			VALUES ('${mysqlEscape(productId)}', ${mysqlEscape(size_id)});
	   `, (error, results, fields) => {
		if (error) return callback(error)
		if (results.length < 1) return callback({code: 'UNEXPECTED', message: "unexpected"})
		else callback(null, results.insertId);
	});
}

function deleteProductSize(productId, size_id, callback) {
	conn.query(`DELETE FROM product_sizes WHERE product_id = '${mysqlEscape(productId)}' AND size_id = '${mysqlEscape(size_id)}';`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no product's size matches given id")
		else callback(null, null);
	});
}

function getProductImages(productId, callback) {
	conn.query(`SELECT img_number FROM products WHERE id = '${mysqlEscape(productId)}';`, (error, results, fields) => {
		if (error) callback(error.code)
		if (results.length < 1) return callback("no product matches given id")
		else callback(null, results[0]);
	});
}

function existsProductById(productId, callback) {
	conn.query(`SELECT id FROM products WHERE id = '${mysqlEscape(productId)}';`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no product matches given id")
		else callback(null, results[0]);
	});
}

function updateProductImages(productId, img_number, callback) {
	conn.query(`UPDATE products SET img_number='${mysqlEscape(img_number)}'
	 WHERE id = '${mysqlEscape(productId)}'`, (error, results, fields) => {
		if (error) return callback(error)
		if (results.affectedRows == 0) return callback({code: 'UNEXPECTED', message: "unexpected"});
		else callback(null, results);
	});
}

function getProductInventoryListForModule(productId, callback) {
	conn.query(`SELECT id, size_id, order_id, status FROM product_inventory WHERE product_id = '${mysqlEscape(productId)}' ORDER BY status, size_id, id ASC;`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function addProductInventory(productId, size_id, status, reason, userId, callback) {
	conn.query(`
			CALL addProductInventory('${mysqlEscape(productId)}', '${mysqlEscape(size_id)}', '${mysqlEscape(status)}', '${mysqlEscape(reason)}', '${mysqlEscape(userId)}');
	   `, (error, results, fields) => {
		if (error) {
			return callback(error.code)
		}
		if (results.length < 1) return callback("couldnt add product_inventory")
		else callback(null, results[0][0]);
	});
}

function getProductInventoryEvents(productInventoryId, callback) {
	conn.query(`
		SELECT product_inventory_events.*, users.username AS user_username
		FROM product_inventory_events
		LEFT JOIN users ON users.id = product_inventory_events.user_id
		WHERE product_inventory_id = '${mysqlEscape(productInventoryId)}'
		ORDER BY date DESC;
		`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function getProductInventoryInfo(productInventoryId, callback) {
	conn.query(`SELECT status FROM product_inventory WHERE id = '${mysqlEscape(productInventoryId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no product_inventory matches given id")
		else callback(null, results[0]);
	});
}

function updateProductInventoryStatus(productInventoryId, status, reason, userId, callback) {
	conn.query(`
			CALL updateProductInventoryStatus('${mysqlEscape(productInventoryId)}', '${mysqlEscape(status)}', '${mysqlEscape(reason)}', '${mysqlEscape(userId)}');
	   `, (error, results, fields) => {
		if (error) {
			return callback(error.code)
		}
		if (results.length < 1 || !results[0][0].success) return callback("couldnt update product_inventory status")
		else callback(null, results[0][0]);
	});
}

/* Sizes */

function getSizesList(callback) {
	conn.query(`SELECT id, name FROM sizes WHERE 1 ORDER BY id ASC;`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function getSizesListForModule(callback) {
	conn.query(`SELECT id, name FROM sizes WHERE 1 ORDER BY id ASC;`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function addSize(name, callback) {

	conn.query(`
			INSERT INTO sizes(name)
			VALUES ('${mysqlEscape(name)}');
	   `, (error, results, fields) => {
		if (error) return callback(error)
		if (results.length < 1) return callback({code: 'UNEXPECTED', message: "unexpected"})
		else callback(null, results.insertId);
	});
}

function deleteSizeById(sizeId, callback) {
	conn.query(`DELETE FROM sizes WHERE id = '${mysqlEscape(sizeId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no size matches given id")
		else callback(null, null);
	});
}

function getSizeInfo(sizeId, callback) {
	conn.query(`SELECT name FROM sizes WHERE id = '${mysqlEscape(sizeId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no size matches given id")
		else callback(null, results[0]);
	});
}

function updateSizeById(sizeId, name, callback) {
	conn.query(`UPDATE sizes SET name='${mysqlEscape(name)}'
	 WHERE id = '${mysqlEscape(sizeId)}'`, (error, results, fields) => {
		if (error) return callback(error)
		if (results.affectedRows == 0) return callback({code: 'UNEXPECTED', message: "unexpected"});
		else callback(null, results);
	});
}

/* Customers */

function getCustomerByLogin(login, callback) {
	conn.query(`SELECT id, password FROM customers WHERE cpf = '${mysqlEscape(login)}' OR email = '${mysqlEscape(login)}';`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no customer matches given cpf/email")
		else callback(null, results[0]);
	});
}

function getCustomerInfo(customerId, callback) {
	conn.query(`SELECT name, desired_name, cpf, birthday, email, whatsapp, mobile, district_id, cep, street, complement, number, address_observation, secret_question_id, allow_email, allow_whatsapp FROM customers WHERE id = ${mysqlEscape(customerId)};`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no customer matches given id")
		else callback(null, results[0]);
	});
}

function registerCustomer(name, desired_name, cpf, birthday_day, birthday_month, birthday_year, mobile, whatsapp,
	cep, district_id, street, number, complement, address_observation, email, password,
	secret_question_id, secret_answer, allow_email, allow_whatsapp, consultant_code, callback
	) {

	conn.query(`
			INSERT INTO customers(name, desired_name, cpf, birthday, registration_datetime, email, password, consultant_id,
			whatsapp, mobile, district_id, cep, street, complement, number,
			address_observation, secret_question_id, secret_answer, allow_email, allow_whatsapp)
			VALUES ('${mysqlEscape(name)}', '${mysqlEscape(desired_name)}', '${mysqlEscape(cpf)}', '${mysqlEscape(birthday_year + '-' + String(parseInt(birthday_month)+1).padStart(2, '0') + '-' + String(birthday_day).padStart(2, '0'))}',
			NOW(), '${mysqlEscape(email)}', '${mysqlEscape(password)}', (SELECT id FROM consultants WHERE consultants.code = '${mysqlEscape(consultant_code)}'),
			'${mysqlEscape(whatsapp)}', '${mysqlEscape(mobile)}', '${mysqlEscape(district_id)}', '${mysqlEscape(cep)}', '${mysqlEscape(street)}', '${mysqlEscape(complement)}',
			'${mysqlEscape(number)}', '${mysqlEscape(address_observation)}', '${mysqlEscape(secret_question_id)}', '${mysqlEscape(secret_answer)}', ${allow_email},
			${allow_whatsapp});
	   `, (error, results, fields) => {
		if (error) return callback(error)
		if (results.length < 1) return callback({code: 'UNEXPECTED', message: "unexpected"})
		else callback(null, results.insertId);
	});
}

function getCustomerForResetPassword(cpf, birthday_day, birthday_month, birthday_year, secret_question_id, callback) {
	conn.query(`SELECT id, secret_answer FROM customers WHERE cpf = '${mysqlEscape(cpf)}' AND secret_question_id = '${mysqlEscape(secret_question_id)}' AND birthday = '${mysqlEscape(birthday_year + '-' + String(parseInt(birthday_month)+1).padStart(2, '0') + '-' + String(birthday_day).padStart(2, '0'))}';`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("wrong information")
		else callback(null, results[0]);
	});
};

function resetCustomerPassword(customerId, password, callback) {
	conn.query(`UPDATE customers SET password='${mysqlEscape(password)}' WHERE id = '${mysqlEscape(customerId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.affectedRows == 0) return callback('wrong information');
		else callback(null, results);
	});
}

function updateCustomerPersonalInfo(customerId, name, desired_name, birthday_day, birthday_month, birthday_year, mobile, whatsapp, callback) {
	conn.query(`UPDATE customers SET name='${mysqlEscape(name)}', desired_name='${mysqlEscape(desired_name)}',
		birthday='${mysqlEscape(birthday_year + '-' + String(parseInt(birthday_month)+1).padStart(2, '0') + '-' + String(birthday_day).padStart(2, '0'))}',
		mobile='${mysqlEscape(mobile)}', whatsapp='${mysqlEscape(whatsapp)}'
	 WHERE id = '${mysqlEscape(customerId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.affectedRows == 0) return callback('unexpected error');
		else callback(null, results);
	});
}

function updateCustomerAddress(customerId, cep, district_id, street, number, complement, address_observation, callback) {
	conn.query(`UPDATE customers SET cep='${mysqlEscape(cep)}', district_id='${mysqlEscape(district_id)}',
		street='${mysqlEscape(street)}', number='${mysqlEscape(number)}',
		complement='${mysqlEscape(complement)}', address_observation='${mysqlEscape(address_observation)}'
	 WHERE id = '${mysqlEscape(customerId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.affectedRows == 0) return callback('unexpected error');
		else callback(null, results);
	});
}

function getCustomerForUpdatePassword(customerId, callback) {
	conn.query(`SELECT password FROM customers WHERE id = '${mysqlEscape(customerId)}';`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no customer matches given id")
		else callback(null, results[0]);
	});
}

function updateCustomerRecover(customerId, secret_question_id, secret_answer, callback) {
	conn.query(`UPDATE customers SET secret_question_id='${mysqlEscape(secret_question_id)}', secret_answer='${mysqlEscape(secret_answer)}'
	 WHERE id = '${mysqlEscape(customerId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.affectedRows == 0) return callback('unexpected error');
		else callback(null, results);
	});
}

function updateCustomerNotification(customerId, allow_email, allow_whatsapp, callback) {
	conn.query(`UPDATE customers SET allow_email=${Boolean(allow_email)}, allow_whatsapp=${Boolean(allow_whatsapp)}
	 WHERE id = '${mysqlEscape(customerId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.affectedRows == 0) return callback('unexpected error');
		else callback(null, results);
	});
}

function getCustomerWishlist(customerId, callback) {
	conn.query(`
		SELECT
			customer_wishlist.id,
			customer_wishlist.product_id,
			customer_wishlist.size_id,
			customer_wishlist.favorited_datetime,
			products.id AS product_id,
			products.name AS product_name,
			products.img_number AS product_img_number,
			EXISTS
				(
				SELECT
					id
				FROM
					product_inventory
				WHERE
					product_inventory.product_id = customer_wishlist.product_id AND product_inventory.size_id = customer_wishlist.size_id AND
					product_inventory.status = 'AVAILABLE'
				LIMIT 1
			) AS product_isAvailable
		FROM
			customer_wishlist
		LEFT JOIN products ON products.id = customer_wishlist.product_id
		WHERE
			customer_id = ${mysqlEscape(customerId)};
	`, (error, results, fields) => {
		if (error) return callback(error.code)
		else callback(null, results);
	});
}

function addProductToCustomerWishlist(customerId, productId, sizeId, callback) {
	conn.query(` 
		INSERT INTO
			customer_wishlist(
				customer_id,
				product_id,
				size_id,
				favorited_datetime
			)
		VALUES(
			'${mysqlEscape(customerId)}',
			'${mysqlEscape(productId)}',
			'${mysqlEscape(sizeId)}',
			NOW()
		)
	`, (error, results, fields) => {
		if (error) return callback(error.code)
		else callback(null, results);
	});
}

function deleteProductFromCustomerWishlist(customerId, productId, sizeId, callback) {
	conn.query(` 
		DELETE FROM customer_wishlist
		WHERE
			customer_id = '${mysqlEscape(customerId)}'
			AND product_id = '${mysqlEscape(productId)}'
			AND size_id = '${mysqlEscape(sizeId)}';
	`, (error, results, fields) => {
		if (error) return callback(error.code)
		else callback(null, results);
	});
}

function getCustomerOrdersList(customerId, callback) {
	conn.query(`
		SELECT id, total, status, payment_status, payment_method, creation_datetime, payment_installment_quantity
		FROM orders
		WHERE
			customer_id = ${mysqlEscape(customerId)}
		ORDER BY creation_datetime DESC;
	`, (error, results, fields) => {
		if (error) return callback(error.code)
		else callback(null, results);
	});
}

function getCustomerOrderById(customerId, orderId, callback) {
	conn.query(`
		SELECT o.id, o.total, o.subtotal, o.extra_amount, o.coupon_discount, o.shipping_cost, o.fees,
		o.status, o.payment_status, o.payment_method,
		o.creation_datetime, o.payment_installment_quantity,
		o.shipping_status,
		o.shipping_type, d.name AS shipping_district_name,
		c.name AS shipping_city_name, c.uf AS shipping_city_uf,
		o.shipping_cep, o.shipping_street, o.shipping_complement,
		o.shipping_number, o.shipping_address_observation,
		o.payment_boleto_link,
		cp.code AS coupon_code,
		(SELECT GROUP_CONCAT(p.product_id) FROM order_products p WHERE p.order_id = o.id ORDER BY p.id ASC) AS products_product_id,
		(SELECT GROUP_CONCAT(pp.name ORDER BY p.id ASC) FROM order_products p LEFT JOIN products pp ON pp.id = p.product_id WHERE p.order_id = o.id) AS products_product_name,
		(SELECT GROUP_CONCAT(s.name ORDER BY p.id ASC) FROM order_products p LEFT JOIN sizes s ON s.id = p.size_id WHERE p.order_id = o.id) AS products_size_name,
		(SELECT GROUP_CONCAT(p.price) FROM order_products p WHERE p.order_id = o.id ORDER BY p.id ASC) AS products_product_price,
		(SELECT GROUP_CONCAT(p.quantity) FROM order_products p WHERE p.order_id = o.id ORDER BY p.id ASC) AS products_product_quantity
		FROM orders o
		LEFT JOIN districts d ON d.id = o.shipping_district_id
		LEFT JOIN cities c on c.id = d.city_id
		LEFT JOIN coupons cp on cp.id = o.coupon_id
		WHERE
			o.customer_id = '${mysqlEscape(customerId)}' AND
			o.id = '${mysqlEscape(orderId)}';
	`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no order matches given id")
		else callback(null, results[0]);
	});
}

function getCustomersListWithFilter(text, callback) {
	conn.query(`SELECT id, name, cpf FROM customers WHERE LOWER(name) LIKE LOWER('%${mysqlEscape(text)}%') OR LOWER(cpf) LIKE LOWER('%${mysqlEscape(text)}%') OR id LIKE '%${mysqlEscape(text)}%';`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function getCustomerInfoForModule(customerId, callback) {
	conn.query(`
			SELECT customers.name, desired_name, cpf, birthday, email, whatsapp, mobile,
			district_id, districts.name AS district_name, districts.city_id, cities.name AS city_name, cities.uf AS uf, cep, street, complement, number, address_observation, secret_question_id,
			secret_questions.question AS secret_question, allow_email, allow_whatsapp
			FROM customers
			LEFT JOIN secret_questions ON secret_questions.id = secret_question_id
			LEFT JOIN districts ON districts.id = district_id
			LEFT JOIN cities ON cities.id = districts.city_id
			WHERE customers.id = ${mysqlEscape(customerId)};
			`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no customer matches given id")
		else callback(null, results[0]);
	});
}

/* Cities */

function getCitiesList(callback) {
	conn.query(`SELECT * FROM cities WHERE 1;`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function getCitiesListForModule(callback) {
	conn.query(`SELECT id, name, uf FROM cities WHERE 1 ORDER BY id ASC;`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function addCity(name, uf, callback) {

	conn.query(`
			INSERT INTO cities(name, uf)
			VALUES ('${mysqlEscape(name)}', '${mysqlEscape(uf)}');
	   `, (error, results, fields) => {
		if (error) return callback(error)
		if (results.length < 1) return callback({code: 'UNEXPECTED', message: "unexpected"})
		else callback(null, results.insertId);
	});
}

function deleteCityById(cityId, callback) {
	conn.query(`DELETE FROM cities WHERE id = '${mysqlEscape(cityId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no city matches given id")
		else callback(null, null);
	});
}

function getCityInfo(cityId, callback) {
	conn.query(`SELECT name, uf FROM cities WHERE id = '${mysqlEscape(cityId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no city matches given id")
		else callback(null, results[0]);
	});
}

function updateCityById(cityId, name, uf, callback) {
	conn.query(`UPDATE cities SET name='${mysqlEscape(name)}', uf='${mysqlEscape(uf)}'
	 WHERE id = '${mysqlEscape(cityId)}'`, (error, results, fields) => {
		if (error) return callback(error)
		if (results.affectedRows == 0) return callback({code: 'UNEXPECTED', message: "unexpected"});
		else callback(null, results);
	});
}

/* Districts */

function getDistrictsList(callback) {
	conn.query(`SELECT * FROM districts WHERE 1;`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function getDistrictsListWithFilter(text, callback) {
	conn.query(`SELECT id, name, city_id FROM districts WHERE LOWER(name) LIKE LOWER('%${mysqlEscape(text)}%') OR id LIKE '%${mysqlEscape(text)}%';`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function addDistrict(name, city_id, api_name, shipping_free_available, shipping_normal_price, shipping_express_price, callback) {
	conn.query(`
			INSERT INTO districts(name, city_id, api_name, shipping_free_available, shipping_normal_price, shipping_express_price)
			VALUES ('${mysqlEscape(name)}', '${mysqlEscape(city_id)}', '${mysqlEscape(api_name)}',
			${Boolean(shipping_free_available)}, ${mysqlEscape(shipping_normal_price)}, ${mysqlEscape(shipping_express_price)});
	   `, (error, results, fields) => {
		if (error) return callback(error)
		if (results.length < 1) return callback({code: 'UNEXPECTED', message: "unexpected"})
		else callback(null, results.insertId);
	});
}

function deleteDistrictById(districtId, callback) {
	conn.query(`DELETE FROM districts WHERE id = '${mysqlEscape(districtId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no district matches given id")
		else callback(null, null);
	});
}

function getDistrictInfo(districtId, callback) {
	conn.query(`SELECT name, city_id, api_name, shipping_free_available, shipping_normal_price, shipping_express_price FROM districts WHERE id = '${mysqlEscape(districtId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no district matches given id")
		else callback(null, results[0]);
	});
}

function updateDistrictById(districtId, name, city_id, api_name, shipping_free_available, shipping_normal_price, shipping_express_price, callback) {
	conn.query(`UPDATE districts SET name='${mysqlEscape(name)}', city_id='${mysqlEscape(city_id)}', api_name='${mysqlEscape(api_name)}',
		shipping_free_available=${Boolean(shipping_free_available)}, shipping_normal_price=${mysqlEscape(shipping_normal_price)}, shipping_express_price=${mysqlEscape(shipping_express_price)}
	 WHERE id = '${mysqlEscape(districtId)}'`, (error, results, fields) => {
		if (error) return callback(error)
		if (results.affectedRows == 0) return callback({code: 'UNEXPECTED', message: "unexpected"});
		else callback(null, results);
	});
}

/* Secret Questions */

function getSecretQuestionsList(callback) {
	conn.query(`SELECT * FROM secret_questions WHERE 1;`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

/* Orders */

function getProductsForPreOrder(productsIds, callback) {
	conn.query(`SELECT id, name, price, price_in_cash FROM products WHERE FIND_IN_SET(id, '${mysqlEscape(productsIds)}');`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function getDistrictForPreOrder(customerId, callback) {
	 conn.query(`SELECT customers.district_id, districts.shipping_free_available, districts.shipping_express_price, districts.shipping_normal_price FROM customers LEFT JOIN districts ON districts.id = customers.district_id WHERE customers.id = '${mysqlEscape(customerId)}';`, (error, results, fields) => {
		if (error) callback(error.code)
		if (results.length < 1) return callback("no customer matches given id")
		else callback(null, results[0]);
	});
}

function getCustomerInfoForOrder(customerId, callback) {
	conn.query(`
		SELECT customers.id, customers.name, customers.cpf, customers.birthday, customers.email, customers.mobile, customers.district_id,
		customers.cep, customers.street, customers.complement, customers.number, customers.address_observation,
		districts.name AS district_name, districts.city_id,
		cities.name AS city_name, cities.uf AS city_uf
		FROM customers
		LEFT JOIN districts ON districts.id = customers.district_id
		LEFT JOIN cities ON cities.id = districts.city_id
		WHERE customers.id = ${mysqlEscape(customerId)};
		`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no customer matches given id")
		else callback(null, results[0]);
	});
}

function createOrder(customer_id, subtotal, extra_amount, coupon_discount, shipping_cost, fees,
							total, shipping_type, shipping_district_id, shipping_cep, shipping_street,
							shipping_complement, shipping_number, shipping_address_observation,
							payment_method, payment_installment_quantity, payment_in_cash, payment_pagseguro,
							coupon_id, products, callback) {
	conn.query(`
		CALL createOrder('${mysqlEscape(customer_id)}', '${mysqlEscape(subtotal)}', '${mysqlEscape(extra_amount)}', '${mysqlEscape(coupon_discount)}', '${mysqlEscape(shipping_cost)}', '${mysqlEscape(fees)}',
							'${mysqlEscape(total)}', '${mysqlEscape(shipping_type)}', '${mysqlEscape(shipping_district_id)}', '${mysqlEscape(shipping_cep)}', '${mysqlEscape(shipping_street)}',
							'${mysqlEscape(shipping_complement)}', '${mysqlEscape(shipping_number)}', '${mysqlEscape(shipping_address_observation)}',
							'${mysqlEscape(payment_method)}',${typeof payment_installment_quantity == 'number' ? payment_installment_quantity : null}, ${payment_in_cash ? 1 : 0}, ${mysqlEscape(payment_pagseguro ? 1 : 0)},
							${typeof coupon_id == 'number' ? coupon_id : null}, '${mysqlEscape(products)}');
		`, (error, results, fields) => {
		if (error) {
			return callback(error.code)
		}
		if (results.length < 1) return callback("couldnt create order")
		else callback(null, results[0][0]);
	});
}

function deleteOrder(order_id, callback) {
	conn.query(`
		CALL deleteOrder('${mysqlEscape(order_id)}');
		`, (error, results, fields) => {
		if (error) 
			return callback(error.code)
		if (results.length < 1) return callback("couldnt delete order")
		else callback(null, results[0][0]);
	});
}

function startOrderByBoleto(order_id, payment_pagseguro_code, payment_boleto_link, callback) {
	conn.query(`
		UPDATE orders SET payment_pagseguro_code = '${mysqlEscape(payment_pagseguro_code)}', payment_boleto_link = '${mysqlEscape(payment_boleto_link)}', payment_status = 'AWAITING_PAYMENT'
		WHERE orders.id = '${mysqlEscape(order_id)}';
		`, (error, results, fields) => {
		if (error) 
			return callback(error.code)
		else callback(null, true);
	});
}

function startOrderByCredit(order_id, payment_pagseguro_code, callback) {
	conn.query(`
		UPDATE orders SET payment_pagseguro_code = '${mysqlEscape(payment_pagseguro_code)}', payment_status = 'AWAITING_PAYMENT'
		WHERE orders.id = '${mysqlEscape(order_id)}';
		`, (error, results, fields) => {
		if (error) 
			return callback(error.code)
		else callback(null, true);
	});
}

function getOrdersListWithFilter(customerInfo, orderId, status, payment_method, payment_status, callback) {
	conn.query(`
		SELECT orders.id AS id, total, status, payment_status, payment_method, creation_datetime,
		payment_installment_quantity, customers.name AS customer_name, customers.cpf, customers.id AS customer_id
		FROM orders
		LEFT JOIN customers ON customers.id = orders.customer_id
		WHERE (LOWER(customers.name) LIKE LOWER('%${mysqlEscape(customerInfo)}%') OR
			LOWER(customers.cpf) LIKE LOWER('%${mysqlEscape(customerInfo)}%') OR
			customers.id LIKE '%${mysqlEscape(customerInfo)}%') AND
			orders.id LIKE '%${mysqlEscape(orderId)}%' AND
			LOWER(status) LIKE LOWER('%${mysqlEscape(status)}%') AND
			LOWER(payment_method) LIKE LOWER('%${mysqlEscape(payment_method)}%') AND
			LOWER(payment_status) LIKE LOWER('%${mysqlEscape(payment_status)}%')
		ORDER BY creation_datetime DESC;`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function getOrderInfo(orderId, callback) {
	conn.query(`
		SELECT o.id, o.total, o.subtotal, o.extra_amount, o.coupon_discount, o.shipping_cost, o.fees,
		o.status, o.payment_status, o.payment_method,
		o.creation_datetime, o.payment_installment_quantity,
		o.shipping_status,
		o.shipping_type, d.name AS shipping_district_name,
		c.name AS shipping_city_name, c.uf AS shipping_city_uf,
		o.shipping_cep, o.shipping_street, o.shipping_complement,
		o.shipping_number, o.shipping_address_observation,
		o.payment_boleto_link,
		cp.code AS coupon_code,
		cu.name AS customer_name, cu.id AS customer_id, cu.desired_name AS customer_desired_name, cu.cpf AS customer_cpf,
		cu.birthday AS customer_birthday, cu.mobile AS customer_mobile, cu.whatsapp AS customer_whatsapp,
		(SELECT GROUP_CONCAT(p.product_id) FROM order_products p WHERE p.order_id = o.id ORDER BY p.id ASC) AS products_product_id,
		(SELECT GROUP_CONCAT(pp.name ORDER BY p.id ASC) FROM order_products p LEFT JOIN products pp ON pp.id = p.product_id WHERE p.order_id = o.id) AS products_product_name,
		(SELECT GROUP_CONCAT(s.name ORDER BY p.id ASC) FROM order_products p LEFT JOIN sizes s ON s.id = p.size_id WHERE p.order_id = o.id) AS products_size_name,
		(SELECT GROUP_CONCAT(p.price) FROM order_products p WHERE p.order_id = o.id ORDER BY p.id ASC) AS products_product_price,
		(SELECT GROUP_CONCAT(p.quantity) FROM order_products p WHERE p.order_id = o.id ORDER BY p.id ASC) AS products_product_quantity
		FROM orders o
		LEFT JOIN districts d ON d.id = o.shipping_district_id
		LEFT JOIN cities c ON c.id = d.city_id
		LEFT JOIN coupons cp ON cp.id = o.coupon_id
		LEFT JOIN customers cu ON cu.id = o.customer_id
		WHERE
			o.id = '${mysqlEscape(orderId)}';
	`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no order matches given id")
		else callback(null, results[0]);
	});
}

function getOrderEvents(orderId, callback) {
	conn.query(`
		SELECT order_events.*, users.username AS user_username
		FROM order_events
		LEFT JOIN users ON users.id = order_events.user_id
		WHERE order_events.order_id = '${mysqlEscape(orderId)}'
		ORDER BY date DESC;
		`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function updateOrderStatus(orderId, status, reason, userId, callback) {
	conn.query(`
			CALL updateOrderStatus('${mysqlEscape(orderId)}', '${mysqlEscape(status)}', '${mysqlEscape(reason)}', '${mysqlEscape(userId)}');
	   `, (error, results, fields) => {
		if (error) {
			return callback(error.code)
		}
		if (results.length < 1 || !results[0][0].success) return callback("couldnt update order status")
		else callback(null, results[0][0]);
	});
}

function updateOrderPaymentStatus(orderId, payment_status, reason, userId, callback) {
	conn.query(`
			CALL updateOrderPaymentStatus('${mysqlEscape(orderId)}', '${mysqlEscape(payment_status)}', '${mysqlEscape(reason)}', '${mysqlEscape(userId)}');
	   `, (error, results, fields) => {
		if (error) {
			return callback(error.code)
		}
		if (results.length < 1 || !results[0][0].success) return callback("couldnt update order payment status")
		else callback(null, results[0][0]);
	});
}

function updateOrderShippingStatus(orderId, shipping_status, reason, userId, callback) {
	conn.query(`
			CALL updateOrderShippingStatus('${mysqlEscape(orderId)}', '${mysqlEscape(shipping_status)}', '${mysqlEscape(reason)}', '${mysqlEscape(userId)}');
	   `, (error, results, fields) => {
		if (error) {
			return callback(error.code)
		}
		if (results.length < 1 || !results[0][0].success) return callback("couldnt update order shipping status")
		else callback(null, results[0][0]);
	});
}

function updateOrderPaymentStatusByRef(ref, payment_status, reason, callback) {
	conn.query(`
			CALL updateOrderPaymentStatus((SELECT id FROM orders WHERE payment_pagseguro_reference = '${mysqlEscape(ref)}' LIMIT 1), '${mysqlEscape(payment_status)}', '${mysqlEscape(reason)}', null);
	   `, (error, results, fields) => {
		if (error) {
			return callback(error.code)
		}
		if (results.length < 1 || !results[0][0].success) return callback("couldnt update order payment status")
		else callback(null, results[0][0]);
	});
}

/* Coupon */

function getCouponByCode(code, callback) {
	 conn.query(`SELECT * FROM coupons WHERE LOWER(code) = LOWER('${mysqlEscape(code)}');`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function getCouponByCodeForPreOrder(code, customerId, callback) {
	 conn.query(`

	 	SELECT coupons.*,
		EXISTS
			(
				SELECT
					id
				FROM
					orders
				WHERE
					orders.customer_id = '${mysqlEscape(customerId)}' AND orders.coupon_id = coupons.id
					AND (orders.status = 'IN_PROGRESS' OR orders.status = 'FINISHED')
				LIMIT 1
			) AS already_used
		FROM coupons
		WHERE LOWER(code) = LOWER('${mysqlEscape(code)}');

	 	`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function addCoupon(code, type, value, minimum_amount, max_uses, max_units, single_use, consultant_id, callback) {

	conn.query(`
			INSERT INTO coupons(code, type, value, minimum_amount, max_uses, max_units, single_use, consultant_id)
			VALUES ('${mysqlEscape(code)}', '${mysqlEscape(type)}', ${mysqlEscape(value)}, ${mysqlEscape(minimum_amount)},
			${mysqlEscape(max_uses)}, ${mysqlEscape(max_units)}, ${Boolean(single_use)}, ${(consultant_id == null) ? 'null' : mysqlEscape(consultant_id)});
	   `, (error, results, fields) => {
		if (error) return callback(error)
		if (results.length < 1) return callback({code: 'UNEXPECTED', message: "unexpected"})
		else callback(null, results.insertId);
	});
}

function deleteCouponById(couponId, callback) {
	conn.query(`DELETE FROM coupons WHERE id = '${mysqlEscape(couponId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no coupon matches given id")
		else callback(null, null);
	});
}

function getCouponInfo(couponId, callback) {
	conn.query(`SELECT code, type, value, minimum_amount, max_uses, max_units, single_use, consultant_id FROM coupons WHERE id = '${mysqlEscape(couponId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no coupon matches given id")
		else callback(null, results[0]);
	});
}

function updateCouponById(couponId, code, type, value, minimum_amount, max_uses, max_units, single_use, consultant_id, callback) {
	conn.query(`UPDATE coupons SET code='${mysqlEscape(code)}', type='${mysqlEscape(type)}', value=${mysqlEscape(value)},
		 minimum_amount=${mysqlEscape(minimum_amount)}, max_uses=${mysqlEscape(max_uses)}, max_units=${mysqlEscape(max_units)},
		 single_use=${Boolean(single_use)}, consultant_id=${(consultant_id == null) ? 'null' : mysqlEscape(consultant_id)}
	 WHERE id = '${mysqlEscape(couponId)}'`, (error, results, fields) => {
		if (error) return callback(error)
		if (results.affectedRows == 0) return callback({code: 'UNEXPECTED', message: "unexpected"});
		else callback(null, results);
	});
}

/* Users */

function getUserByLogin(login, callback) {
	conn.query(`SELECT id, password FROM users WHERE username = '${mysqlEscape(login)}' AND active = 1;`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no user matches given login")
		else callback(null, results[0]);
	});
}

function getUserProfile(userId, callback) {
	conn.query(`SELECT username, profiles.* FROM users LEFT JOIN profiles ON profiles.id = users.profile_id WHERE users.id = ${mysqlEscape(userId)};`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no user matches given id")
		else callback(null, results[0]);
	});
}

function getUsersList(callback) {
	conn.query(`SELECT id, username, profile_id, active FROM users WHERE 1;`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function getUserForVerify(userId, callback) {
	conn.query(`SELECT id FROM users WHERE id = '${mysqlEscape(userId)}' AND active = 1;`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no user matches given id")
		else callback(null, results[0]);
	});
}

function addUser(username, password, profile_id, callback) {

	conn.query(`
			INSERT INTO users(username, password, profile_id, active)
			VALUES ('${mysqlEscape(username)}', '${mysqlEscape(password)}', '${mysqlEscape(profile_id)}', 1);
	   `, (error, results, fields) => {
		if (error) return callback(error)
		if (results.length < 1) return callback({code: 'UNEXPECTED', message: "unexpected"})
		else callback(null, results.insertId);
	});
}

function deleteUserById(userId, callback) {
	conn.query(`DELETE FROM users WHERE id = '${mysqlEscape(userId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no user matches given id")
		else callback(null, null);
	});
}

function getUserInfo(userId, callback) {
	conn.query(`SELECT username, profile_id, active FROM users WHERE id = '${mysqlEscape(userId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no user matches given id")
		else callback(null, results[0]);
	});
}

function updateUserById(userId, username, profile_id, active, callback) {
	conn.query(`UPDATE users SET username='${mysqlEscape(username)}',profile_id='${mysqlEscape(profile_id)}',
		active=${Boolean(active)}
	 WHERE id = '${mysqlEscape(userId)}'`, (error, results, fields) => {
		if (error) return callback(error)
		if (results.affectedRows == 0) return callback({code: 'UNEXPECTED', message: "unexpected"});
		else callback(null, results);
	});
}

function updateUserPassword(userId, password, callback) {
	conn.query(`UPDATE users SET password='${mysqlEscape(password)}'
	 WHERE id = '${mysqlEscape(userId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.affectedRows == 0) return callback('unexpected error');
		else callback(null, results);
	});
}

/* Profiles */

function getProfilesList(callback) {
	conn.query(`SELECT * FROM profiles WHERE 1;`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function addProfile(name, users_module, profiles_module, products_module, product_categories_module,
sizes_module, product_inventory_module, customers_module, orders_module, change_order_status,
change_order_payment_status, change_order_shipping_status, cities_module,
districts_module, coupons_module, consultants_module, callback) {

	conn.query(`
			INSERT INTO profiles(name, users_module, profiles_module, products_module, product_categories_module,
			sizes_module, product_inventory_module, customers_module, orders_module, change_order_status,
			change_order_payment_status, change_order_shipping_status, cities_module,
			districts_module, coupons_module, consultants_module)
			VALUES ('${mysqlEscape(name)}', ${Boolean(users_module)}, ${Boolean(profiles_module)}, ${Boolean(products_module)}, ${Boolean(product_categories_module)},
			${Boolean(sizes_module)}, ${Boolean(product_inventory_module)}, ${Boolean(customers_module)}, ${Boolean(orders_module)}, ${Boolean(change_order_status)},
			${Boolean(change_order_payment_status)}, ${Boolean(change_order_shipping_status)}, ${Boolean(cities_module)},
			${Boolean(districts_module)}, ${Boolean(coupons_module)}, ${Boolean(consultants_module)});
	   `, (error, results, fields) => {
		if (error) return callback(error)
		if (results.length < 1) return callback({code: 'UNEXPECTED', message: "unexpected"})
		else callback(null, results.insertId);
	});
}

function deleteProfileById(profileId, callback) {
	conn.query(`DELETE FROM profiles WHERE id = '${mysqlEscape(profileId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no profile matches given id")
		else callback(null, null);
	});
}

function getProfileInfo(profileId, callback) {
	conn.query(`SELECT name, users_module, profiles_module, products_module, product_categories_module,
	sizes_module, product_inventory_module, customers_module, orders_module, change_order_status,
	change_order_payment_status, change_order_shipping_status, cities_module,
	districts_module, coupons_module, consultants_module FROM profiles WHERE id = '${mysqlEscape(profileId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no profile matches given id")
		else callback(null, results[0]);
	});
}

function updateProfileById(profileId, name, users_module, profiles_module, products_module, product_categories_module,
sizes_module, product_inventory_module, customers_module, orders_module, change_order_status,
change_order_payment_status, change_order_shipping_status, cities_module,
districts_module, coupons_module, consultants_module, callback) {
	conn.query(`UPDATE profiles SET name='${mysqlEscape(name)}',users_module=${Boolean(users_module)},
		profiles_module=${Boolean(profiles_module)},products_module=${Boolean(products_module)},product_categories_module=${Boolean(product_categories_module)},
		sizes_module=${Boolean(sizes_module)},product_inventory_module=${Boolean(product_inventory_module)},customers_module=${Boolean(customers_module)},orders_module=${Boolean(orders_module)},change_order_status=${Boolean(change_order_status)},change_order_payment_status=${Boolean(change_order_payment_status)},change_order_shipping_status=${Boolean(change_order_shipping_status)},cities_module=${Boolean(cities_module)},
		districts_module=${Boolean(districts_module)},coupons_module=${Boolean(coupons_module)},consultants_module=${Boolean(consultants_module)}
	 WHERE id = '${mysqlEscape(profileId)}'`, (error, results, fields) => {
		if (error) return callback(error)
		if (results.affectedRows == 0) return callback({code: 'UNEXPECTED', message: "unexpected"});
		else callback(null, results);
	});
}

/* Coupons */

function getCouponsListForModule(callback) {
	conn.query(`SELECT id, code, type, value FROM coupons WHERE 1 ORDER BY id ASC;`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

/* Consultants */

function getConsultantsListForModule(callback) {
	conn.query(`SELECT id, name, code FROM consultants WHERE 1 ORDER BY id ASC;`, (error, results, fields) => {
		if (error) callback(error.code)
		else callback(null, results);
	});
}

function addConsultant(name, code, callback) {

	conn.query(`
			INSERT INTO consultants(name, code)
			VALUES ('${mysqlEscape(name)}', '${mysqlEscape(code)}');
	   `, (error, results, fields) => {
		if (error) return callback(error)
		if (results.length < 1) return callback({code: 'UNEXPECTED', message: "unexpected"})
		else callback(null, results.insertId);
	});
}

function deleteConsultantById(consultantId, callback) {
	conn.query(`DELETE FROM consultants WHERE id = '${mysqlEscape(consultantId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no consultant matches given id")
		else callback(null, null);
	});
}

function getConsultantInfo(consultantId, callback) {
	conn.query(`SELECT name, code FROM consultants WHERE id = '${mysqlEscape(consultantId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no consultant matches given id")
		else callback(null, results[0]);
	});
}

function updateConsultantById(consultantId, name, code, callback) {
	conn.query(`UPDATE consultants SET name='${mysqlEscape(name)}', code='${mysqlEscape(code)}'
	 WHERE id = '${mysqlEscape(consultantId)}'`, (error, results, fields) => {
		if (error) return callback(error)
		if (results.affectedRows == 0) return callback({code: 'UNEXPECTED', message: "unexpected"});
		else callback(null, results);
	});
}

module.exports = {
	getCategoriesList, getCategoriesListAll, addCategory, getCategoriesListForModule, deleteCategoryById, getCategoryInfo,
		updateCategoryById,
	getProductsList, getProductById, getProductInventoryBySize, getProductsListWithFilter, addProduct,
		deleteProductById, updateProductById, getProductCategories, addProductCategory, deleteProductCategory,
		getProductSizes, addProductSize, deleteProductSize, getProductImages, existsProductById, updateProductImages,
		getProductInventoryListForModule, addProductInventory, getProductInventoryEvents, getProductInventoryInfo,
		updateProductInventoryStatus,
	getSizesList, getSizesListForModule, addSize, deleteSizeById, getSizeInfo, updateSizeById,
	getCitiesList, getCitiesListForModule, addCity, deleteCityById, getCityInfo, updateCityById,
	getDistrictsList, getDistrictsListWithFilter, addDistrict, deleteDistrictById, getDistrictInfo, updateDistrictById,
	getSecretQuestionsList,
	getCustomerByLogin, getCustomerInfo, registerCustomer, getCustomerForResetPassword, resetCustomerPassword,
		updateCustomerPersonalInfo, updateCustomerAddress, getCustomerForUpdatePassword, updateCustomerRecover,
		updateCustomerNotification, getCustomerWishlist, deleteProductFromCustomerWishlist, addProductToCustomerWishlist,
		getCustomerOrdersList, getCustomerOrderById, getCustomersListWithFilter, getCustomerInfoForModule,
	getProductsForPreOrder, getDistrictForPreOrder, getCustomerInfoForOrder, createOrder, deleteOrder, startOrderByBoleto,
		startOrderByCredit, getOrdersListWithFilter, getOrderInfo, getOrderEvents, updateOrderStatus,
		updateOrderPaymentStatus, updateOrderShippingStatus, updateOrderPaymentStatusByRef,
	getCouponByCode, getCouponByCodeForPreOrder,
	getUserByLogin, getUserProfile, getUsersList, getUserForVerify, addUser, deleteUserById, getUserInfo, updateUserById,
		updateUserPassword,
	getProfilesList, addProfile, deleteProfileById, getProfileInfo, updateProfileById,
	getCouponsListForModule, addCoupon, deleteCouponById, getCouponInfo, updateCouponById,
	getConsultantsListForModule, addConsultant, deleteConsultantById, getConsultantInfo, updateConsultantById,
}; 	