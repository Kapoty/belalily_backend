var db = require("../db");
const util = require("../util")

const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json({limit: '50mb'}));

const VerifyUserToken = require('./VerifyUserToken');
const GetUserProfile = require('./GetUserProfile');

router.get('/', function(req, res) {
	db.getDistrictsList((error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({districts: results});
	});
});

router.post('/with-filter', VerifyUserToken, GetUserProfile, function(req, res) {

	if (!req.userProfile['districts_module'])
		return res.status(500).send({error: 'permission denied'});

	let text = String(req.body.text);

	db.getDistrictsListWithFilter(text, (error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({districts: results});
	});
});

router.post('/', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['districts_module'])
		return res.status(500).send({error: 'permission denied'});

	let name = req.body.name;
	let city_id = req.body.city_id;
	let api_name = req.body.api_name;
	let shipping_free_available = req.body.shipping_free_available;
	let shipping_normal_price = req.body.shipping_normal_price;
	let shipping_express_price = req.body.shipping_express_price;
	
	// validações

	//name

	if (name == null || String(name).length < 1)
		return res.status(500).send({error:"name too short"});
	if (String(name).length > 30)
		return res.status(500).send({error:"name too long"});

	//city_id

	if (city_id == null || isNaN(parseInt(city_id)) || city_id < 0)
		return res.status(500).send({error:"city invalid"});

	//api_name

	if (api_name == null || String(api_name).length < 1)
		return res.status(500).send({error:"api_name too short"});
	if (String(api_name).length > 30)
		return res.status(500).send({error:"api_name too long"});

	//shipping_normal_price shipping_express_price

	if (typeof shipping_normal_price !== 'number' || shipping_normal_price < 0.01)
		return res.status(500).send({error:"shipping_normal_price invalid"});

	if (typeof shipping_express_price !== 'number' || shipping_express_price < 0.01)
		return res.status(500).send({error:"shipping_express_price invalid"});

	shipping_normal_price = shipping_normal_price.toFixed(2);
	shipping_express_price = shipping_express_price.toFixed(2);

	//shipping_free_available

	shipping_free_available = Boolean(shipping_free_available);

	db.addDistrict(String(name), city_id, String(api_name), shipping_free_available, shipping_normal_price, shipping_express_price, (error, results) => {

		if (error) {
			if (/(^ER_DUP_ENTRY)[\s\S]+('name'$)/g.test(error.message))
				return res.status(500).send({error: 'name duplicate'});
			return res.status(500).send({error: error.code});
		}
		res.status(200).send({ districtId: results });
	});
});

router.delete('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['districts_module'])
		return res.status(500).send({error: 'permission denied'});
	db.deleteDistrictById(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({success: true});
	});
});

router.get('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['districts_module'])
		return res.status(500).send({error: 'permission denied'});
	db.getDistrictInfo(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({district: results});
	});
});

router.patch('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['districts_module'])
		return res.status(500).send({error: 'permission denied'});

	let name = req.body.name;
	let city_id = req.body.city_id;
	let api_name = req.body.api_name;
	let shipping_free_available = req.body.shipping_free_available;
	let shipping_normal_price = req.body.shipping_normal_price;
	let shipping_express_price = req.body.shipping_express_price;
	
	// validações

	//name

	if (name == null || String(name).length < 1)
		return res.status(500).send({error:"name too short"});
	if (String(name).length > 30)
		return res.status(500).send({error:"name too long"});

	//city_id

	if (city_id == null || isNaN(parseInt(city_id)) || city_id < 0)
		return res.status(500).send({error:"city invalid"});

	//api_name

	if (api_name == null || String(api_name).length < 1)
		return res.status(500).send({error:"api_name too short"});
	if (String(api_name).length > 30)
		return res.status(500).send({error:"api_name too long"});

	//shipping_normal_price shipping_express_price

	if (typeof shipping_normal_price !== 'number' || shipping_normal_price < 0.01)
		return res.status(500).send({error:"shipping_normal_price invalid"});

	if (typeof shipping_express_price !== 'number' || shipping_express_price < 0.01)
		return res.status(500).send({error:"shipping_express_price invalid"});

	shipping_normal_price = shipping_normal_price.toFixed(2);
	shipping_express_price = shipping_express_price.toFixed(2);

	//shipping_free_available

	shipping_free_available = Boolean(shipping_free_available);

	db.updateDistrictById(req.params.id, String(name), city_id, String(api_name), shipping_free_available, shipping_normal_price, shipping_express_price, (error, results) => {

		if (error) {
			if (/(^ER_DUP_ENTRY)[\s\S]+('name'$)/g.test(error.message))
				return res.status(500).send({error: 'name duplicate'});
			return res.status(500).send({error: error.code});
		}
		res.status(200).send({ success: true });
	});
});

module.exports = router;