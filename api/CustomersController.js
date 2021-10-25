var db = require("../db");
const util = require("../util")

const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

const jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
const bcrypt = require('bcryptjs');
const config = require('../config'); 
const VerifyCustomerToken = require('./VerifyCustomerToken')

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json({limit: '50mb'}));

router.post('/login', function(req, res) {

	let login = req.body.login;
	let password = req.body.password;

	if (login == null || login.length < 5)
		return res.status(500).send({error:"incorrectLogin"});
	if (password == null || password.length < 5)
		return res.status(500).send({error:"incorrectPassword"});

	db.getCustomerByLogin(login, (error, results) => {

		if (error)
			return res.status(500).send({error: "incorrectLogin"});

		var passwordIsValid = bcrypt.compareSync(password, results.password);

		if (!passwordIsValid)
			return res.status(200).send({error:"incorrectPassword"});

		var customerToken = jwt.sign({ customerId: results.id }, config.secret, {
			expiresIn: 86400 // expires in 24 hours
		});

		res.status(200).send({ customerToken: customerToken });
	});

});

router.get('/token/verify', VerifyCustomerToken, function(req, res) {
	res.status(200).send({auth: true});
});

router.get('/basic-info', VerifyCustomerToken, function(req, res) {
	db.getCustomerBasicInfo(req.customerId ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({customer: results});
	});
});
module.exports = router;