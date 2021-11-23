var db = require("../db");
const util = require("../util")

const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json({limit: '50mb'}));

const VerifyUserToken = require('./VerifyUserToken');
const GetUserProfile = require('./GetUserProfile');

router.get('/module', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!(req.userProfile['coupons_module']))
		return res.status(500).send({error: 'permission denied'});
	db.getCouponsListForModule((error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({coupons: results});
	});
});

router.post('/', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['coupons_module'])
		return res.status(500).send({error: 'permission denied'});

	let code = String(req.body.code).toUpperCase();
	let type = req.body.type;
	let value = req.body.value;
	let minimum_amount = req.body.minimum_amount;
	let max_uses = req.body.max_uses;
	let max_units = req.body.max_units;
	let consultant_id = req.body.consultant_id;

	// validações

	//code

	if (code == null || String(code).length < 3)
		return res.status(500).send({error:"code too short"});
	if (String(code).length > 20)
		return res.status(500).send({error:"code too long"});
	if (!util.isValidCouponCode(code))
		return res.status(500).send({error:"code invalid"});

	//type

	if (['PERCENT', 'GROSS', 'TWO_PERCENT', 'TWO_GROSS'].indexOf(type) == -1)
		return res.status(500).send({error:"type invalid"});

	//value minimun_amount max_uses max_units

	if (typeof value !== 'number' || value < 0.01 || value > 100)
		return res.status(500).send({error:"value invalid"});

	if (typeof minimum_amount !== 'number' || minimum_amount < 0)
		return res.status(500).send({error:"minimum_amount invalid"});

	if (typeof max_uses !== 'number' || max_uses < 0)
		return res.status(500).send({error:"max_uses invalid"});

	if (typeof max_units !== 'number' || max_units < 0)
		return res.status(500).send({error:"max_units invalid"});

	
	value = value.toFixed(2);
	minimum_amount = minimum_amount.toFixed(2);
	max_uses = Math.floor(max_uses);
	max_units = Math.floor(max_units);

	//consultant_id

	if (consultant_id !== null && ( isNaN(parseInt(consultant_id)) || consultant_id < 0 ))
		return res.status(500).send({error:"consultant invalid"});

	db.addCoupon(String(code), String(type), value, minimum_amount, max_uses, max_units, consultant_id, (error, results) => {

		if (error) {
			if (/(^ER_DUP_ENTRY)[\s\S]+('code'$)/g.test(error.message))
				return res.status(500).send({error: 'code duplicate'});
			return res.status(500).send({error: error.code});
		}
		res.status(200).send({ couponId: results });
	});
});

router.delete('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['coupons_module'])
		return res.status(500).send({error: 'permission denied'});
	db.deleteCouponById(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({success: true});
	});
});

router.get('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['coupons_module'])
		return res.status(500).send({error: 'permission denied'});
	db.getCouponInfo(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({coupon: results});
	});
});

router.patch('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['coupons_module'])
		return res.status(500).send({error: 'permission denied'});

	let code = String(req.body.code).toUpperCase();
	let type = req.body.type;
	let value = req.body.value;
	let minimum_amount = req.body.minimum_amount;
	let max_uses = req.body.max_uses;
	let max_units = req.body.max_units;
	let consultant_id = req.body.consultant_id;

	// validações

	//code

	if (code == null || String(code).length < 3)
		return res.status(500).send({error:"code too short"});
	if (String(code).length > 20)
		return res.status(500).send({error:"code too long"});
	if (!util.isValidCouponCode(code))
		return res.status(500).send({error:"code invalid"});

	//type

	if (['PERCENT', 'GROSS', 'TWO_PERCENT', 'TWO_GROSS'].indexOf(type) == -1)
		return res.status(500).send({error:"type invalid"});

	//value minimun_amount max_uses max_units

	if (typeof value !== 'number' || value < 0.01 || value > 100)
		return res.status(500).send({error:"value invalid"});

	if (typeof minimum_amount !== 'number' || minimum_amount < 0)
		return res.status(500).send({error:"minimum_amount invalid"});

	if (typeof max_uses !== 'number' || max_uses < 0)
		return res.status(500).send({error:"max_uses invalid"});

	if (typeof max_units !== 'number' || max_units < 0)
		return res.status(500).send({error:"max_units invalid"});

	value = value.toFixed(2);
	minimum_amount = minimum_amount.toFixed(2);
	max_uses = Math.floor(max_uses);
	max_units = Math.floor(max_units);

	//consultant_id

	if (consultant_id !== null && ( isNaN(parseInt(consultant_id)) || consultant_id < 0 ))
		return res.status(500).send({error:"consultant invalid"});

	db.updateCouponById(req.params.id, String(code), String(type), value, minimum_amount, max_uses, max_units, consultant_id, (error, results) => {

		if (error) {
			if (/(^ER_DUP_ENTRY)[\s\S]+('code'$)/g.test(error.message))
				return res.status(500).send({error: 'code duplicate'});
			return res.status(500).send({error: error.code});
		}
		res.status(200).send({ success: true });
	});
});

module.exports = router;