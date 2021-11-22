var db = require("../db");
const util = require("../util")

const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const VerifyUserToken = require('./VerifyUserToken');
const GetUserProfile = require('./GetUserProfile');

const fs = require("fs");

const Buffer = require('buffer').Buffer;

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json({limit: '50mb'}));

router.get('/', function(req, res) {
	db.getProductsList((error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({products: results});
	});
});

router.get('/:id', function(req, res) {
	db.getProductById(req.params.id, (error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({product: results});
	});
})

router.get('/:id/quantity/:sizeId', function(req, res) {
	db.getProductInventoryBySize(req.params.id, req.params.sizeId, (error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({quantity: results});
	});
})

router.post('/with-filter', VerifyUserToken, GetUserProfile, function(req, res) {

	if (!req.userProfile['products_module'])
		return res.status(500).send({error: 'permission denied'});

	let text = String(req.body.text);

	db.getProductsListWithFilter(text, (error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({products: results});
	});
});

router.post('/', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['products_module'])
		return res.status(500).send({error: 'permission denied'});

	let name = req.body.name;
	let price = req.body.price;
	let price_in_cash = req.body.price_in_cash;
	let description = req.body.description;
	let position = req.body.position;

	// validações

	//name

	if (name == null || String(name).length < 1)
		return res.status(500).send({error:"name too short"});
	if (String(name).length > 30)
		return res.status(500).send({error:"name too long"});

	//description

	if (typeof description !== "string")
		description = String(description);

	//price price_in_cash position

	if (typeof price !== 'number' || price < 0.01)
		return res.status(500).send({error:"price invalid"});

	if (typeof price_in_cash !== 'number' || price_in_cash < 0.01)
		return res.status(500).send({error:"price_in_cash invalid"});

	if (typeof position !== 'number' || position < 0)
		return res.status(500).send({error:"position invalid"});

	price = price.toFixed(2);
	price_in_cash = price_in_cash.toFixed(2);
	position = Math.floor(position);

	db.addProduct(String(name), price, price_in_cash, String(description), position, (error, results) => {

		if (error) 
			return res.status(500).send({error: error.code});

		res.status(200).send({ productId: results });
	});
});

router.delete('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['products_module'])
		return res.status(500).send({error: 'permission denied'});
	db.deleteProductById(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({success: true});
	});
});

router.patch('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['products_module'])
		return res.status(500).send({error: 'permission denied'});

	let name = req.body.name;
	let price = req.body.price;
	let price_in_cash = req.body.price_in_cash;
	let description = req.body.description;
	let position = req.body.position;
	let visible = req.body.visible;

	// validações

	//name

	if (name == null || String(name).length < 1)
		return res.status(500).send({error:"name too short"});
	if (String(name).length > 30)
		return res.status(500).send({error:"name too long"});

	//description

	if (typeof description !== "string")
		description = String(description);

	//price price_in_cash position visible

	if (typeof price !== 'number' || price < 0.01)
		return res.status(500).send({error:"price invalid"});

	if (typeof price_in_cash !== 'number' || price_in_cash < 0.01)
		return res.status(500).send({error:"price_in_cash invalid"});

	if (typeof position !== 'number' || position < 0)
		return res.status(500).send({error:"position invalid"});

	price = price.toFixed(2);
	price_in_cash = price_in_cash.toFixed(2);
	position = Math.floor(position);
	visible = Boolean(visible)

	db.updateProductById(req.params.id, String(name), price, price_in_cash, String(description), position, visible, (error, results) => {
		if (error) 
			return res.status(500).send({error: error.code});

		res.status(200).send({ success: true });
	});
});

router.get('/:id/categories/', function(req, res) {
	db.getProductCategories(req.params.id, (error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({categories: results});
	});
})

router.post('/:id/categories/', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['products_module'])
		return res.status(500).send({error: 'permission denied'});

	if (typeof req.body.category_id !== 'number')
		return res.status(500).send({error: 'category_id invalid'});

	db.addProductCategory(req.params.id, req.body.category_id, (error, results) => {
		if (error)
			return res.status(500).send({error: error.code});
		res.status(200).send({categoryId: results});
	});

})

router.delete('/:id/categories/:category_id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['products_module'])
		return res.status(500).send({error: 'permission denied'});

	db.deleteProductCategory(req.params.id, req.params.category_id, (error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({success: true});
	});

})

router.get('/:id/sizes/', function(req, res) {
	db.getProductSizes(req.params.id, (error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({sizes: results});
	});
})

router.post('/:id/sizes/', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['products_module'])
		return res.status(500).send({error: 'permission denied'});

	if (typeof req.body.size_id !== 'number')
		return res.status(500).send({error: 'size_id invalid'});

	db.addProductSize(req.params.id, req.body.size_id, (error, results) => {
		if (error)
			return res.status(500).send({error: error.code});
		res.status(200).send({sizeId: results});
	});

})

router.delete('/:id/sizes/:size_id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['products_module'])
		return res.status(500).send({error: 'permission denied'});

	db.deleteProductSize(req.params.id, req.params.size_id, (error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({success: true});
	});

})

router.get('/:id/images/', function(req, res) {
	db.getProductImages(req.params.id, (error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({images: results});
	});
})


router.post('/:id/images/', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['products_module'])
		return res.status(500).send({error: 'permission denied'});

	let image = req.body.image;
	let image256 = req.body.image256;
	let image512 = req.body.image512;

	// validar

	try {

		if (!(Buffer.from(image, 'base64').toString('base64') === image) ||
			!(Buffer.from(image256, 'base64').toString('base64') === image256) ||
			!(Buffer.from(image512, 'base64').toString('base64') === image512))
			return res.status(500).send({error: 'image invalid'});
		
		db.getProductImages(req.params.id, (error, results) => {
			if (error)
				return res.status(500).send({error: error});

			let dir = 'media/products/' + req.params.id;
			let img_number = results.img_number + 1;
			let file;

			if (!fs.existsSync(dir)){
				fs.mkdirSync(dir, { recursive: true });
			}

			file = dir + '/' + img_number + '.jpg';
			fs.writeFile(file, image, {encoding: 'base64'}, (error) => {
				if (error)
					return res.status(500).send({error: error});

				file = dir + '/' + img_number + '-256.jpg';
				fs.writeFile(file, image256, {encoding: 'base64'}, (error) => {
					if (error)
						return res.status(500).send({error: error});

					file = dir + '/' + img_number + '-512.jpg';
					fs.writeFile(file, image512, {encoding: 'base64'}, (error) => {
						if (error)
							return res.status(500).send({error: error});

						db.updateProductImages(req.params.id, img_number, (error, results) => {
							if (error) {
								file = dir + '/' + img_number + '.jpg';
								fs.unlink(file, (e) => {
									file = dir + '/' + img_number + '-256.jpg';
									fs.unlink(file, (e) => {
										file = dir + '/' + img_number + '-512.jpg';
										fs.unlink(file, (e) => {
											return res.status(500).send({error: error});
										});
									});
								});
							} else res.status(200).send({success: true});
						});
					});
				});
		   	});
		});

	} catch (e) {
		return res.status(500).send({error: 'invalid image'});
	}
	
})

router.delete('/:id/images/:image_id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['products_module'])
		return res.status(500).send({error: 'permission denied'});

	// validações

	db.getProductImages(req.params.id, (error, results) => {
		if (error)
			return res.status(500).send({error: error});

		try {

			let image = parseInt(req.params.image_id);
			if (image < 1 || image > results.img_number)
				return res.status(500).send({error: 'invalid image'});

			let dir = 'media/products/' + req.params.id;
			let sizes = ['', '-256', '-512'];

			for (let i=0; i<sizes.length; i++)
				fs.unlinkSync(dir + '/' + image + sizes[i] + '.jpg');

			for (let i=0; i<sizes.length; i++)
				for (let j = image+1; j<=results.img_number; j++)
					fs.renameSync( dir + '/' + j + sizes[i] + '.jpg', dir + '/' + (j-1) + sizes[i] + '.jpg' );

			db.updateProductImages(req.params.id, results.img_number-1, (error, results) => {
				res.status(200).send({success: true});
			});

		} catch (e) {
			console.log(e);
			return res.status(500).send({error: 'invalid image'});
		}

	});

})


module.exports = router;