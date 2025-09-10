import { useState } from "react";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { useActionData, useNavigation, useSubmit } from "@remix-run/react";
import {
  Card,
  Layout,
  Page,
  Text,
  TextField,
  BlockStack,
  PageActions,
} from "@shopify/polaris";

// Import only server-side utilities and functions
import { fetchProduct, createDraftOrderForCustomer } from "../models/server-utils";

export async function action({ request }) {
  console.log("Action function triggered");
  
  try {
    // Authenticate and get the GraphQL client
    const { admin } = await authenticate.admin(request);
    
    // Fetch the shop name
    const shopResponse = await admin.graphql(
      `#graphql
        query {
          shop {
            name
          }
        }
      `
    );
    const shopData = await shopResponse.json();
    const shopName = shopData.data.shop.name;
    console.log(shopName);

    // Parse form data
    const formData = await request.formData();
    console.log("Form data received:", formData);
    
    const customerName = formData.get("customerName");
    const itemList = JSON.parse(formData.get("itemList"));
    
    if (!itemList) {
      console.error("Validation error: Missing fields", { customerName, itemList });
      return json({ errors: { form: "All fields are required" } }, { status: 422 });
    }
    
    // Process products
    let line_items = itemList.line_items;
    let quantities = itemList.quantity;

    let products = [];
    let errors = [];
    for (let line of line_items) {
      try {
        console.log("Searching for product with query:", line.trim());
        let product = await fetchProduct(line.trim(), shopName, admin.graphql);
        if (product) {
          products.push(product);
        } else {
          errors.push(line.trim());
        }
      } catch (error) {
        console.error("Error searching product for line:", line.trim(), error);
        errors.push(line.trim());
      }
    }

    // Creating Order
    let lineItems = []; 
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const quantity = parseInt(quantities[i]);
      lineItems.push({ variantId: product.id, quantity });
    }
    const customer = { id: "gid://shopify/Customer/7421736485107" }; // Adjust as necessary
    console.log("Line Items:", lineItems);
    const draftOrderResponse = await createDraftOrderForCustomer(admin.graphql, customer, lineItems, "");

    return json({ products, errors });

  } catch (error) {
    console.error("Error processing request:", error);
    return json({ errors: { form: "Error processing request" } }, { status: 500 });
  }
}

// Client-side component
export default function AdditionalPage() {
  const actionData = useActionData() || {};
  const errors = actionData.errors || {};
  
  const [formState, setFormState] = useState({
    customerName: "",
    itemList: "",
  });
  const [cleanFormState, setCleanFormState] = useState({
    customerName: "",
    itemList: "",
  });

  const [feedback, setFeedback] = useState(null);  // State variable for feedback

  const nav = useNavigation();
  const isSaving = nav.state === "submitting";

  const submit = useSubmit();

  function handleSave() {
    const data = new FormData();
    data.append("customerName", formState.customerName);
    data.append("itemList", formState.itemList);

    console.log("Form data to be submitted:", formState);

    setCleanFormState({ ...formState });
    submit(data, { method: "post", encType: "multipart/form-data" });
    setFeedback({ type: "success", message: "Draft order created successfully." });
  }

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="500">
                <Text as={"h2"} variant="headingLg">Customer Name</Text>
                <TextField
                  id="customerName"
                  label="Customer Name"
                  value={formState.customerName}
                  onChange={(customerName) => setFormState({ ...formState, customerName })}
                  error={errors.customerName}
                />
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="500">
                <Text as={"h2"} variant="headingLg">Item List</Text>
                <TextField
                  id="itemList"
                  label="Item List"
                  multiline={4}
                  value={formState.itemList}
                  onChange={(itemList) => setFormState({ ...formState, itemList })}
                  error={errors.itemList}
                />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
        <Layout.Section>
          <PageActions
            primaryAction={{
              content: "Save",
              loading: isSaving,
              onAction: handleSave,
            }}
          />
        </Layout.Section>
        {feedback && <div>{feedback.message}</div>}
      </Layout>
    </Page>
  );
}
