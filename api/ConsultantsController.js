var db = require("../db");
const util = require("../util")

const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json({limit: '50mb'}));

const VerifyUserToken = require('./VerifyUserToken');
const GetUserProfile = require('./GetUserProfile');

router.get('/module', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!(req.userProfile['coupons_module'] || req.userProfile['consultants_module']))
		return res.status(500).send({error: 'permission denied'});
	db.getConsultantsListForModule((error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({consultants: results});
	});
});

module.exports = router;