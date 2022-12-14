import { initMongoose } from "../../lib/mongoose";
import Order from "../../models/Order";
import Product from "../../models/Product";
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    await initMongoose()

    if(req.method !== 'POST') {
        res.json({msg: 'should a post but its not!'})
        return
    }

    const productsIds = req.body.products.split(',')
    const uniqIds = [...new Set(productsIds)]
    const products = await Product.find({_id: {$in: uniqIds}}).exec()

    let line_items = []
    for (let productId of uniqIds) {
        const quantity = productsIds.filter(id => id === productId).length
        const product = products.find(p => p._id.toString() === productId)
        line_items.push({
            quantity,
            price_data: {
                currency: 'BRL',
                product_data: {name: product.name},
                unit_amount: (Number(product.price) * 100).toFixed(0)
            }
        })
    }

    const {name, email, address, city} = req.body
    const order = await Order.create({
        products: line_items,
        name,
        email,
        address,
        city,
        paid: 0
    })

    try {
        const session = await stripe.checkout.sessions.create({
            line_items: line_items,
            mode: 'payment',
            success_url: `${req.headers.origin}/?success=true`,
            cancel_url: `${req.headers.origin}/?canceled=true`,
            metadata: {orderId: order._id.toString()}
          });
          return res.redirect(303, session.url)
    } catch(e) {
        return res.status(err.statusCode || 500).json(err.message);
    }
}