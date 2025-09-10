import db from "../db.server";
import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getProduct(sku, shopName, graphql) {
  const product = await prisma.product.findFirst({
    where: {
      sku: sku,
      shopName: shopName,
    },
  });

  if (!product) {
    return null;
  }
  console.log("product Found with sku", product.sku);

  const statusQuery = `
    #graphql
    query {
        productVariant(id: "${product.id}") {
            id
            title
            price
            sku
            inventoryQuantity  
            inventoryPolicy
            inventoryManagement
            weight
            weightUnit
            availableForSale
            barcode
        }
    }
    `;
  const response = await graphql(statusQuery);

  const data = await response.json()
  console.log("data SKU from graphql", data.data.productVariant.sku);
  return data.data.productVariant;
}

// Function to execute GraphQL mutations
async function executeMutation(graphql, mutation) {
  const response = await graphql(mutation);
  return response.json();
}

// Function to check the status of the bulk operation
async function checkBulkOperationStatus(graphql, bulkOperationId) {
  const statusQuery = `
      {
        node(id: "${bulkOperationId}") {
          ... on BulkOperation {
            id
            status
            errorCode
            createdAt
            completedAt
            objectCount
            fileSize
            url
            partialDataUrl
          }
        }
      }
    `;
  const response = await executeMutation(graphql, statusQuery);
  return response.data.node;
}

// Function to poll the status of the bulk operation until it is complete
async function pollBulkOperationStatus(graphql, bulkOperationId) {
  while (true) {
    const status = await checkBulkOperationStatus(graphql, bulkOperationId);
    if (status.status === 'COMPLETED') {
      console.log('Bulk operation completed.');
      console.log(`Download URL: ${status.url}`);
      return status.url;
    } else if (status.status === 'FAILED') {
      console.log('Bulk operation failed.');
      throw new Error('Bulk operation failed');
    } else {
      console.log('Bulk operation is still running...');
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait for 10 seconds before checking again
    }
  }
}

// Function to insert data into the Product table with shopName
async function insertDataWithShopName(shopName, productData) {
  await prisma.product.upsert({
    where: { id: productData.id },
    update: {
      title: productData.title,
      sku: productData.sku,
      createdAt: new Date(), // Or use productData.createdAt if it exists in your data
      shopName: shopName,
    },
    create: {
      id: productData.id,
      title: productData.title,
      sku: productData.sku,
      createdAt: new Date(), // Or use productData.createdAt if it exists in your data
      shopName: shopName,
    },
  });
}

// Function to fetch all products using bulk operations
export async function updateProducts(graphql) {
  const shopResponse = await graphql(
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

  const productMutation = `
    mutation {
      bulkOperationRunQuery(
        query: """
        {
          products {
            edges {
              node {
                id
                title
                variants(first: 10) {
                  edges {
                    node {
                      id
                      title
                      price
                      sku
                      inventoryQuantity
                      inventoryPolicy
                      inventoryManagement
                      weight
                      weightUnit
                      availableForSale
                      barcode
                    }
                  }
                }
              }
            }
          }
        }
        """
      ) {
        bulkOperation {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // Execute the mutation to initiate the bulk operation
  console.log(productMutation);
  const response = await executeMutation(graphql, productMutation);
  console.log(response);

  const bulkOperationId = response.data.bulkOperationRunQuery.bulkOperation.id;
  console.log(`bulk_operation_id: ${bulkOperationId}`);

  // Poll the status of the bulk operation until it is complete
  const downloadUrl = await pollBulkOperationStatus(graphql, bulkOperationId);

  // Download the results
  if (downloadUrl) {
    const response = await fetch(downloadUrl);
    const text = await response.text();
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        const productData = JSON.parse(line);
        if (productData.price) {
          // Insert data into Prisma Product table
          await insertDataWithShopName(shopName, productData);
        }
      }
    }
    console.log('Data inserted into Prisma successfully.');
    // import { promises as fs } from 'fs';
    // await fs.writeFile('bulk_data.jsonl', text);
    // console.log('Data downloaded successfully.');
  }
}
