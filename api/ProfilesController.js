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

	db.addProfile(String(name), users_module, profiles_module, (error, results) => {

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

	db.updateProfileById(req.params.id, String(name), users_module, profiles_module, (error, results) => {

		if (error) {
			if (/(^ER_DUP_ENTRY)[\s\S]+('name'$)/g.test(error.message))
				return res.status(500).send({error: 'name duplicate'});
			return res.status(500).send({error: error.code});
		}
		res.status(200).send({ success: true });
	});
});

module.exports = router;