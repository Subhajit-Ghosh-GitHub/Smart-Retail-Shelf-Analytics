import mongoose from "mongoose"

const MiningSchema = new mongoose.Schema(
  {
    productLists: [
      {
        _id: String
      }
    ]
  },
  { timestamps: true }  // 👈 THIS is where it goes
);

export default mongoose.model("PatternMining", MiningSchema);