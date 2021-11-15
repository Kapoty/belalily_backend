var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('../config'); // get our config file
var db = require("../db");

function verifyUserToken(req, res, next) {

  // check header or url parameters or post parameters for token
  var token = req.headers['x-user-token'];
  if (!token) 
    return res.status(403).send({auth: false});

  // verifies secret and checks exp
  jwt.verify(token, config.secret, function(err, decoded) {      
    if (err) 
      return res.status(500).send({auth: false});    

    // if everything is good, save to request for use in other routes
    req.userId = decoded.userId;
    db.getUserForVerify(req.userId, (error, results) => {
      if (error) return res.status(500).send({auth: false});
      next();
    });
  });

}

module.exports = verifyUserToken;