var express = require('express');
var app = express();
var cors = require('cors');
var logger = require('./logger');

global.__root   = __dirname + '/'; 

var CategoriesController = require(__root + 'api/CategoriesController');
var ProductsController = require(__root + 'api/ProductsController');
var SizesController = require(__root + 'api/SizesController');
var CitiesController = require(__root + 'api/CitiesController');
var DistrictsController = require(__root + 'api/DistrictsController');
var SecretQuestionsController = require(__root + 'api/SecretQuestionsController');
var CustomersController = require(__root + 'api/CustomersController');
var OrdersController = require(__root + 'api/OrdersController');
var UsersController = require(__root + 'api/UsersController');
var ProfilesController = require(__root + 'api/ProfilesController');
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
app.use('/api/cities/', CitiesController);
app.use('/api/districts/', DistrictsController);
app.use('/api/secret-questions/', SecretQuestionsController);
app.use('/api/customers/', CustomersController);
app.use('/api/orders/', OrdersController);
app.use('/api/users/', UsersController);
app.use('/api/profiles/', ProfilesController);
app.use('/pagseguro/', PagseguroController);

app.use('/media', express.static(__dirname + '/media'));
app.use('/', express.static(__dirname + '/frontend'));

app.use(errorLogger);
app.use(errorResponder);

module.exports = app;