import mongoose from "mongoose"

const productSchema = mongoose.Schema({
    _id: String,
    productName: String,
    quantity: Number,
    costPricePerItem: Number,
    sellingPricePerItem: Number,
    profitPercentagePerItem: Number
}, { timestamps: true })

export default mongoose.model("Product", productSchema)