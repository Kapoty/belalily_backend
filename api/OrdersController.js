var db = require("../db");
const util = require("../util")

const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json({limit: '50mb'}));

const VerifyCustomerToken = require('./VerifyCustomerToken')

router.post('/me/pre-order', VerifyCustomerToken, function(req, res) {

	// resposta

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

	// valores

	let values = [];
	let values_in_cash = [];

	// validar produtos
	let productsIdsSet = new Set();
	let productsIds = '';

	try {
		for (let i=0; i<req.body.products.length; i++) {
			if (typeof req.body.products[i].id != 'number' ||
				typeof req.body.products[i].desiredQuantity != 'number' ||
				typeof req.body.products[i].size_id != 'number' )
				throw "error";
			productsIdsSet.add(req.body.products[i].id);
			r_products_units += req.body.products[i].desiredQuantity;
		}
		productsIds = Array.from(productsIdsSet).join(',');
	} catch (e) {
		return res.status(500).send({error: 'products invalid'});
	}

	if (r_products_units == 0 || r_products_units > 10)
		return res.status(500).send({error: 'products invalid'});

	db.getProductsForPreOrder(productsIds, (error, results) => {
		if (error)
			return res.status(500).send({error: 'products invalid'});

		let db_productsById = {};
		for (let i=0; i<results.length; i++)
				db_productsById[results[i].id] = results[i];

		try {
			for (let i=0; i<req.body.products.length; i++) {
				if (!(req.body.products[i].id in db_productsById))
					throw 'error';
				r_products.push({
					id: req.body.products[i].id,
					name: db_productsById[req.body.products[i].id].name,
					price: db_productsById[req.body.products[i].id].price,
					price_in_cash: db_productsById[req.body.products[i].id].price_in_cash,
					size_id: req.body.products[i].size_id,
					desiredQuantity: req.body.products[i].desiredQuantity,
				});
				r_products_total += db_productsById[req.body.products[i].id].price * req.body.products[i].desiredQuantity;
				r_products_total_in_cash += db_productsById[req.body.products[i].id].price_in_cash * req.body.products[i].desiredQuantity;
				for (let j=0; j<req.body.products[i].desiredQuantity; j++) {
					values.push(db_productsById[req.body.products[i].id].price);
					values_in_cash.push(db_productsById[req.body.products[i].id].price_in_cash);
				}
				values.sort((a, b) => b-a);
				values_in_cash.sort((a, b) => b-a);
			}
		} catch (e) {
			return res.status(500).send({error: 'products invalid'});
		}

		// validar entrega

		db.getDistrictForPreOrder(req.customerId, (error, results) => {
			if (error)
				return res.status(500).send({error: 'shipping invalid'});

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
						switch(r_coupon.type.toLowerCase()) {
							case 'percent':
								r_coupon_discount += r_coupon.value/100 * r_products_total;
								r_coupon_discount_in_cash += r_coupon.value/100 * r_products_total_in_cash;
								r_coupon_applied = true;
							break;
							case 'gross':
								r_coupon_discount += r_coupon.value;
								r_coupon_discount_in_cash += r_coupon.value;
								r_coupon_applied = true;
							break;
							case 'twopercent':
								for (let i=0; i<Math.floor(Math.min(r_coupon.max_units/2, values.length/2)); i++) {
									r_coupon_discount += r_coupon.value/100 * values[i];
									r_coupon_discount_in_cash += r_coupon.value/100 * values_in_cash[i];
								}
								r_coupon_applied = true;
							break;
							case 'twogross':
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

module.exports = router;