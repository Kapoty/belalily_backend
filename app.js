var express = require('express');
var app = express();
var cors = require('cors');
var logger = require('./logger');

global.__root   = __dirname + '/'; 

var CategoriesController = require(__root + 'api/CategoriesController');
var ProductsController = require(__root + 'api/ProductsController');
var SizesController = require(__root + 'api/SizesController');
var CustomersController = require(__root + 'api/CustomersController');
var PagseguroController = require(__root + 'pagseguro/PagseguroController');

function errorLogger(error, req, res, next) {
	logger.error(error);
	next(error);
}

function errorResponder(error, req, res, next) {
	res.status(500).send({error: error.message});
}

app.use(cors());

app.use('/api/categories/', CategoriesController);
app.use('/api/products/', ProductsController);
app.use('/api/sizes/', SizesController);
app.use('/api/customers/', CustomersController);
app.use('/pagseguro/', PagseguroController);

app.use('/media', express.static(__dirname + '/media'));
app.use('/', express.static(__dirname + '/frontend'));

app.use(errorLogger);
app.use(errorResponder);

module.exports = app;