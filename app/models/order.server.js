
export async function createDraftOrder(graphql, customer, lineItems) {
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
  const response = await graphql(draftOrderMutation, variables);
  return response.json();
}

