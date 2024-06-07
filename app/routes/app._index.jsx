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

  try {
    const formData = await request.formData();
    console.log("Form data received:", formData);
    
    const customerName = formData.get("customerName");
    const poNumber = formData.get("poNumber");
    const pdfFile = formData.get("pdfFile");

    if (!customerName || !poNumber || !pdfFile) {
      console.error("Validation error: Missing fields", { customerName, poNumber, pdfFile });
      return json({ errors: { form: "All fields are required" } }, { status: 422 });
    }
    if (customerName == "X"){
      updateProducts(admin.graphql)
    }
    const pdfBuffer = await pdfFile.arrayBuffer();
    const pdfjsDoc = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;

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
      if (/^[A-Z]\.[A-Z]-[0-9A-Z]+$/.test(line)) {
        line_items.push(line.trim());
        check_item_code = true;
        console.log(line.trim());
      } else if (line.length <= 3 && !line.includes(".") && /\b\d{1,3}\b/.test(line)) {
        if (check_item_code) {
          quantities.push(line.trim());
        } else {
          console.log(`Item Code not found for line after ${line_items[line_items.length - 1]}: `).trim();
          line_items.push(null);
          quantities.push(line.trim());
        }
        console.log(line.trim());
        check_item_code = false;
      }
    }
        
    let products = [];
    let errors = [];
    for (let line of line_items) {
      try {
        console.log("Searching for product with query:", line.trim());
        let product = await searchProduct(line.trim());
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

    async function searchProduct(query) {
      return await getProduct(query, admin.graphql);
    }

    console.log("Products found:", products);
    console.log("Errors encountered:", errors);

    // Creating Order
    let lineItems = []; 
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const quantity = quantities[i];
      lineItems.push({variantId: product.id, quantity})
    }
    const customer = {id: "gid:\/\/shopify\/Customer\/7329069039831"};
    console.log("Line Items: ", lineItems);
    const draftOrderResponse = await createDraftOrder(admin.graphql, customer, lineItems);

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
