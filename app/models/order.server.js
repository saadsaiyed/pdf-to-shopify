import { authenticate } from "../shopify.server";

export async function createDraftOrder(graphql, customer, lineItems) {
  const response = await graphql(
    `#graphql
    mutation draftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        "input": {
          customerId: customer.id,
          lineItems: lineItems,
        }
      },
    },
  );

  console.log("customerId", customer.id);
  console.log("lineItems", lineItems);

  const data = await response.json();
  console.log("data", data);
  console.log('Full Response:', JSON.stringify(data, null, 2));
  return data

}
export async function createDraftOrder_original(graphql, customer, lineItems) {
  const draftOrderMutation = `#graphql
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
      }
    }
  }`;

  const variables = {
    input: {
      customerId: customer.id,
      lineItems: lineItems,
    },
  };
  
  console.log("variables", variables);
  console.log("line items", variables.input.lineItems);
  const response = await graphql(draftOrderMutation, variables);
  const data = response.json();
  
  // const { admin, session } = await authenticate.admin(request);

  // const order = new admin.rest.resources.Order({session: session});
  // order.id = data.draftOrderCreate.draftOrder.id;
  // order.note = "Customer contacted us about a custom engraving on this iPod";
  
  // await order.save({
  //   update: true,
  // });

  // return response.json();
  return data;
}