import { useState } from "react";
import { json } from "@remix-run/node";
import {
  useActionData,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import {
  Card,
  Layout,
  Page,
  Text,
  TextField,
  InlineError,
  BlockStack,
  PageActions,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { updateProducts, getProduct } from "../models/product.server";
import { createDraftOrder } from "../models/order.server";

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

export async function loader({ request, params }) {
  console.log("Loader function triggered");
  return json({ customerName: "", poNumber: "" });
}

export async function action({ request }) {
  console.log("Action function triggered");
  const { admin } = await authenticate.admin(request);
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

  try {
    const formData = await request.formData();
    console.log("Form data received:", formData);
    
    const customerName = formData.get("customerName");
    let poNumber = formData.get("poNumber");
    const pdfFile = formData.get("pdfFile");
    
    if (!pdfFile) {
      console.error("Validation error: Missing fields", { pdfFile });
      return json({ errors: { form: "All fields are required" } }, { status: 422 });
    }
    if (customerName == "X"){
      updateProducts(admin.graphql)
    }
    const pdfBuffer = await pdfFile.arrayBuffer();
    const pdfjsDoc = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
    console.log("pdfFile ", pdfFile.name);

    var split_po = pdfFile.name.split('.')[0].split(' ')
    console.log("split_po", split_po);
    if(split_po.length == 3)
      poNumber = split_po[2]

    let text = "";
    for (let i = 0; i < pdfjsDoc.numPages; i++) {
      const page = await pdfjsDoc.getPage(i + 1);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(" ");
      text += pageText + "\n";
    }
    const lines = text.split('  ');
    console.log("Text split into lines:", lines);

    let line_items = []
    let quantities = []
    let incorrect_item_code = []
    let check_item_code = false
    
    for (let line of lines) {
      line = line.trim();
      if (/^[A-Z]\.[A-Z]-[0-9A-Z]+$/.test(line)) {
        line_items.push(line);
        check_item_code = true;
        console.log(line);
      } else if (line.length <= 4 && !line.includes(".") && /\b\d{1,4}\b/.test(line)) {
        if (check_item_code) {
          quantities.push(line);
        } else {
          console.log(`Item Code not found for line after ${line_items[line_items.length - 1]}: `);
          line_items.push(null);
          quantities.push(line);
        }
        console.log(line);
        check_item_code = false;
      }
    }
        
    let products = [];
    let valid_quantities = []; // Create a new array for valid quantities
    let errors = [];
    
    for (let i = 0; i < line_items.length; i++) {
      let line = line_items[i].trim();
      
      try {
        console.log("Searching for product with query:", line);
        let product = await searchProduct(line);
        if (product) {
          products.push(product);
          valid_quantities.push(quantities[i]); // Only push valid quantities
        } else {
          errors.push(line);
        }
      } catch (error) {
        console.error("Error searching product for line:", line, error);
        errors.push(line);
      }
    }
    
    async function searchProduct(query) {
      return await getProduct(query, shopName, admin.graphql);
    }
    console.log("Errors encountered:", errors);

    // Creating Order
    let lineItems = []; 
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const quantity = parseInt(valid_quantities[i]); // Use valid quantities only
      lineItems.push({variantId: product.id, quantity});
    }
    const customer = {id: "gid:\/\/shopify\/Customer\/7421736485107"};
    console.log("Line Items: ", lineItems);
    const draftOrderResponse = await createDraftOrder(admin.graphql, customer, lineItems, poNumber);

    return json({ products, errors });

  } catch (error) {
    console.error("Error processing request:", error);
    return json({ errors: { form: "Error processing request" } }, { status: 500 });
  }
}

export default function OrderForm() {
  const errors = useActionData()?.errors || {};
  const [formState, setFormState] = useState({
    customerName: "",
    poNumber: "",
    pdfFile: null,
  });
  const [cleanFormState, setCleanFormState] = useState({
    customerName: "",
    poNumber: "",
    pdfFile: null,
  });

  const [feedback, setFeedback] = useState(null);  // State variable for feedback

  const nav = useNavigation();
  const isSaving = nav.state === "submitting";

  const submit = useSubmit();

  function handleSave() {
    const data = new FormData();
    data.append("customerName", formState.customerName);
    data.append("poNumber", formState.poNumber);
    data.append("pdfFile", formState.pdfFile);

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
                <Text as={"h2"} variant="headingLg">PO Number</Text>
                <TextField
                  id="poNumber"
                  label="PO Number"
                  value={formState.poNumber}
                  onChange={(poNumber) => setFormState({ ...formState, poNumber })}
                  error={errors.poNumber}
                />
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="500">
                <Text as={"h2"} variant="headingLg">PDF File</Text>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFormState({ ...formState, pdfFile: e.target.files[0] })}
                />
                {errors.pdfFile ? (
                  <InlineError message={errors.pdfFile} fieldID="pdfFile" />
                ) : null}
              </BlockStack>
            </Card>
            {feedback && (
              <Card>
                <BlockStack gap="500">
                  <Text as={"h2"} variant="headingLg">
                    {feedback.type === "success" ? "Success" : "Error"}
                  </Text>
                  <Text>
                    {feedback.message}
                  </Text>
                </BlockStack>
              </Card>
            )}
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
      </Layout>
    </Page>
  );
}

