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
    conn.query(`SELECT id, name, price, img_number, position,
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
        AND size_id = ${mysqlEscape(sizeId)} AND status = 0;`, (error, results, fields) => {
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
    conn.query(`UPDATE customers SET allow_email=${allow_email}, allow_whatsapp=${allow_whatsapp}
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
                    product_inventory.status = 0
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

module.exports = {
    getCategoriesList,
    getProductsList, getProductById, getProductInventoryBySize,
    getSizesList,
    getCitiesList,
    getDistrictsList,
    getSecretQuestionsList,
    getCustomerByLogin, getCustomerInfo, registerCustomer, getCustomerForResetPassword, resetCustomerPassword,
        updateCustomerPersonalInfo, updateCustomerAddress, getCustomerForUpdatePassword, updateCustomerRecover,
        updateCustomerNotification, getCustomerWishlist, deleteProductFromCustomerWishlist, addProductToCustomerWishlist
}; 	