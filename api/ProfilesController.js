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

router.get('/', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!(req.userProfile['users_module'] || req.userProfile['profiles_module']))
		return res.status(500).send({error: 'permission denied'});
	db.getProfilesList((error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({profiles: results});
	});
});

module.exports = router;