import { Handler, Context } from "aws-lambda";

/**
 * Input event structure from Step Function
 * Arguments from stepFunction.asl.json:
 * - config: Configuration from DynamoDB
 * - documentType: Document type from previous state
 * - s3Key: S3 key from previous state
 */
interface DataExtractorEvent {
  config: Record<string, string>;
  documentType: string;
  s3Key: string;
}

/**
 * Response structure expected by Step Function
 * Step Function expects:
 * - extractedData: The extracted data from the document
 */
interface DataExtractorResponse {
  extractedData: {
    documentType: string;
    fields: Record<string, unknown>;
    metadata: {
      extractionMethod: string;
      confidence: number;
      timestamp: string;
    };
  };
}

export const lambda_handler: Handler<DataExtractorEvent, DataExtractorResponse> = async (
  event: DataExtractorEvent,
  context: Context
): Promise<DataExtractorResponse> => {
  console.log("=== Data Extractor Lambda Started ===");
  console.log("Function Name:", context.functionName);
  console.log("Function Version:", context.functionVersion);
  console.log("Memory Limit:", context.memoryLimitInMB, "MB");

  console.log("\n=== Environment Variables ===");
  console.log("AWS_REGION:", process.env.AWS_REGION);
  console.log("ROLE_ARN:", process.env.ROLE_ARN);
  console.log("ENVIRONMENT:", process.env.ENVIRONMENT);
  console.log("PRIMARY_BUCKET:", process.env.PRIMARY_BUCKET);
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("TEXTRACT_ROLE_ARN:", process.env.TEXTRACT_ROLE_ARN);

  console.log("\n=== Input Event ===");
  console.log("Document Type:", event.documentType);
  console.log("S3 Key:", event.s3Key);
  console.log("Config:", JSON.stringify(event.config, null, 2));
  console.log("Full Event:", JSON.stringify(event, null, 2));

  // Simulate data extraction based on document type
  // In production, this would call Amazon Textract or other OCR service
  let extractedFields: Record<string, unknown> = {};

  switch (event.documentType) {
    case "INVOICE":
      extractedFields = {
        invoiceNumber: "INV-2025-001234",
        invoiceDate: "2025-10-30",
        dueDate: "2025-11-30",
        vendorName: "Acme Corp",
        totalAmount: 15000.5,
        currency: "USD",
        lineItems: [
          { description: "Product A", quantity: 10, unitPrice: 1000, amount: 10000 },
          { description: "Product B", quantity: 5, unitPrice: 1000.1, amount: 5000.5 },
        ],
      };
      break;
    case "RECEIPT":
      extractedFields = {
        receiptNumber: "RCP-2025-567890",
        date: "2025-10-30",
        merchantName: "Tech Store Inc",
        totalAmount: 2499.99,
        currency: "USD",
        paymentMethod: "Credit Card",
      };
      break;
    case "PURCHASE_ORDER":
      extractedFields = {
        poNumber: "PO-2025-789012",
        orderDate: "2025-10-30",
        deliveryDate: "2025-11-15",
        supplier: "Global Supplies Ltd",
        totalAmount: 50000.0,
        currency: "USD",
      };
      break;
    case "CONTRACT":
      extractedFields = {
        contractNumber: "CNT-2025-345678",
        effectiveDate: "2025-11-01",
        expirationDate: "2026-10-31",
        parties: ["Company A", "Company B"],
        contractValue: 1000000.0,
        currency: "USD",
      };
      break;
    default:
      extractedFields = {
        documentId: event.s3Key,
        extractionDate: new Date().toISOString(),
        status: "extracted",
      };
  }

  const response: DataExtractorResponse = {
    extractedData: {
      documentType: event.documentType,
      fields: extractedFields,
      metadata: {
        extractionMethod: "AWS Textract",
        confidence: 0.95,
        timestamp: new Date().toISOString(),
      },
    },
  };

  console.log("\n=== Extraction Result ===");
  console.log("Document Type:", response.extractedData.documentType);
  console.log("Extracted Fields Count:", Object.keys(response.extractedData.fields).length);
  console.log("Extraction Confidence:", response.extractedData.metadata.confidence);
  console.log("Full Response:", JSON.stringify(response, null, 2));
  console.log("=== Data Extractor Lambda Completed ===\n");

  return response;
};
