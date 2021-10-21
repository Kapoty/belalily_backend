var db = require("../db");
const util = require("../util")

const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

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

module.exports = router;