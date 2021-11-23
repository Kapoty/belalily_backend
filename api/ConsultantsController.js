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
	if (!(req.userProfile['coupons_module'] || req.userProfile['consultants_module']))
		return res.status(500).send({error: 'permission denied'});
	db.getConsultantsListForModule((error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({consultants: results});
	});
});

router.post('/', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['consultants_module'])
		return res.status(500).send({error: 'permission denied'});

	let name = req.body.name;
	let code = String(req.body.code).toUpperCase();
	
	// validações

	//name

	if (name == null || String(name).length < 2)
		return res.status(500).send({error:"name too short"});
	if (String(name).length > 50)
		return res.status(500).send({error:"name too long"});

	//code

	if (code == null || String(code).length < 3)
		return res.status(500).send({error:"code too short"});
	if (String(code).length > 20)
		return res.status(500).send({error:"code too long"});
	if (!util.isValidConsultantCode(code))
		return res.status(500).send({error:"code invalid"});

	db.addConsultant(String(name), String(code), (error, results) => {

		if (error) {
			if (/(^ER_DUP_ENTRY)[\s\S]+('code'$)/g.test(error.message))
				return res.status(500).send({error: 'code duplicate'});
			return res.status(500).send({error: error.code});
		}

		res.status(200).send({ consultantId: results });
	});
});

router.delete('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['consultants_module'])
		return res.status(500).send({error: 'permission denied'});
	db.deleteConsultantById(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({success: true});
	});
});

router.get('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['consultants_module'])
		return res.status(500).send({error: 'permission denied'});
	db.getConsultantInfo(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({consultant: results});
	});
});

router.patch('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['consultants_module'])
		return res.status(500).send({error: 'permission denied'});

	let name = req.body.name;
	let code = String(req.body.code).toUpperCase();
	
	// validações

	//name

	if (name == null || String(name).length < 2)
		return res.status(500).send({error:"name too short"});
	if (String(name).length > 50)
		return res.status(500).send({error:"name too long"});

	//code

	if (code == null || String(code).length < 3)
		return res.status(500).send({error:"code too short"});
	if (String(code).length > 20)
		return res.status(500).send({error:"code too long"});
	if (!util.isValidConsultantCode(code))
		return res.status(500).send({error:"code invalid"});

	db.updateConsultantById(req.params.id, String(name), String(code), (error, results) => {

		if (error) {
			if (/(^ER_DUP_ENTRY)[\s\S]+('code'$)/g.test(error.message))
				return res.status(500).send({error: 'code duplicate'});
			return res.status(500).send({error: error.code});
		}

		res.status(200).send({ success: true });
	});
});

module.exports = router;