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

router.post('/login', function(req, res) {

	let login = req.body.login;
	let password = req.body.password;

	if (login == null || login.length < 1)
		return res.status(500).send({error:"incorrect data"});
	if (password == null || password.length < 8)
		return res.status(500).send({error:"incorrect data"});

	db.getUserByLogin(login, (error, results) => {

		if (error)
			return res.status(500).send({error: "incorrect data"});

		let passwordIsValid = bcrypt.compareSync(password, results.password);

		if (!passwordIsValid)
			return res.status(200).send({error:"incorrect data"});

		let userToken = jwt.sign({ userId: results.id }, config.secret, {
			expiresIn: 86400 // expires in 24 hours
		});

		res.status(200).send({ userToken: userToken });
	});

});

router.get('/me/verify-token', VerifyUserToken, function(req, res) {
	res.status(200).send({auth: true});
});

router.get('/me/profile', VerifyUserToken, function(req, res) {
	db.getUserProfile(req.userId ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({profile: results});
	});
});

router.get('/', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['users_module'])
		return res.status(500).send({error: 'permission denied'});
	db.getUsersList((error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({users: results});
	});
});

router.post('/', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['users_module'])
		return res.status(500).send({error: 'permission denied'});

	let username = req.body.username;
	let password = req.body.password;
	let password_confirm = req.body.password_confirm;
	let profile_id = req.body.profile_id;
	
	// validações

	//username

	if (username == null || String(username).length < 4)
		return res.status(500).send({error:"username too short"});
	if (String(username).length > 12)
		return res.status(500).send({error:"username too long"});
	if (!util.isValidUsername(username))
		return res.status(500).send({error:"username invalid"});

	//password

	if (password == null || String(password).length < 8)
		return res.status(500).send({error:"password too short"});
	if (String(password).length > 15)
		return res.status(500).send({error:"password too long"});
	if (!util.isValidPassword(password))
		return res.status(500).send({error:"password invalid"});

	//password_confirm

	if (password_confirm == null || password_confirm !== password)
		return res.status(500).send({error:"password_confirm not match"});

	//profile_id

	if (profile_id == null || isNaN(parseInt(profile_id)) || profile_id < 0)
		return res.status(500).send({error:"profile invalid"});

	db.addUser(String(username), bcrypt.hashSync(password, 8), profile_id, (error, results) => {

		if (error) {
			if (/(^ER_DUP_ENTRY)[\s\S]+('username'$)/g.test(error.message))
				return res.status(500).send({error: 'username duplicate'});
			return res.status(500).send({error: error.code});
		}
		res.status(200).send({ userId: results });
	});
});

router.delete('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['users_module'])
		return res.status(500).send({error: 'permission denied'});
	if (req.userId == req.params.id)
		return res.status(500).send({error: 'cannot delete yourself'});
	db.deleteUserById(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({success: true});
	});
});

router.get('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['users_module'])
		return res.status(500).send({error: 'permission denied'});
	db.getUserInfo(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({user: results});
	});
});

router.patch('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['users_module'])
		return res.status(500).send({error: 'permission denied'});

	let username = req.body.username;
	let profile_id = req.body.profile_id;
	let active = req.body.active;
	
	// validações

	//username

	if (username == null || String(username).length < 4)
		return res.status(500).send({error:"username too short"});
	if (String(username).length > 12)
		return res.status(500).send({error:"username too long"});
	if (!util.isValidUsername(username))
		return res.status(500).send({error:"username invalid"});

	//profile_id

	if (profile_id == null || isNaN(parseInt(profile_id)) || profile_id < 0)
		return res.status(500).send({error:"profile invalid"});

	//active

	active = Boolean(active);

	db.updateUserById(req.params.id, String(username), profile_id, active, (error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({success: true});
	});
});

router.post('/:id/update-password', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['users_module'])
		return res.status(500).send({error: 'permission denied'});
	
	let password = req.body.password;
	let password_confirm = req.body.password_confirm;
	
	// validações

	//password

	if (password == null || String(password).length < 8)
		return res.status(500).send({error:"password too short"});
	if (String(password).length > 15)
		return res.status(500).send({error:"password too long"});
	if (!util.isValidPassword(password))
		return res.status(500).send({error:"password invalid"});

	//password_confirm

	if (password_confirm == null || password_confirm !== password)
		return res.status(500).send({error:"password_confirm not match"});

	db.updateUserPassword(req.params.id, bcrypt.hashSync(password, 8), (error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({success: true});
	});
});

module.exports = router;