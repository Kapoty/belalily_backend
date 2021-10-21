//var db = require("../db");
const util = require("../util")

const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

const xml2js = require('xml2js');

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json({limit: '50mb'}));

const fetch = require('cross-fetch');
const jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
const bcrypt = require('bcryptjs');
const config = require('../config'); // get config file

const pagseguroAPIUrl = "https://ws.sandbox.pagseguro.uol.com.br/";
const pagseguroEmail = "diretoriaprv@gmail.com";
const pagseguroToken = "3B4F8A4E07884F76A6ED0F79070B98A9";

router.get('/getSession', function(req, res) {
	fetch(pagseguroAPIUrl + `v2/sessions?email=${pagseguroEmail}&token=${pagseguroToken}`, {
		method: "POST"
	})
	.then(response => response.text())
	.then(result => {
			xml2js.parseString(result, function (err, result) {
				if (err == null)
					res.status(200).send({sessionId: result.session.id[0]});
				else
					res.status(500).send({error: err});
		});
	})
	.catch(error => res.status(500).send({error: error}));
});

router.post('/gerarBoleto', function(req, res) {

	var urlencoded = new URLSearchParams();
	urlencoded.append("paymentMode", "DEFAULT");
	urlencoded.append("paymentMethod", "boleto");
	urlencoded.append("receiverEmail", "diretoriaprv@gmail.com");
	urlencoded.append("currency", "BRL");
	urlencoded.append("extraAmount", "0.00");
	urlencoded.append("itemId1", "0001");
	urlencoded.append("itemDescription1", "T-Shirt Stitch");
	urlencoded.append("itemAmount1", "70.00");
	urlencoded.append("itemQuantity1", "1");
	urlencoded.append("notificationURL", "https://sualoja.com.br/notifica.html");
	urlencoded.append("reference", "REF1234");
	urlencoded.append("senderName", "Jose Comprador");
	urlencoded.append("senderCPF", "05551047105");
	urlencoded.append("senderAreaCode", "11");
	urlencoded.append("senderPhone", "56273440");
	urlencoded.append("senderEmail", "c75209951484933314104@sandbox.pagseguro.com.br");
	urlencoded.append("senderHash", req.query.senderHash);
	urlencoded.append("shippingAddressStreet", "Av Brig FariaLima");
	urlencoded.append("shippingAddressNumber", "1384");
	urlencoded.append("shippingAddressComplement", "5o andar");
	urlencoded.append("shippingAddressDistrict", "Jardim Paulistano");
	urlencoded.append("shippingAddressPostalCode", "04843425");
	urlencoded.append("shippingAddressCity", "Sao Paulo");
	urlencoded.append("shippingAddressState", "SP");
	urlencoded.append("shippingAddressCountry", "BRA");
	urlencoded.append("shippingType", "1");
	urlencoded.append("shippingCost", "0.00");

	fetch(`https://ws.sandbox.pagseguro.uol.com.br/v2/transactions?email=${pagseguroEmail}&token=${pagseguroToken}`, {
		method: 'POST',
		headers: {
			"Content-Type": "application/x-www-form-urlencoded; charset=ISO-8859-1"
		},
		body: urlencoded,
		redirect: 'follow'
	})
	.then(response => response.text())
	.then(result => {
			console.log(result);
			xml2js.parseString(result, function (err, result) {
				if (err == null) {
					if ("transaction" in result)
						res.status(200).send({paymentLink: result.transaction.paymentLink[0]});
					else if ("errors" in result) 
						res.status(400).send({error: result.errors.error[0].message[0]});
					else
						res.status(500).send({});
				}
				else {
					res.status(500).send({});
				}

		});
	})
	.catch(error => res.status(500).send({error: error}));
});

router.post('/confirmCreditCardPayment', function(req, res) {

	console.log(req.query);

	fetch(`https://ws.sandbox.pagseguro.uol.com.br/v2/transactions?email=${pagseguroEmail}&token=${pagseguroToken}`, {
		method: 'POST',
		headers: {
			"Content-Type": "application/xml"
		},
		body: `<payment>\r\n    <mode>default</mode>\r\n    <method>creditCard</method>\r\n    <sender>\r\n        <name>Jose Comprador</name>\r\n        <email>c75209951484933314104@sandbox.pagseguro.com.br</email>\r\n        <phone>\r\n            <areaCode>11</areaCode>\r\n            <number>30380000</number>\r\n        </phone>\r\n        <documents>\r\n            <document>\r\n                <type>CPF</type>\r\n                <value>05551047105</value>\r\n            </document>\r\n        </documents>\r\n    \r\n    </sender>\r\n    <currency>BRL</currency>\r\n    <notificationURL>https://sualoja.com.br/notificacao</notificationURL>\r\n    <items>\r\n        <item>\r\n            <id>1</id>\r\n            <description>T-Shirt Stitch</description>\r\n            <quantity>1</quantity>\r\n            <amount>70.00</amount>\r\n        </item>\r\n    </items>\r\n<extraAmount>0.00</extraAmount>\r\n    <reference>R123456</reference>\r\n    <shipping>\r\n     <addressRequired>false</addressRequired>\r\n    </shipping>\r\n    <creditCard>\r\n        <token>${req.query.cardToken}</token>\r\n       <installment>\r\n            <noInterestInstallmentQuantity>2</noInterestInstallmentQuantity>\r\n             <quantity>${req.query.installmentQuantity}</quantity>\r\n            <value>${req.query.installmentValue}</value>\r\n        </installment>\r\n        <holder>\r\n            <name>Nome impresso no cartao</name>\r\n            <documents>\r\n                <document>\r\n                    <type>CPF</type>\r\n                    <value>05551047105</value>\r\n                </document>\r\n            </documents>\r\n            <birthDate>20/10/1980</birthDate>\r\n            <phone>\r\n                <areaCode>11</areaCode>\r\n                <number>999991111</number>\r\n            </phone>\r\n        </holder>\r\n        <billingAddress>\r\n            <street>Av. Brigadeiro Faria Lima</street>\r\n            <number>1384</number>\r\n            <complement>1 andar</complement>\r\n            <district>Jardim Paulistano</district>\r\n            <city>Sao Paulo</city>\r\n            <state>SP</state>\r\n            <country>BRA</country>\r\n            <postalCode>01452002</postalCode>\r\n        </billingAddress>\r\n    </creditCard>\r\n</payment>`,
		redirect: 'follow'
	})
	.then(response => response.text())
	.then(result => {
			console.log(result);
			xml2js.parseString(result, function (err, result) {
				if (err == null) {
					if ("transaction" in result)
						res.status(200).send({success: true});
					else if ("errors" in result) 
						res.status(400).send({error: result.errors.error[0].message[0]});
					else
						res.status(500).send({});
				}
				else {
					res.status(500).send({});
				}

		});
	})
	.catch(error => res.status(500).send({error: error}));
});

module.exports = router;