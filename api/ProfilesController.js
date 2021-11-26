var db = require("../db");
const util = require("../util")

const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

const jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
const bcrypt = require('bcryptjs');
const config = require('../config'); 
const VerifyUserToken = require('./VerifyUserToken');
const GetUserProfile = require('./GetUserProfile');

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json({limit: '50mb'}));

router.get('/', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!(req.userProfile['users_module'] || req.userProfile['profiles_module']))
		return res.status(500).send({error: 'permission denied'});
	db.getProfilesList((error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({profiles: results});
	});
});

router.post('/', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['profiles_module'])
		return res.status(500).send({error: 'permission denied'});

	let name = req.body.name;
	let users_module = req.body.users_module;
	let profiles_module = req.body.profiles_module;
	let products_module = req.body.products_module;
	let product_categories_module = req.body.product_categories_module;
	let sizes_module = req.body.sizes_module;
	let product_inventory_module = req.body.product_inventory_module;
	let customers_module = req.body.customers_module;
	let orders_module = req.body.orders_module;
	let change_order_status = req.body.change_order_status;
	let change_order_payment_status = req.body.change_order_payment_status;
	let change_order_shipping_status = req.body.change_order_shipping_status;
	let cities_module = req.body.cities_module;
	let districts_module = req.body.districts_module;
	let coupons_module = req.body.coupons_module;
	let consultants_module = req.body.consultants_module;
	
	// validações

	//name

	if (name == null || String(name).length < 4)
		return res.status(500).send({error:"name too short"});
	if (String(name).length > 50)
		return res.status(500).send({error:"name too long"});
	if (!util.isValidProfileName(name))
		return res.status(500).send({error:"name invalid"});

	// modules

	users_module = Boolean(users_module);
	profiles_module = Boolean(profiles_module);
	products_module = Boolean(products_module);
	product_categories_module = Boolean(product_categories_module);
	sizes_module = Boolean(sizes_module);
	product_inventory_module = Boolean(product_inventory_module);
	customers_module = Boolean(customers_module);
	orders_module = Boolean(orders_module);
	change_order_status = Boolean(change_order_status);
	change_order_payment_status = Boolean(change_order_payment_status);
	change_order_shipping_status = Boolean(change_order_shipping_status);
	cities_module = Boolean(cities_module);
	districts_module = Boolean(districts_module);
	coupons_module = Boolean(coupons_module);
	consultants_module = Boolean(consultants_module);

	db.addProfile(String(name), users_module, profiles_module, products_module, product_categories_module,
	sizes_module, product_inventory_module, customers_module, orders_module, change_order_status,
	change_order_payment_status, change_order_shipping_status, cities_module,
	districts_module, coupons_module, consultants_module, (error, results) => {

		if (error) {
			if (/(^ER_DUP_ENTRY)[\s\S]+('name'$)/g.test(error.message))
				return res.status(500).send({error: 'name duplicate'});
			return res.status(500).send({error: error.code});
		}
		res.status(200).send({ profileId: results });
	});
});

router.delete('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['profiles_module'])
		return res.status(500).send({error: 'permission denied'});
	db.deleteProfileById(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({success: true});
	});
});

router.get('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['profiles_module'])
		return res.status(500).send({error: 'permission denied'});
	db.getProfileInfo(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({profile: results});
	});
});

router.patch('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['profiles_module'])
		return res.status(500).send({error: 'permission denied'});

	let name = req.body.name;
	let users_module = req.body.users_module;
	let profiles_module = req.body.profiles_module;
	let products_module = req.body.products_module;
	let product_categories_module = req.body.product_categories_module;
	let sizes_module = req.body.sizes_module;
	let product_inventory_module = req.body.product_inventory_module;
	let customers_module = req.body.customers_module;
	let orders_module = req.body.orders_module;
	let change_order_status = req.body.change_order_status;
	let change_order_payment_status = req.body.change_order_payment_status;
	let change_order_shipping_status = req.body.change_order_shipping_status;
	let cities_module = req.body.cities_module;
	let districts_module = req.body.districts_module;
	let coupons_module = req.body.coupons_module;
	let consultants_module = req.body.consultants_module;
	
	// validações

	//name

	if (name == null || String(name).length < 4)
		return res.status(500).send({error:"name too short"});
	if (String(name).length > 50)
		return res.status(500).send({error:"name too long"});
	if (!util.isValidProfileName(name))
		return res.status(500).send({error:"name invalid"});

	// modules

	users_module = Boolean(users_module);
	profiles_module = Boolean(profiles_module);
	products_module = Boolean(products_module);
	product_categories_module = Boolean(product_categories_module);
	sizes_module = Boolean(sizes_module);
	product_inventory_module = Boolean(product_inventory_module);
	customers_module = Boolean(customers_module);
	orders_module = Boolean(orders_module);
	cities_module = Boolean(cities_module);
	districts_module = Boolean(districts_module);
	coupons_module = Boolean(coupons_module);
	consultants_module = Boolean(consultants_module);
	change_order_status = Boolean(change_order_status);
	change_order_payment_status = Boolean(change_order_payment_status);
	change_order_shipping_status = Boolean(change_order_shipping_status);

	db.updateProfileById(req.params.id, String(name), users_module, profiles_module, products_module, product_categories_module,
	sizes_module, product_inventory_module, customers_module, orders_module, change_order_status,
	change_order_payment_status, change_order_shipping_status, cities_module,
	districts_module, coupons_module, consultants_module, (error, results) => {

		if (error) {
			if (/(^ER_DUP_ENTRY)[\s\S]+('name'$)/g.test(error.message))
				return res.status(500).send({error: 'name duplicate'});
			return res.status(500).send({error: error.code});
		}
		res.status(200).send({ success: true });
	});
});

module.exports = router;