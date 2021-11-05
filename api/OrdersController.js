var db = require("../db");
const util = require("../util")

const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json({limit: '50mb'}));

const VerifyCustomerToken = require('./VerifyCustomerToken')

const config = require('../config'); 
const pagseguro = config.pagseguro;

const fetch = require('cross-fetch');
const xml2js = require('xml2js');

router.post('/me/pre-order', VerifyCustomerToken, function(req, res) {

	// variaveis para a resposta

	let r_products = [];
	let r_products_units = 0;

	let r_products_total = 0;
	let r_products_total_in_cash = 0;

	let r_shipping_type = '';
	let r_shipping_cost = 0;

	let r_coupon = null;
	let r_coupon_applied = false;
	let r_coupon_discount = 0;
	let r_coupon_discount_in_cash = 0;
	let r_coupon_error = '';

	let r_total_in_cash = 0;
	let r_total = 0;

	// lista de valores dos produtos (para aplicação de cupom, por ex)

	let values = [];
	let values_in_cash = [];

	// validar produtos
	let productsIdsSet = new Set();
	let productsIds = '';

	// criar lista de ids dos produtos para consulta no banco de dados
	try {
		for (let i=0; i<req.body.products.length; i++) {
			if (typeof req.body.products[i].id != 'number' ||
				typeof req.body.products[i].desiredQuantity != 'number' ||
				typeof req.body.products[i].size_id != 'number' )
				throw "error";
			productsIdsSet.add(req.body.products[i].id);
			// aproveito para acrescentar a quantidade de unidades do pedido
			r_products_units += req.body.products[i].desiredQuantity;
		}
		productsIds = Array.from(productsIdsSet).join(',');
	} catch (e) {
		return res.status(500).send({error: 'products invalid'});
	}

	// valido a quantidade mínima e máxima de unidades por pedido
	if (r_products_units == 0 || r_products_units > 10)
		return res.status(500).send({error: 'products invalid'});

	// obtenho as informações de todos os ids de produtos
	db.getProductsForPreOrder(productsIds, (error, results) => {
		if (error)
			return res.status(500).send({error: 'products invalid'});

		// crio um mapa productId => informações do produto
		let db_productsById = {};
		for (let i=0; i<results.length; i++)
				db_productsById[results[i].id] = results[i];

		try {
			for (let i=0; i<req.body.products.length; i++) {
				// verifico se possuo a informação desse produto
				if (!(req.body.products[i].id in db_productsById))
					throw 'error';
				// se houver, adiciono as informações obtidas do banco de dados na resposta
				r_products.push({
					id: req.body.products[i].id,
					name: db_productsById[req.body.products[i].id].name,
					price: db_productsById[req.body.products[i].id].price,
					price_in_cash: db_productsById[req.body.products[i].id].price_in_cash,
					size_id: req.body.products[i].size_id,
					desiredQuantity: req.body.products[i].desiredQuantity,
				});
				// incremento o valor total dos produtos (tanto a vista quanto a prazo)
				r_products_total += db_productsById[req.body.products[i].id].price * req.body.products[i].desiredQuantity;
				r_products_total_in_cash += db_productsById[req.body.products[i].id].price_in_cash * req.body.products[i].desiredQuantity;
				// adiciono o valor dos produtos nas listas de valores (para uso em cupons)
				for (let j=0; j<req.body.products[i].desiredQuantity; j++) {
					values.push(db_productsById[req.body.products[i].id].price);
					values_in_cash.push(db_productsById[req.body.products[i].id].price_in_cash);
				}
			}

			// ordeno a lista de valores
			values.sort((a, b) => b-a);
			values_in_cash.sort((a, b) => b-a);
		} catch (e) {
			return res.status(500).send({error: 'products invalid'});
		}

		// validar entrega

		// obtenho os dados do bairro do usuário
		db.getDistrictForPreOrder(req.customerId, (error, results) => {
			if (error)
				return res.status(500).send({error: 'shipping invalid'});

			// valido se a opção de entrega selecionada é válida
			if (typeof req.body.shipping_type != 'string')
				return res.status(500).send({error: 'shipping invalid'});

			switch(req.body.shipping_type) {
				case "FREE":
					if (!Boolean(results.shipping_free_available))
						return res.status(500).send({error: 'shipping invalid'});
					r_shipping_cost = 0;
					r_shipping_type = "FREE";
				break;
				case "NORMAL":
					r_shipping_cost = results.shipping_normal_price;
					r_shipping_type = "NORMAL";
				break;
				case "EXPRESS":
					r_shipping_cost = results.shipping_express_price;
					r_shipping_type = "EXPRESS";
				break;
				default:
					return res.status(500).send({error: 'shipping invalid'});
			}

			// validar cupom

			if (typeof req.body.coupon != 'string')
				req.body.coupon = '';

			db.getCouponByCode(req.body.coupon, (error, results) => {

				if (error || results.length == 0) {
					if (req.body.coupon != '')
						r_coupon_error = 'coupon invalid';
				} else {
					r_coupon = {
						code: results[0].code,
						type: results[0].type,
						value: results[0].value,
						minimum_amount: results[0].minimum_amount,
						max_units: results[0].max_units,
					};
				}

				// aplicar cupom
				if (results.length != 0) {

					if (r_products_total < results[0].minimum_amount)
						r_coupon_error = 'coupon minimum amount not reached';
					else if (results[0].uses >= results[0].max_uses)
						r_coupon_error = 'coupon maximum usage reached';
					else if (results[0].max_units < r_products_units)
						r_coupon_error = 'coupon maximum units exceeded';
					else {
						switch(r_coupon.type) {
							case 'PERCENT':
								r_coupon_discount += r_coupon.value/100 * r_products_total;
								r_coupon_discount_in_cash += r_coupon.value/100 * r_products_total_in_cash;
								r_coupon_applied = true;
							break;
							case 'GROSS':
								r_coupon_discount += r_coupon.value;
								r_coupon_discount_in_cash += r_coupon.value;
								r_coupon_applied = true;
							break;
							case 'TWO_PERCENT':
								for (let i=0; i<Math.floor(Math.min(r_coupon.max_units/2, values.length/2)); i++) {
									r_coupon_discount += r_coupon.value/100 * values[i];
									r_coupon_discount_in_cash += r_coupon.value/100 * values_in_cash[i];
								}
								r_coupon_applied = true;
							break;
							case 'TWO_GROSS':
								for (let i=0; i<Math.floor(Math.min(r_coupon.max_units/2, values.length/2)); i++) {
									r_coupon_discount += r_coupon.value;
									r_coupon_discount_in_cash += r_coupon.value;
								}
								r_coupon_applied = true;
							break;
						}
					}


					r_coupon_discount = Math.max(0, Math.min(r_products_total, r_coupon_discount));
					r_coupon_discount_in_cash = Math.max(0, Math.min(r_products_total_in_cash, r_coupon_discount_in_cash));

					r_coupon_discount = r_coupon_discount.toFixed(2);
					r_coupon_discount_in_cash = r_coupon_discount_in_cash.toFixed(2);

				}

				r_total = r_products_total + r_shipping_cost - r_coupon_discount;
				r_total = r_total.toFixed(2);
				r_total_in_cash = r_products_total_in_cash + r_shipping_cost - r_coupon_discount_in_cash;
				r_total_in_cash = r_total_in_cash.toFixed(2);

				res.status(200).send({preOrder: {
					products: r_products,
					products_units: r_products_units,
					products_total: r_products_total,
					products_total_in_cash: r_products_total_in_cash,
					shipping_type: r_shipping_type,
					shipping_cost: r_shipping_cost,
					coupon: r_coupon,
					coupon_applied: r_coupon_applied,
					coupon_discount: r_coupon_discount,
					coupon_discount_in_cash: r_coupon_discount_in_cash,
					coupon_error: r_coupon_error,
					total: r_total,
					total_in_cash: r_total_in_cash,
				}});
			});

		});
	});
});

router.get('/pagseguro-session/', function(req, res) {
	fetch(pagseguro.APIUrl + `v2/sessions?email=${pagseguro.Email}&token=${pagseguro.Token}`, {
		method: "POST"
	})
	.then(response => response.text())
	.then(result => {
			xml2js.parseString(result, function (error, result) {
				if (error == null)
					res.status(200).send({sessionId: result.session.id[0]});
				else
					res.status(500).send({error: error});
		});
	})
	.catch(error => res.status(500).send({error: error}));
});

router.post('/me/create-order', VerifyCustomerToken, function(req, res) {

	// variaveis para criacao do pedido

	let products_units = 0;
	let products = [];
	let products_total = 0;
	let products_total_in_cash = 0;

	let shipping_cost = 0;
	let shipping_type = '';

	let coupon = {};
	let coupon_applied = false;
	let coupon_discount = 0;
	let coupon_discount_in_cash = 0;

	let total = 0;
	let total_in_cash = 0;

	let payment_method = '';
	let payment_in_cash = false;
	let payment_pagseguro = false;

	let customer = {};

	let subtotal = 0;
	let extra_amount = 0;
	let _coupon_discount = 0;
	let _total = 0;
	let coupon_id = null;
	let productsForDb = {};

	let order_id = 0;
	let payment_pagseguro_reference = '';

	// validar produtos

	// lista de valores dos produtos (para aplicação de cupom, por ex)

	let values = [];
	let values_in_cash = [];

	// validar produtos
	let productsIdsSet = new Set();
	let productsIds = '';

	// criar lista de ids dos produtos para consulta no banco de dados
	try {
		for (let i=0; i<req.body.products.length; i++) {
			if (typeof req.body.products[i].id != 'number' ||
				typeof req.body.products[i].desiredQuantity != 'number' ||
				typeof req.body.products[i].size_id != 'number' ||
				typeof req.body.products[i].name != 'string' ||
				typeof req.body.products[i].price != 'number' ||
				typeof req.body.products[i].price_in_cash != 'number' )
				throw "error";
			productsIdsSet.add(req.body.products[i].id);
			// aproveito para acrescentar a quantidade de unidades do pedido
			products_units += req.body.products[i].desiredQuantity;
		}
		productsIds = Array.from(productsIdsSet).join(',');
	} catch (e) {
		return res.status(500).send({error: 'products invalid'});
	}

	// valido a quantidade mínima e máxima de unidades por pedido
	if (products_units == 0 || products_units > 10)
		return res.status(500).send({error: 'products invalid'});

	// obtenho as informações de todos os ids de produtos
	db.getProductsForPreOrder(productsIds, (error, results) => {
		if (error)
			return res.status(500).send({error: 'products invalid'});

		// crio um mapa productId => informações do produto
		let db_productsById = {};
		for (let i=0; i<results.length; i++)
				db_productsById[results[i].id] = results[i];

		try {
			for (let i=0; i<req.body.products.length; i++) {
				// verifico se possuo a informação desse produto
				if (!(req.body.products[i].id in db_productsById))
					throw 'error';
				// se houver, comparo as informacoes obtidas no banco de dados com as enviadas pelo cliente
				if (req.body.products[i].name !== db_productsById[req.body.products[i].id].name ||
					req.body.products[i].price !== db_productsById[req.body.products[i].id].price ||
					req.body.products[i].price_in_cash !== db_productsById[req.body.products[i].id].price_in_cash)
					throw 'error';
				// se estiver tudo certo, adiciono as informações obtidas do banco de dados no pedido
				products.push({
					id: req.body.products[i].id,
					name: db_productsById[req.body.products[i].id].name,
					price: db_productsById[req.body.products[i].id].price,
					price_in_cash: db_productsById[req.body.products[i].id].price_in_cash,
					size_id: req.body.products[i].size_id,
					desiredQuantity: req.body.products[i].desiredQuantity,
				});
				// incremento o valor total dos produtos (tanto a vista quanto a prazo)
				products_total += db_productsById[req.body.products[i].id].price * req.body.products[i].desiredQuantity;
				products_total_in_cash += db_productsById[req.body.products[i].id].price_in_cash * req.body.products[i].desiredQuantity;
				// adiciono o valor dos produtos nas listas de valores (para uso em cupons)
				for (let j=0; j<req.body.products[i].desiredQuantity; j++) {
					values.push(db_productsById[req.body.products[i].id].price);
					values_in_cash.push(db_productsById[req.body.products[i].id].price_in_cash);
				}
			}

			// ordeno a lista de valores
			values.sort((a, b) => b-a);
			values_in_cash.sort((a, b) => b-a);

			// aqui os valores e nomes dos produtos estão validados

			// validar entrega

			// obtenho os dados do bairro do usuário
			db.getDistrictForPreOrder(req.customerId, (error, results) => {
				if (error)
					return res.status(500).send({error: 'shipping invalid'});

				// valido se a opção de entrega selecionada é válida
				if (typeof req.body.shipping_type != 'string' ||
					typeof req.body.shipping_cost != 'number')
					return res.status(500).send({error: 'shipping invalid'});

				switch(req.body.shipping_type) {
					case "FREE":
						if (!Boolean(results.shipping_free_available))
							return res.status(500).send({error: 'shipping invalid'});
						shipping_cost = 0;
						shipping_type = "FREE";
					break;
					case "NORMAL":
						shipping_cost = results.shipping_normal_price;
						shipping_type = "NORMAL";
					break;
					case "EXPRESS":
						shipping_cost = results.shipping_express_price;
						shipping_type = "EXPRESS";
					break;
					default:
						return res.status(500).send({error: 'shipping invalid'});
				}

				// verifico se as informações obtidas batem com as do cliente
				if (req.body.shipping_cost !== shipping_cost)
					return res.status(500).send({error: 'shipping invalid'});

				// aqui a forma de entrega está validada

				// validar cupom

				try {
					if (req.body.coupon_applied &&
						typeof req.body.coupon.code !== 'string')
						throw 'error';
					else if (!req.body.coupon_applied)
						req.body.coupon = {code: ''};
				} catch (e) {
					return res.status(500).send({error: 'coupon invalid'});
				}

				db.getCouponByCode(req.body.coupon.code, (error, results) => {

					if (error || (results.length == 0 && req.body.coupon_applied))
						return res.status(500).send({error: 'coupon invalid'});
					else if (results.length != 0) { 
						coupon = {
							id: results[0].id,
							code: results[0].code,
							type: results[0].type,
							value: results[0].value,
							minimum_amount: results[0].minimum_amount,
							max_units: results[0].max_units,
						};
					}

					// aplicar cupom
					if (results.length != 0) {

						if (products_total < results[0].minimum_amount ||
							results[0].uses >= results[0].max_uses ||
							results[0].max_units < products_units)
							return res.status(500).send({error: 'coupon invalid'});
						else {
							switch(coupon.type) {
								case 'PERCENT':
									coupon_discount += coupon.value/100 * products_total;
									coupon_discount_in_cash += coupon.value/100 * products_total_in_cash;
									coupon_applied = true;
								break;
								case 'GROSS':
									coupon_discount += coupon.value;
									coupon_discount_in_cash += coupon.value;
									coupon_applied = true;
								break;
								case 'TWO_PERCENT':
									for (let i=0; i<Math.floor(Math.min(coupon.max_units/2, values.length/2)); i++) {
										coupon_discount += coupon.value/100 * values[i];
										coupon_discount_in_cash += coupon.value/100 * values_in_cash[i];
									}
									coupon_applied = true;
								break;
								case 'TWO_GROSS':
									for (let i=0; i<Math.floor(Math.min(coupon.max_units/2, values.length/2)); i++) {
										coupon_discount += coupon.value;
										coupon_discount_in_cash += coupon.value;
									}
									coupon_applied = true;
								break;
							}
						}

						if (coupon_applied)
							coupon_id = coupon.id;
						else coupon_id = null;

						coupon_discount = Math.max(0, Math.min(products_total, coupon_discount));
						coupon_discount_in_cash = Math.max(0, Math.min(products_total_in_cash, coupon_discount_in_cash));

						coupon_discount = coupon_discount.toFixed(2);
						coupon_discount_in_cash = coupon_discount_in_cash.toFixed(2);

						// comparo se o cupom bate com o do usuário

						try {
							if (coupon_discount !== req.body.coupon_discount ||
								coupon_discount_in_cash !== req.body.coupon_discount_in_cash ||
								coupon_applied !== req.body.coupon_applied)
								throw 'error';
						} catch(e) {
							return res.status(500).send({error: 'coupon invalid'});
						}

					}

					// aqui o cupom está validado

					// calculo os valores totais da compra

					total = products_total + shipping_cost - coupon_discount;
					total = total.toFixed(2);
					total_in_cash = products_total_in_cash + shipping_cost - coupon_discount_in_cash;
					total_in_cash = total_in_cash.toFixed(2);

					// comparo os valores totais da compra com os do cliente

					try {
						if (total !== req.body.total ||
							total_in_cash !== req.body.total_in_cash)
							throw 'error';
					} catch(e) {
						return res.status(500).send({error: 'values invalid'});
					}

					// aqui os valores estão validados

					// valido se tenho tudo sobre o metodo de pagamento informado
					try {
						if (typeof req.body.paymentType !== 'string' ||
							['PIX', 'BOLETO', 'CREDIT'].indexOf(req.body.paymentType) == -1)
							throw 'error';
						if (req.body.paymentType === 'BOLETO' &&
							typeof req.body.senderHash !== 'string')
							throw 'error';
						if (req.body.paymentType === 'CREDIT' &&
								(typeof req.body.senderHash !== 'string' ||
								typeof req.body.cardToken !== 'string' ||
								typeof req.body.installmentQuantity !== 'number' ||
								typeof req.body.installmentValue !== 'number'))
							throw 'error';
						payment_method = req.body.paymentType;
						if (payment_method == 'PIX' || payment_method == 'BOLETO')
							payment_in_cash = true;
						else payment_in_cash = false;
						if (payment_method == 'BOLETO' || payment_method == 'CREDIT')
							payment_pagseguro = true;
						else payment_pagseguro = false;
					} catch(e) {
						return res.status(500).send({error: 'payment invalid'});
					}

					// aqui está validado

					// obtenho os dados do cliente, para chamada no pagseguro e criacao do pedido

					db.getCustomerInfoForOrder(req.customerId, (error, results) => {
						if (error)
							return res.status(500).send({error: 'unexpected'});

						customer = results;

						// se chegamos aqui, então está tudo pronto para criar o pedido

						// defino a variavel productsForDb

						for (let i=0; i<products.length; i++) {
							productsForDb['p'+(i+1)] = {
								"id": products[i].id,
								"size_id": products[i].size_id,
								"quantity": products[i].desiredQuantity,
								"price": products[i].price,
								"price_in_cash": products[i].price_in_cash,
							}
						}

						productsForDb.numberOfProducts = products.length;

						// definir variaveis finais

						subtotal = products_total;

						if (payment_in_cash) {
							extra_amount = products_total_in_cash - products_total;
							_coupon_discount = coupon_discount_in_cash;
						} else {
							extra_amount = 0;
							_coupon_discount = coupon_discount;
						}

						_total = subtotal + extra_amount + shipping_cost - _coupon_discount;

						if (payment_in_cash && _total != total_in_cash ||
							!payment_in_cash && _total != total)
							return res.status(500).send({error: 'values invalid'});

						db.createOrder(customer.id, subtotal, extra_amount, _coupon_discount, shipping_cost,
							_total, shipping_type, customer.district_id, customer.cep, customer.street,
							customer.complement, customer.number, customer.address_observation,
							payment_method, payment_in_cash, payment_pagseguro,
							coupon_id, JSON.stringify(productsForDb), (error, results) => {
							if (error) 
								return res.status(500).send({error: 'products invalid'});

							console.log(results);

							order_id = results.order_id;
							payment_pagseguro_reference = results.payment_pagseguro_reference;

							return res.status(200).send({
								orderInfo: {
									order_id: order_id,
									payment_pagseguro_reference: payment_pagseguro_reference,
								}
							});

						});

					});

				});

			});

		} catch (e) {
			return res.status(500).send({error: 'products invalid'});
		}
	});	
});

module.exports = router;

/*
{
	"products":[
		{
			"id":2,
			"name":"Cropped Exemplo",
			"price":25,
			"price_in_cash":20,
			"size_id":4,
			"desiredQuantity":1
		},
		{
			"id":1,
			"name":"T-Shirt Exemplo",
			"price":35,
			"price_in_cash":30,
			"size_id":2,
			"desiredQuantity":1
		}
	],
	"products_units":2,
	"products_total":60,
	"products_total_in_cash":50,
	"shipping_type":"EXPRESS",
	"shipping_cost":10,
	"coupon":{
		"code":"5PORCENTO",
		"type":"PERCENT",
		"value":5,
		"minimum_amount":40,
		"max_units":6
	},
	"coupon_applied":true,
	"coupon_discount":"3.00",
	"coupon_discount_in_cash":"2.50",
	"coupon_error":"",
	"total":"67.00",
	"total_in_cash":"57.50",

	"paymentType":"PIX"

	"paymentType":"BOLETO",
	"senderHash":"c73800b7ac8c828901bfc54157a790fb1631dad1638542eb29e35a0e3736c05e"

	"paymentType":"CREDIT",
	"senderHash":"c73800b7ac8c828901bfc54157a790fb1631dad1638542eb29e35a0e3736c05e"
	"cardToken":"78bb23e88b2c4a34a4f2335e912fdf86",
	"installmentQuantity":1,
	"installmentValue":70
}
*/