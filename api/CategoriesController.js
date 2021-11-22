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
	db.getCategoriesList((error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({categories: results});
	});
});

router.get('/all', function(req, res) {
	db.getCategoriesListAll((error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({categories: results});
	});
});

router.get('/module', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!(req.userProfile['product_categories_module']))
		return res.status(500).send({error: 'permission denied'});
	db.getCategoriesListForModule((error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({categories: results});
	});
});

router.post('/', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['product_categories_module'])
		return res.status(500).send({error: 'permission denied'});

	let name = req.body.name;
	let visible = req.body.visible;
	let position = req.body.position;
	
	// validações

	//name

	if (name == null || String(name).length < 2)
		return res.status(500).send({error:"name too short"});
	if (String(name).length > 20)
		return res.status(500).send({error:"name too long"});

	// position
	
	if (typeof position !== 'number' || position < 0)
		return res.status(500).send({error:"position invalid"});

	db.addCategory(String(name), position, (error, results) => {

		if (error) {
			if (/(^ER_DUP_ENTRY)[\s\S]+('name'$)/g.test(error.message))
				return res.status(500).send({error: 'name duplicate'});
			return res.status(500).send({error: error.code});
		}
		res.status(200).send({ categoryId: results });
	});
});

router.delete('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['product_categories_module'])
		return res.status(500).send({error: 'permission denied'});
	db.deleteCategoryById(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({success: true});
	});
});

router.get('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['product_categories_module'])
		return res.status(500).send({error: 'permission denied'});
	db.getCategoryInfo(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({category: results});
	});
});

router.patch('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['product_categories_module'])
		return res.status(500).send({error: 'permission denied'});

	let name = req.body.name;
	let visible = req.body.visible;
	let position = req.body.position;
	
	// validações

	//name

	if (name == null || String(name).length < 2)
		return res.status(500).send({error:"name too short"});
	if (String(name).length > 20)
		return res.status(500).send({error:"name too long"});

	// visible and position

	visible = Boolean(visible);
	
	if (typeof position !== 'number' || position < 0)
		return res.status(500).send({error:"position invalid"});

	db.updateCategoryById(req.params.id, String(name), visible, position, (error, results) => {

		if (error) {
			if (/(^ER_DUP_ENTRY)[\s\S]+('name'$)/g.test(error.message))
				return res.status(500).send({error: 'name duplicate'});
			return res.status(500).send({error: error.code});
		}
		res.status(200).send({ success: true });
	});
});

module.exports = router;