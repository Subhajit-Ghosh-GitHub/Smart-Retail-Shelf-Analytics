import mongoose from "mongoose"

const CartSchema = new mongoose.Schema({
  _id: String, // CART001

  items: [
    {
      productId: String,   // P001
      productName: String,
      quantity: Number,
      costPerItem: Number,
      sellingPricePerItem: Number,
      totalCostOfItem: Number
    }
  ],
  totalCartCost: Number
});

export default mongoose.model("CartItems",CartSchema)