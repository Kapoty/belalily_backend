var db = require("../db");

function getUserProfile(req, res, next) {
	if (typeof req.userId !== 'number')
		return res.status(500).send({auth: false});

	db.getUserProfile(req.userId ,(error, results) => {
		if (error)  return res.status(500).send({error: error});
		req.userProfile = results;
		next();
	});
}

module.exports = getUserProfile;