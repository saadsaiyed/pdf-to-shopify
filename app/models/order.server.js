import { authenticate } from "../shopify.server";

export async function createDraftOrder(graphql, customer, lineItems, poNumber) {
  const today = new Date();
  const issuedAt = today.toISOString(); // Convert to ISO string format
  const dueAt = new Date(today.setDate(today.getDate() + 30)).toISOString(); // 30 days from today

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
          purchasingEntity: { customerId: customer.id },
          lineItems: lineItems,
          note: "PO: " + poNumber,
          shippingLine: {
            title: "Free Shipping",
            price: 0.00
          },
          // paymentTerms: {
          //   paymentSchedules: [{ issuedAt: issuedAt }],
          //   paymentTermsTemplateId: "gid://shopify/PaymentTermsTemplate/4"
          // }
        },
      },
    }
  );

  // Log request and response information
  console.log("Request sent to Shopify GraphQL:");
  console.log("Variables:", {
    purchasingEntity: { customerId: customer.id },
    lineItems: lineItems,
    note: "PO: " + poNumber,
    shippingLine: {
      title: "Free Shipping",
      price: 0.00
    },
    paymentTerms: {
      paymentSchedules: [{ issuedAt: issuedAt }],
      paymentTermsTemplateId: "gid://shopify/PaymentTermsTemplate/4"
    }
  });

  // Access and log the response headers, including x-request-id
  const xRequestId = response.headers.get('x-request-id');
  console.log('x-request-id:', xRequestId);  // Log the x-request-id header

  const data = await response.json();
  console.log("Data returned from Shopify API:", JSON.stringify(data, null, 2));

  // Optionally, you can include more information if needed
  if (xRequestId) {
    console.log('Captured x-request-id:', xRequestId); // This is the unique request ID for tracking
  }

  return data;
}
