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

module.exports = {
    getCategoriesList,
    getProductsList, getProductById, getProductInventoryBySize,
    getSizesList
}; 	