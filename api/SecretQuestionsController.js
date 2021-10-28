var db = require("../db");
const util = require("../util")

const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json({limit: '50mb'}));

router.get('/', function(req, res) {
	db.getSecretQuestionsList((error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({secret_questions: results});
	});
});

module.exports = router;