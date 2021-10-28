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

	if (login == null || login.length < 1)
		return res.status(500).send({error:"incorrectLogin"});
	if (password == null || password.length < 8)
		return res.status(500).send({error:"incorrectPassword"});

	db.getCustomerByLogin(login, (error, results) => {

		if (error)
			return res.status(500).send({error: "incorrectLogin"});

		let passwordIsValid = bcrypt.compareSync(password, results.password);

		if (!passwordIsValid)
			return res.status(200).send({error:"incorrectPassword"});

		let customerToken = jwt.sign({ customerId: results.id }, config.secret, {
			expiresIn: 86400 // expires in 24 hours
		});

		res.status(200).send({ customerToken: customerToken });
	});

});

router.post('/register', function(req, res) {

	let name = req.body.name;
	let desired_name = req.body.desired_name;
	let cpf = req.body.cpf;
	let birthday_day = req.body.birthday_day;
	let birthday_month = req.body.birthday_month;
	let birthday_year = req.body.birthday_year;
	let mobile = req.body.mobile;
	let whatsapp = req.body.whatsapp;
	let cep = req.body.cep;
	let district_id = req.body.district_id;
	let street = req.body.street;
	let number = req.body.number;
	let complement = req.body.complement;
	let address_observation = req.body.address_observation;
	let email = req.body.email;
	let password = req.body.password;
	let password_confirm = req.body.password_confirm;
	let secret_question_id = req.body.secret_question_id;
	let secret_answer = req.body.secret_answer;
	let agree = req.body.agree;
	let allow_email = req.body.allow_email;
	let allow_whatsapp = req.body.allow_whatsapp;
	let consultant_code = req.body.consultant_code;

	// validações

	// name

	if (name == null || name.length < 3)
		return res.status(500).send({error:"name too short"});
	if (name.length > 50)
		return res.status(500).send({error:"name too long"});

	// desired_name

	if (desired_name == null || desired_name.length < 3)
		return res.status(500).send({error:"desired_name too short"});
	if (desired_name.length > 20)
		return res.status(500).send({error:"desired_name too long"});

	//cpf

	if (!util.isValidCpf(cpf))
		return res.status(500).send({error:"cpf invalid"});

	//birthday

	if (!util.isValidBirthday(birthday_day, birthday_month, birthday_year))
		return res.status(500).send({error:"birthday invalid"});

	//mobile

	if (!util.isValidPhoneNumber(mobile))
		return res.status(500).send({error:"mobile invalid"});

	//whatsapp

	if (whatsapp != null && whatsapp != '' && !util.isValidPhoneNumber(whatsapp))
		return res.status(500).send({error:"whatsapp invalid"});

	//cep

	if (!util.isValidCep(cep))
		return res.status(500).send({error:"cep invalid"});

	//district

	if (district_id == null || isNaN(parseInt(district_id)) || district_id < 0)
		return res.status(500).send({error:"district invalid"});

	//street

	if (street == null || street.length < 1)
		return res.status(500).send({error:"street too short"});
	if (street.length > 30)
		return res.status(500).send({error:"street too long"});

	//number

	if (number == null || number.length < 1)
		return res.status(500).send({error:"number too short"});
	if (number.length > 10)
		return res.status(500).send({error:"number too long"});

	//complement

	if (complement == null)
		complement = '';
	if (complement.length > 30)
		return res.status(500).send({error:"complement too long"});

	//address_observation

	if (address_observation == null)
		address_observation = '';
	if (address_observation.length > 50)
		return res.status(500).send({error:"address_observation too long"});

	//email

	if (!util.isValidEmail(email))
		return res.status(500).send({error:"email invalid"});

	//password

	if (password == null || password.length < 8)
		return res.status(500).send({error:"password too short"});
	if (password.length > 15)
		return res.status(500).send({error:"password too long"});
	if (!util.isValidPassword(password))
		return res.status(500).send({error:"password invalid"});

	//password_confirm

	if (password_confirm == null || password_confirm !== password)
		return res.status(500).send({error:"password_confirm not match"});

	//secret_question

	if (secret_question_id == null || isNaN(parseInt(secret_question_id)) || secret_question_id < 0)
		return res.status(500).send({error:"secret_question invalid"});

	//secret_answer

	if (secret_answer == null || secret_answer.length < 5)
		return res.status(500).send({error:"secret_answer too short"});
	if (secret_answer.length > 15)
		return res.status(500).send({error:"secret_answer too long"});
	if (!util.isValidSecretAnswer(secret_answer))
		return res.status(500).send({error:"secret_answer invalid"});

	//agree

	if (!agree)
		return res.status(500).send({error:"agree required"});

	// allow email and allow whatsapp

	if (typeof allow_email != 'boolean')
		allow_email = false;
	if (typeof allow_whatsapp != 'boolean')
		allow_whatsapp = false;

	// consultant_code

	if (consultant_code == null || consultant_code.length > 10)
		consultant_code = '';
	
	db.registerCustomer(name, desired_name, cpf, birthday_day, birthday_month, birthday_year, mobile, whatsapp,
	cep, district_id, street, number, complement, address_observation, email, bcrypt.hashSync(password, 8),
	secret_question_id, bcrypt.hashSync(secret_answer, 8), allow_email, allow_whatsapp, consultant_code, (error, results) => {

		if (error) {
			if (/(^ER_DUP_ENTRY)[\s\S]+('email'$)/g.test(error.message))
				return res.status(500).send({error: 'email duplicate'});
			if (/(^ER_DUP_ENTRY)[\s\S]+('cpf'$)/g.test(error.message))
				return res.status(500).send({error: 'cpf duplicate'});
			return res.status(500).send({error: error.code});
		}

		let customerToken = jwt.sign({ customerId: results }, config.secret, {
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