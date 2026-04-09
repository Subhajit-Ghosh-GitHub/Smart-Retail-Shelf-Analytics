import express from "express"
import mongoose, {Error} from "mongoose"
import Products from "./Products.js"
import CartItems from "./CartItems.js"
import PatternMining from "./PatternMining.js"
import dotenv from "dotenv";

dotenv.config();

const app = express()
//mongodb://localhost:27017 - localhost
// Mongodb connection with  express
// mongoose.connect("mongodb+srv://srijansarkarcoding_db_user:iOw7Ica625dg7nCn@shelf.5oudhup.mongodb.net/Shelf")
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("DB connected")
    })
    .catch((err) => {
        console.log("DB not connected")
    })

// For extracting body
app.use(express.json())

// Safe check
app.get("/", (req, res) => {
    res.send("SKM sir project automatic shelf management")
})

//----------------------------------------------Shelf Stuff----------------------------------------------
// URL: localhost:port/shelf/addProduct/P001
// For adding an item to its respective shelf with its Product ID
app.post("/shelf/addProduct/:id", async (req, res, next) => {

    const ans = await Products.findOneAndUpdate(
        {_id: req.params.id},
        {
            $inc: {quantity: 1}
        },
        {new: true}
    );

    //If ID exists then success
    if (ans != null) {
        const wholeShelf = await Products.find({})
        res.json(wholeShelf)
    } else {    //Else return error
        const err = new Error("Invalid Product ID")
        err.status = 400
        next(err)
    }
});

// URL: localhost:port/getShelfList
//Return the current shelf state
app.get("/getShelfList", async (req, res, next) => {
    const shelfList = await Products.find({})

    res.json(shelfList)
})

// URL: localhost:port/resetAllProductQty
//Make qty of all products to 0
    
app.get("/resetAllProductQty", async (req, res, next) => {
    await Products.updateMany({}, {$set: {quantity: 0}})

    const shelfList = await Products.find({})

    res.json(shelfList)
})

//----------------------------------------------Cart Stuff----------------------------------------------
//URL: localhost:port/CART001/insertOneItem/P001
// Putting items in cart
app.post("/:cartId/insertOneItem/:productId", async (req, res, next) => {
    let {cartId, productId} = req.params

    // Checking if product id is valid
    const product = await Products.findById(productId)

    if (product === null) {
        const error = new Error(`Item does not present.`)
        error.status = 400
        return next(error)
    }

    //Insert item in cart if Cart exists and product also exists
    let cart = await CartItems.findOneAndUpdate(
        {_id: cartId, "items.productId": productId},
        {
            $inc: {
                "items.$.quantity": 1,
                "items.$.totalCostOfItem": product.sellingPricePerItem,
                totalCartCost: product.sellingPricePerItem
            }
        },
        {new: true}
    );


    // If cart doesnt exist or cart does but product doesnt exist then:
    if (cart == null) {
        cart = await CartItems.findOneAndUpdate(
            {_id: cartId},
            {
                $push: {
                    items: {
                        productId: productId,   // P001
                        productName: product.productName,
                        quantity: 1,
                        costPerItem: product.costPricePerItem,
                        sellingPricePerItem: product.sellingPricePerItem,
                        totalCostOfItem: product.sellingPricePerItem
                    }
                },
                $inc: {totalCartCost: product.sellingPricePerItem}
            },
            {
                new: true,
                upsert: true
            }
        )
    }

    //returning the doc of the requested cartId
    res.json(cart)
})


//URL: localhost:port/CART001/deleteOneItem/P001
// Delete one item from one cart
app.delete("/:cartId/deleteOneItem/:productId", async (req, res, next) => {
    try {
        const {cartId, productId} = req.params;

        const product = await Products.findById(
            productId,
            {costPricePerItem: 1}
        );

        if (!product) {
            const error = new Error("Product ID not present");
            error.status = 400;
            return next(error);
        }

        // 1️⃣ Try decrement if quantity > 1
        const decCart = await CartItems.findOneAndUpdate(
            {
                _id: cartId,
                items: {
                    $elemMatch: {
                        productId: productId,
                        quantity: {$gt: 1}
                    }
                }
            },
            {
                $inc: {
                    "items.$.quantity": -1,
                    "items.$.totalCostOfItem": -product.sellingPricePerItem,
                    totalCartCost: -product.sellingPricePerItem
                }
            },
            {new: true}
        );

        if (decCart) {
            return res.json(decCart);
        }

        // 2️⃣ Else remove item completely
        const removedCart = await CartItems.findOneAndUpdate(
            {
                _id: cartId,
                "items.productId": productId
            },
            {
                $pull: {items: {productId: productId}},
                $inc: {totalCartCost: -product.sellingPricePerItem}
            },
            {new: true}
        );

        if (!removedCart) {
            const error = new Error("Invalid Cart ID or Product ID");
            error.status = 404;
            return next(error);
        }

        res.json(removedCart);
    } catch (err) {
        next(err);
    }
});

//URL: localhost:port/deleteAllItemsFromOneCart/CART001
// Delete all items from one cart
app.delete("/deleteAllItemsFromOneCart/:cartid", async (req, res, next) => {
    const ans = await CartItems.deleteOne({_id: req.params.cartid})


    res.send({status: "Deleted successfully"})

})

// URL: localhost:3000/checkout/CART001
//Clear cart, dec the qty of products from the shelf and put info in FPM collection
app.post("/checkout/:cartId", async (req, res, next) => {

    const {cartId} = req.params;

    // 1️⃣ Fetch cart
    const cart = await CartItems.findById(cartId);

    if (!cart || cart.items.length === 0) {
        return res.status(400).json({message: "Cart is empty or invalid"});
    }

    // 2️⃣ Extract productIds from cart
    const productLists = cart.items.map(item => ({
        _id: item.productId
    }));

    // 3️⃣ Insert into PatternMining
    const miningDoc = await PatternMining.create({
        productLists: productLists
    });

    if (miningDoc == null) {
        let error = new Error("Insertion in mining table is unsuccessful")
        error.status = 404
        next(error)
    }

    // 2️⃣ Prepare bulk operations for removin thr qty from products table
    const bulkOps = cart.items.map(item => ({
        updateOne: {
            filter: {
                _id: item.productId,
                quantity: {$gte: item.quantity} // prevent negative stock
            },
            update: {
                $inc: {quantity: -item.quantity}
            }
        }
    }));

    // 3️⃣ Apply stock updates
    const result = await Products.bulkWrite(bulkOps);


    // 5️⃣ Optional: delete cart after checkout
    await CartItems.deleteOne({_id: cartId});

    res.json({
        message: "Checkout successful"
    });
});

// URL: localhost:3000/OneCartItems/CART001
//Show products of one cart
app.get("/OneCartItems/:cartId", async (req, res, next) => {
    let cartId = req.params.cartId

    const result = await CartItems.findById({_id: cartId})

    //If corrent Cart id
    if (result != null) {
        return res.json(result)
    }
    //If wrong cart id, then show error
    else {
        let error = new Error("No items found")
        error.status = 404
        return next(error)
    }
})

// Error Handler
app.use((err, req, res, next) => {
    const statusCode = err.status || 500
    const message = err.message || "Something went wrong"

    return res.status(statusCode).json({message: message})
})

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on Port: ${PORT}`)
})
