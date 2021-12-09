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
	let r_coupon_already_used = false;

	let r_total_in_cash = 0;
	let r_total = 0;

	// lista de valores dos produtos (para aplicação de cupom, por ex)

	let values = [];
	let values_in_cash = [];

	// validar produtos
	let productsIdsSet = new Set();
	let productsIds = '';
	let productsUnique = new Set();

	// criar lista de ids dos produtos para consulta no banco de dados
	try {
		for (let i=0; i<req.body.products.length; i++) {
			if (typeof req.body.products[i].id != 'number' ||
				typeof req.body.products[i].desiredQuantity != 'number' ||
				typeof req.body.products[i].size_id != 'number' )
				throw "error";
			productsIdsSet.add(req.body.products[i].id);
			productsUnique.add(`${req.body.products[i].id}_${req.body.products[i].size_id}`);
			// aproveito para acrescentar a quantidade de unidades do pedido
			r_products_units += req.body.products[i].desiredQuantity;
		}
		// verifico se todos são únicos
		if (productsUnique.size != req.body.products.length)
			throw 'error';
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

			db.getCouponByCodeForPreOrder(req.body.coupon, req.customerId, (error, results) => {

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
						single_use: results[0].single_use,
					};
					r_coupon_already_used = results[0].already_used;
				}

				// aplicar cupom
				if (results.length != 0) {

					if (r_products_total < results[0].minimum_amount)
						r_coupon_error = 'coupon minimum amount not reached';
					else if (results[0].uses >= results[0].max_uses)
						r_coupon_error = 'coupon maximum usage reached';
					else if (results[0].max_units < r_products_units)
						r_coupon_error = 'coupon maximum units exceeded';
					else if (results[0].single_use && r_coupon_already_used)
						r_coupon_error = 'coupon already used';
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
	let coupon_already_used = false;

	let total = 0;
	let total_in_cash = 0;

	let payment_method = '';
	let payment_in_cash = false;
	let payment_pagseguro = false;
	let payment_installment_quantity = null;

	let customer = {};

	let subtotal = 0;
	let extra_amount = 0;
	let _coupon_discount = 0;
	let _total = 0;
	let coupon_id = null;
	let productsForDb = {};
	let fees = 0;

	let order_id = 0;
	let payment_pagseguro_reference = '';

	let payment_pagseguro_code = '';
	let payment_boleto_link	= '';

	// validar produtos

	// lista de valores dos produtos (para aplicação de cupom, por ex)

	let values = [];
	let values_in_cash = [];

	// validar produtos
	let productsIdsSet = new Set();
	let productsIds = '';
	let productsUnique = new Set();

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
			productsUnique.add(`${req.body.products[i].id}_${req.body.products[i].size_id}`);
			// aproveito para acrescentar a quantidade de unidades do pedido
			products_units += req.body.products[i].desiredQuantity;
		}
		// verifico se todos são únicos
		if (productsUnique.size != req.body.products.length)
			throw 'error';
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

				db.getCouponByCodeForPreOrder(req.body.coupon.code, req.customerId, (error, results) => {

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
						coupon_already_used = results[0].already_used;
					}

					// aplicar cupom
					if (results.length != 0) {

						if (products_total < results[0].minimum_amount ||
							results[0].uses >= results[0].max_uses ||
							results[0].max_units < products_units ||
							results[0].single_use && coupon_already_used)
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
								typeof req.body.installmentValue !== 'number' ||
								typeof req.body.installmentTotalAmount !== 'number'))
							throw 'error';
						payment_method = req.body.paymentType;
						if (payment_method == 'PIX' || payment_method == 'BOLETO')
							payment_in_cash = true;
						else payment_in_cash = false;
						if (payment_method == 'BOLETO' || payment_method == 'CREDIT')
							payment_pagseguro = true;
						else
							payment_pagseguro = false;
						if (payment_method == 'CREDIT')
							payment_installment_quantity = req.body.installmentQuantity;
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

						if (payment_method == 'CREDIT')
							fees = parseFloat((req.body.installmentTotalAmount - _total).toFixed(2));
						else
							fees = 0;

						_total = _total + fees;

						if (payment_in_cash && _total != total_in_cash ||
							!payment_in_cash && _total != parseFloat(total) + fees)
							return res.status(500).send({error: 'values invalid'});

						db.createOrder(customer.id, subtotal, extra_amount, _coupon_discount, shipping_cost, fees,
							_total, shipping_type, customer.district_id, customer.cep, customer.street,
							customer.complement, customer.number, customer.address_observation,
							payment_method, payment_installment_quantity, payment_in_cash, payment_pagseguro,
							coupon_id, JSON.stringify(productsForDb), (error, results) => {
							if (error) 
								return res.status(500).send({error: 'products invalid'});

							order_id = results.order_id;
							payment_pagseguro_reference = results.payment_pagseguro_reference;

							if (payment_method == 'PIX')
								return res.status(200).send({
									orderInfo: {
										order_id: order_id,
										payment_method: 'PIX',
										total: _total,
									}
								});
							else if (payment_method == 'BOLETO') {

							/* INICIO PAGSEGURO BOLETO */

								var urlencoded = new URLSearchParams();
								urlencoded.append("paymentMode", "DEFAULT");
								urlencoded.append("paymentMethod", "boleto");
								urlencoded.append("receiverEmail", "diretoriaprv@gmail.com");
								urlencoded.append("currency", "BRL");
								urlencoded.append("extraAmount", (extra_amount - _coupon_discount - 1).toFixed(2));

								for (let i=0; i<products.length; i++) {
									urlencoded.append("itemId"+(i+1), products[i].id+'_'+products[i].size_id);
									urlencoded.append("itemDescription"+(i+1), products[i].name.substr(0, 100));
									urlencoded.append("itemAmount"+(i+1), products[i].price.toFixed(2));
									urlencoded.append("itemQuantity"+(i+1), products[i].desiredQuantity);
								}

								urlencoded.append("notificationURL", "https://belalily.com.br/api/pagseguro/notification");
								urlencoded.append("reference", payment_pagseguro_reference);

								urlencoded.append("senderName", customer.name.substr(0, 50));
								urlencoded.append("senderCPF", customer.cpf);
								urlencoded.append("senderAreaCode", customer.mobile.substr(0, 2));
								urlencoded.append("senderPhone", customer.mobile.substr(2, 9));
								urlencoded.append("senderEmail", customer.email.substr(0, 60));
								urlencoded.append("senderHash", req.body.senderHash);

								urlencoded.append("shippingAddressRequired", "true");
								urlencoded.append("shippingAddressStreet", customer.street.substr(0, 80));
								urlencoded.append("shippingAddressNumber", customer.number.substr(0, 20));
								urlencoded.append("shippingAddressComplement", customer.complement.substr(0, 40));
								urlencoded.append("shippingAddressDistrict", customer.district_name.substr(0, 60));
								urlencoded.append("shippingAddressPostalCode", customer.cep);
								urlencoded.append("shippingAddressCity", customer.city_name.substr(0, 60));
								urlencoded.append("shippingAddressState", customer.city_uf);
								urlencoded.append("shippingAddressCountry", 'BRA');

								urlencoded.append("shippingCost", shipping_cost.toFixed(2));

								fetch(`${pagseguro.APIUrl}v2/transactions?email=${pagseguro.Email}&token=${pagseguro.Token}`, {
									method: 'POST',
									headers: {
										"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
									},
										body: urlencoded,
										redirect: 'follow'
								})
								.then(response => response.text())
								.then(result => {
									xml2js.parseString(result, function (err, result) {
										if (err == null) {
											if ("transaction" in result) {
												// pedido foi gerado no pagseguro
												payment_boleto_link = result.transaction.paymentLink[0];
												payment_pagseguro_code = result.transaction.code[0];
												db.startOrderByBoleto(order_id, payment_pagseguro_code, payment_boleto_link, (error, results) => {
													return res.status(200).send({
														orderInfo: {
															order_id: order_id,
															total: _total,
															payment_method: 'BOLETO',
															payment_boleto_link: payment_boleto_link,
														}
													});
												});
											}
											else {
												// erro ao gerar pedido no pagseguro
												db.deleteOrder(order_id, (error, results) => {
													return res.status(500).send({error: 'pagseguro error:' + result.errors.error[0].message[0]});
												});
											}
										}
										else {
											// erro na resposta do pagseguro - pedido não deveria ser gerado no pagseguro
											db.deleteOrder(order_id, (error, results) => {
												return res.status(500).send({error: 'pagseguro error'});
											});
										}
									});
								})
								.catch(error => {
									// erro requisição http - pedido não foi gerado no pagseguro
									db.deleteOrder(order_id, (error, results) => {
										return res.status(500).send({error: 'pagseguro error'});
									});
								});

							/* FIM PAGSEGURO BOLETO */

							} else if (payment_method == 'CREDIT') {

							/* INICIO PAGSEGURO CREDITO */

							var urlencoded = new URLSearchParams();
								urlencoded.append("paymentMode", "DEFAULT");
								urlencoded.append("paymentMethod", "creditCard");
								urlencoded.append("receiverEmail", "diretoriaprv@gmail.com");
								urlencoded.append("currency", "BRL");
								urlencoded.append("extraAmount", (extra_amount - _coupon_discount).toFixed(2));

								for (let i=0; i<products.length; i++) {
									urlencoded.append("itemId"+(i+1), products[i].id+'_'+products[i].size_id);
									urlencoded.append("itemDescription"+(i+1), products[i].name.substr(0, 100));
									urlencoded.append("itemAmount"+(i+1), products[i].price.toFixed(2));
									urlencoded.append("itemQuantity"+(i+1), products[i].desiredQuantity);
								}

								urlencoded.append("notificationURL", "https://belalily.com.br/api/pagseguro/notification");
								urlencoded.append("reference", payment_pagseguro_reference);

								urlencoded.append("senderName", customer.name.substr(0, 50));
								urlencoded.append("senderCPF", customer.cpf);
								urlencoded.append("senderAreaCode", customer.mobile.substr(0, 2));
								urlencoded.append("senderPhone", customer.mobile.substr(2, 9));
								urlencoded.append("senderEmail", customer.email.substr(0, 60));
								urlencoded.append("senderHash", req.body.senderHash);

								urlencoded.append("shippingAddressRequired", "true");
								urlencoded.append("shippingAddressStreet", customer.street.substr(0, 80));
								urlencoded.append("shippingAddressNumber", customer.number.substr(0, 20));
								urlencoded.append("shippingAddressComplement", customer.complement.substr(0, 40));
								urlencoded.append("shippingAddressDistrict", customer.district_name.substr(0, 60));
								urlencoded.append("shippingAddressPostalCode", customer.cep);
								urlencoded.append("shippingAddressCity", customer.city_name.substr(0, 60));
								urlencoded.append("shippingAddressState", customer.city_uf);
								urlencoded.append("shippingAddressCountry", 'BRA');

								urlencoded.append("shippingCost", shipping_cost.toFixed(2));

								urlencoded.append("creditCardToken", req.body.cardToken);
								urlencoded.append("installmentQuantity", req.body.installmentQuantity);
								urlencoded.append("installmentValue", req.body.installmentValue.toFixed(2));
								if (_total >= 100)
									urlencoded.append("noInterestInstallmentQuantity", 3);
								urlencoded.append("creditCardHolderName", customer.name.substr(0, 50));
								urlencoded.append("creditCardHolderCPF", customer.cpf);
								urlencoded.append("creditCardHolderBirthDate",
									new Date(customer.birthday).toLocaleString('pt-br', {year: 'numeric', month: '2-digit', day: '2-digit'}));
								urlencoded.append("creditCardHolderAreaCode", customer.mobile.substr(0, 2));
								urlencoded.append("creditCardHolderPhone", customer.mobile.substr(2, 9));

								urlencoded.append("billingAddressStreet", customer.street.substr(0, 80));
								urlencoded.append("billingAddressNumber", customer.number.substr(0, 20));
								urlencoded.append("billingAddressComplement", customer.complement.substr(0, 40));
								urlencoded.append("billingAddressDistrict", customer.district_name.substr(0, 60));
								urlencoded.append("billingAddressPostalCode", customer.cep);
								urlencoded.append("billingAddressCity", customer.city_name.substr(0, 60));
								urlencoded.append("billingAddressState", customer.city_uf);
								urlencoded.append("billingAddressCountry", 'BRA');

								fetch(`${pagseguro.APIUrl}v2/transactions?email=${pagseguro.Email}&token=${pagseguro.Token}`, {
									method: 'POST',
									headers: {
										"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
									},
										body: urlencoded,
										redirect: 'follow'
								})
								.then(response => response.text())
								.then(result => {
									xml2js.parseString(result, function (err, result) {
										if (err == null) {
											if ("transaction" in result) {
												// pedido foi gerado no pagseguro
												payment_pagseguro_code = result.transaction.code[0];
												db.startOrderByCredit(order_id, payment_pagseguro_code, (error, results) => {
													return res.status(200).send({
														orderInfo: {
															order_id: order_id,
															total: _total,
															payment_method: 'CREDIT',
															installmentQuantity: req.body.installmentQuantity,
															installmentValue: req.body.installmentValue,
															fees: fees,
														}
													});
												});
											}
											else {
												// erro ao gerar pedido no pagseguro
												db.deleteOrder(order_id, (error, results) => {
													return res.status(500).send({error: 'pagseguro error:' + result.errors.error[0].message[0]});
												});
											}
										}
										else {
											// erro na resposta do pagseguro - pedido não deveria ser gerado no pagseguro
											db.deleteOrder(order_id, (error, results) => {
												return res.status(500).send({error: 'pagseguro error'});
											});
										}
									});
								})
								.catch(error => {
									// erro requisição http - pedido não foi gerado no pagseguro
									db.deleteOrder(order_id, (error, results) => {
										return res.status(500).send({error: 'pagseguro error'});
									});
								});

							/* FIM PAGSEGURO CREDITO */

							}

						});

					});

				});

			});

		} catch (e) {
			return res.status(500).send({error: 'products invalid'});
		}
	});	
});

router.post('/with-filter', VerifyUserToken, GetUserProfile, function(req, res) {

	if (!req.userProfile['orders_module'])
		return res.status(500).send({error: 'permission denied'});

	let customerInfo = String(req.body.customerInfo);
	let orderId = String(req.body.orderId);
	let status = String(req.body.status);
	let payment_method = String(req.body.payment_method);
	let payment_status = String(req.body.payment_status);

	db.getOrdersListWithFilter(customerInfo, orderId, status, payment_method, payment_status, (error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({orders: results});
	});
});

router.get('/:id', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!req.userProfile['orders_module'])
		return res.status(500).send({error: 'permission denied'});
	db.getOrderInfo(req.params.id ,(error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({order: results});
	});
});

router.get('/:id/events', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!(req.userProfile['orders_module']))
		return res.status(500).send({error: 'permission denied'});
	db.getOrderEvents(req.params.id, (error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({events: results});
	});
});

router.patch('/:id/update-status', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!(req.userProfile['change_order_status']))
		return res.status(500).send({error: 'permission denied'});

	let status = String(req.body.status);
	let reason = req.body.reason;

	if (['IN_PROGRESS', 'FINISHED', 'CANCELED'].indexOf(status) == -1)
		return res.status(500).send({error: 'status invalid'});

	if (reason == null || String(reason).length < 1)
		return res.status(500).send({error:"reason too short"});
	if (String(reason).length > 100)
		return res.status(500).send({error:"reason too long"});

	db.updateOrderStatus(req.params.id, status, reason, req.userId, (error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({success: true});
	});
});

router.patch('/:id/update-payment-status', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!(req.userProfile['change_order_payment_status']))
		return res.status(500).send({error: 'permission denied'});

	let payment_status = String(req.body.payment_status);
	let reason = req.body.reason;

	if (['AWAITING_PAYMENT', 'CONFIRMED', 'CANCELED'].indexOf(payment_status) == -1)
		return res.status(500).send({error: 'payment_status invalid'});

	if (reason == null || String(reason).length < 1)
		return res.status(500).send({error:"reason too short"});
	if (String(reason).length > 100)
		return res.status(500).send({error:"reason too long"});

	db.updateOrderPaymentStatus(req.params.id, payment_status, reason, req.userId, (error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({success: true});
	});
});

router.patch('/:id/update-shipping-status', VerifyUserToken, GetUserProfile, function(req, res) {
	if (!(req.userProfile['change_order_shipping_status']))
		return res.status(500).send({error: 'permission denied'});

	let shipping_status = String(req.body.shipping_status);
	let reason = req.body.reason;

	if (['NOT_STARTED', 'IN_SEPARATION', 'READY_FOR_DELIVERY', 'OUT_TO_DELIVERY', 'DELIVERED', 'DELIVERY_FAILURE'].indexOf(shipping_status) == -1)
		return res.status(500).send({error: 'shipping_status invalid'});

	if (reason == null || String(reason).length < 1)
		return res.status(500).send({error:"reason too short"});
	if (String(reason).length > 100)
		return res.status(500).send({error:"reason too long"});

	db.updateOrderShippingStatus(req.params.id, shipping_status, reason, req.userId, (error, results) => {
		if (error)
			return res.status(500).send({error: error});
		res.status(200).send({success: true});
	});
});

module.exports = router;