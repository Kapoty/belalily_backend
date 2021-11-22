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
	db.getCitiesList((error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({cities: results});
	});
});

router.get('/module', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!(req.userProfile['cities_module'] || req.userProfile['districts_module']))
		return res.status(500).send({error: 'permission denied'});
	db.getCitiesListForModule((error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({cities: results});
	});
});

router.post('/', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['cities_module'])
		return res.status(500).send({error: 'permission denied'});

	let name = req.body.name;
	let uf = req.body.uf;
	
	// validações

	//name

	if (name == null || String(name).length < 1)
		return res.status(500).send({error:"name too short"});
	if (String(name).length > 20)
		return res.status(500).send({error:"name too long"});

	//uf

	if (uf == null || String(uf).length < 2)
		return res.status(500).send({error:"uf too short"});
	if (String(uf).length > 2)
		return res.status(500).send({error:"uf too long"});

	db.addCity(String(name), String(uf), (error, results) => {

		if (error) {
			if (/(^ER_DUP_ENTRY)[\s\S]+('name'$)/g.test(error.message))
				return res.status(500).send({error: 'name duplicate'});
			return res.status(500).send({error: error.code});
		}
		res.status(200).send({ cityId: results });
	});
});

router.delete('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['cities_module'])
		return res.status(500).send({error: 'permission denied'});
	db.deleteCityById(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({success: true});
	});
});

router.get('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['cities_module'])
		return res.status(500).send({error: 'permission denied'});
	db.getCityInfo(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({city: results});
	});
});

router.patch('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['cities_module'])
		return res.status(500).send({error: 'permission denied'});

	let name = req.body.name;
	let uf = req.body.uf;
	
	// validações

	//name

	if (name == null || String(name).length < 1)
		return res.status(500).send({error:"name too short"});
	if (String(name).length > 20)
		return res.status(500).send({error:"name too long"});

	//uf

	if (uf == null || String(uf).length < 2)
		return res.status(500).send({error:"uf too short"});
	if (String(uf).length > 2)
		return res.status(500).send({error:"uf too long"});

	db.updateCityById(req.params.id, String(name), String(uf), (error, results) => {

		if (error) {
			if (/(^ER_DUP_ENTRY)[\s\S]+('name'$)/g.test(error.message))
				return res.status(500).send({error: 'name duplicate'});
			return res.status(500).send({error: error.code});
		}
		res.status(200).send({ success: true });
	});
});

module.exports = router;