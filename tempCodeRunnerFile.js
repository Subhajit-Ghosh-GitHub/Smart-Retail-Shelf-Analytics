// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use("Shelf");

// Find a document in a collection.
let cart = db.cartitems.findOne(
    {_id: "CART001"}
)

// Print the document to the console.
console.log(cart.items);