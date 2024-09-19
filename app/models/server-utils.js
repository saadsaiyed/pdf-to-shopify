// app/models/server-utils.js
import { getProduct } from "./product.server";
import { createDraftOrder } from "./order.server";

// Ensure these functions are not used directly in client-side code
export async function fetchProduct(query, shopName, graphql) {
  return await getProduct(query, shopName, graphql);
}

export async function createDraftOrderForCustomer(graphql, customer, lineItems, poNumber) {
  return await createDraftOrder(graphql, customer, lineItems, poNumber);
}
