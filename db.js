const mysql = require('mysql');
const logger = require('./logger');

var config =
{
	host: '127.0.0.1',
	user: 'root',
	password: 'vertrigo',
	database: 'belalily',
	port: 3306,
	ssl: false,
	multipleStatements: true
};

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

/* Products */

function getProductsList(callback) {
	conn.query(`SELECT id, name, price, price_in_cash, img_number, position,
		(SELECT GROUP_CONCAT(c.category_id) FROM product_categories c WHERE c.product_id = products.id)
		 AS categories,
		 (SELECT GROUP_CONCAT(s.size_id) FROM product_sizes s WHERE s.product_id = products.id)
		 AS sizes
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

/* Sizes */

function getSizesList(callback) {
	conn.query(`SELECT id, name FROM sizes WHERE 1;`, (error, results, fields) => {
		if (error) callback(error.code)
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
			o.customer_id = ${mysqlEscape(customerId)} AND
			o.id = ${mysqlEscape(orderId)};
	`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no order matches given id")
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

/* Districts */

function getDistrictsList(callback) {
	conn.query(`SELECT * FROM districts WHERE 1;`, (error, results, fields) => {
		if (error) callback(error.code)
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
							shipping_complement, shipping_number, shipping_address_observation, payment_status,
							payment_method, payment_installment_quantity, payment_in_cash, payment_pagseguro,
							coupon_id, products, callback) {
	conn.query(`
		CALL createOrder('${mysqlEscape(customer_id)}', '${mysqlEscape(subtotal)}', '${mysqlEscape(extra_amount)}', '${mysqlEscape(coupon_discount)}', '${mysqlEscape(shipping_cost)}', '${mysqlEscape(fees)}',
							'${mysqlEscape(total)}', '${mysqlEscape(shipping_type)}', '${mysqlEscape(shipping_district_id)}', '${mysqlEscape(shipping_cep)}', '${mysqlEscape(shipping_street)}',
							'${mysqlEscape(shipping_complement)}', '${mysqlEscape(shipping_number)}', '${mysqlEscape(shipping_address_observation)}', '${mysqlEscape(payment_status)}',
							'${mysqlEscape(payment_method)}',${typeof payment_installment_quantity == 'number' ? payment_installment_quantity : null}, ${payment_in_cash ? 1 : 0}, ${mysqlEscape(payment_pagseguro ? 1 : 0)},
							${typeof coupon_id == 'number' ? coupon_id : null}, '${mysqlEscape(products)}');
		`, (error, results, fields) => {
		if (error) {
			console.log(error);
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

/* Coupon */

function getCouponByCode(code, callback) {
	 conn.query(`SELECT * FROM coupons WHERE LOWER(code) = LOWER('${mysqlEscape(code)}');`, (error, results, fields) => {
		if (error) callback(error.code)
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

function addProfile(name, users_module, profiles_module, callback) {

	conn.query(`
			INSERT INTO profiles(name, users_module, profiles_module)
			VALUES ('${mysqlEscape(name)}', ${Boolean(users_module)}, ${Boolean(profiles_module)});
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
	conn.query(`SELECT name, users_module, profiles_module FROM profiles WHERE id = '${mysqlEscape(profileId)}'`, (error, results, fields) => {
		if (error) return callback(error.code)
		if (results.length < 1) return callback("no profile matches given id")
		else callback(null, results[0]);
	});
}

function updateProfileById(profileId, name, users_module, profiles_module, callback) {
	conn.query(`UPDATE profiles SET name='${mysqlEscape(name)}',users_module=${Boolean(users_module)},
		profiles_module=${Boolean(profiles_module)}
	 WHERE id = '${mysqlEscape(profileId)}'`, (error, results, fields) => {
		if (error) return callback(error)
		if (results.affectedRows == 0) return callback({code: 'UNEXPECTED', message: "unexpected"});
		else callback(null, results);
	});
}

module.exports = {
	getCategoriesList,
	getProductsList, getProductById, getProductInventoryBySize,
	getSizesList,
	getCitiesList,
	getDistrictsList,
	getSecretQuestionsList,
	getCustomerByLogin, getCustomerInfo, registerCustomer, getCustomerForResetPassword, resetCustomerPassword,
		updateCustomerPersonalInfo, updateCustomerAddress, getCustomerForUpdatePassword, updateCustomerRecover,
		updateCustomerNotification, getCustomerWishlist, deleteProductFromCustomerWishlist, addProductToCustomerWishlist,
		getCustomerOrdersList, getCustomerOrderById,
	getProductsForPreOrder, getDistrictForPreOrder, getCustomerInfoForOrder, createOrder, deleteOrder, startOrderByBoleto,
		startOrderByCredit,
	getCouponByCode,
	getUserByLogin, getUserProfile, getUsersList, getUserForVerify, addUser, deleteUserById, getUserInfo, updateUserById,
		updateUserPassword,
	getProfilesList, addProfile, deleteProfileById, getProfileInfo, updateProfileById,
}; 	