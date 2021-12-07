var db = require("../db");
const util = require("../util")

const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json({limit: '50mb'}));

const VerifyCustomerToken = require('./VerifyCustomerToken');
const VerifyUserToken = require('./VerifyUserToken');
const GetUserProfile = require('./GetUserProfile');

const config = require('../config'); 
const pagseguro = config.pagseguro;

const fetch = require('cross-fetch');
const xml2js = require('xml2js');

router.post('/notification', function(req, res) {

	try {

		fetch(`${pagseguro.APIUrl}v2/transactions/notifications/${req.body.notificationCode}?email=${pagseguro.Email}&token=${pagseguro.Token}`, {
			method: 'GET',
			headers: {
				"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
			},
				redirect: 'follow'
		})
		.then(response => response.text())
		.then(result => {
			xml2js.parseString(result, function (err, result) {
				if (err == null) {
					let ref = result.transaction.reference[0];
					let status = result.transaction.status[0];
					let payment_status = '';

					switch(status) {
						case '1': payment_status = 'AWAITING_PAYMENT'; break;
						case '3': payment_status = 'CONFIRMED'; break;
						case '7': payment_status = 'CANCELED'; break;
					}

					if (payment_status != '') {

						db.updateOrderPaymentStatusByRef(ref, payment_status, 'Notificação do pagseguro', (error, results) => {
							if (error)
								return res.status(500).send({error: error});
							res.status(200).send({success: true});
						});

					}
					else res.status(200).send({error: 'payment_status not used'});
				}
				else {
					// erro na resposta do pagseguro
					res.status(500).send({error: true});
				}
			});
		})
		.catch(error => {
			// erro http
			res.status(500).send({error: true});
		});

	} catch (error) {
		res.status(200).send({error: true});
	}
});

module.exports = router;