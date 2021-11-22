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
	db.getSizesList((error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({sizes: results});
	});
});

router.get('/module', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!(req.userProfile['sizes_module']))
		return res.status(500).send({error: 'permission denied'});
	db.getSizesListForModule((error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({sizes: results});
	});
});

router.post('/', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['sizes_module'])
		return res.status(500).send({error: 'permission denied'});

	let name = req.body.name;
	
	// validações

	//name

	if (name == null || String(name).length < 1)
		return res.status(500).send({error:"name too short"});
	if (String(name).length > 15)
		return res.status(500).send({error:"name too long"});

	db.addSize(String(name), (error, results) => {

		if (error) {
			if (/(^ER_DUP_ENTRY)[\s\S]+('name'$)/g.test(error.message))
				return res.status(500).send({error: 'name duplicate'});
			return res.status(500).send({error: error.code});
		}
		res.status(200).send({ sizeId: results });
	});
});

router.delete('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['sizes_module'])
		return res.status(500).send({error: 'permission denied'});
	db.deleteSizeById(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({success: true});
	});
});

router.get('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['sizes_module'])
		return res.status(500).send({error: 'permission denied'});
	db.getSizeInfo(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({size: results});
	});
});

router.patch('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['sizes_module'])
		return res.status(500).send({error: 'permission denied'});

	let name = req.body.name;
	
	// validações

	//name

	if (name == null || String(name).length < 1)
		return res.status(500).send({error:"name too short"});
	if (String(name).length > 15)
		return res.status(500).send({error:"name too long"});

	db.updateSizeById(req.params.id, String(name), (error, results) => {

		if (error) {
			if (/(^ER_DUP_ENTRY)[\s\S]+('name'$)/g.test(error.message))
				return res.status(500).send({error: 'name duplicate'});
			return res.status(500).send({error: error.code});
		}
		res.status(200).send({ success: true });
	});
});

module.exports = router;