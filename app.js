var express = require('express');
var app = express();
var cors = require('cors');

global.__root   = __dirname + '/'; 

var CategoriesController = require(__root + 'api/CategoriesController');
var ProductsController = require(__root + 'api/ProductsController');
var SizesController = require(__root + 'api/SizesController');
var PagseguroController = require(__root + 'pagseguro/PagseguroController');

app.use(cors());

app.use('/api/categories/', CategoriesController);
app.use('/api/products/', ProductsController);
app.use('/api/sizes/', SizesController);
app.use('/pagseguro/', PagseguroController);

app.use('/media', express.static(__dirname + '/media'));
app.use('/', express.static(__dirname + '/frontend'));

module.exports = app;