import { Handler, Context } from "aws-lambda";

/**
 * Input event structure from Step Function
 * Arguments from stepFunction.asl.json:
 * - extractedData: The extracted data from the previous state
 */
interface ProcessorEvent {
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

/**
 * Response structure expected by Step Function
 * Step Function expects:
 * - status: Processing status result
 */
interface ProcessorResponse {
  status: string;
  processingDetails?: {
    action: string;
    result: string;
    timestamp: string;
    recordsProcessed?: number;
  };
}

export const lambda_handler: Handler<ProcessorEvent, ProcessorResponse> = async (
  event: ProcessorEvent,
  context: Context
): Promise<ProcessorResponse> => {
  console.log("=== Processor Lambda Started ===");
  console.log("Function Name:", context.functionName);
  console.log("Function Version:", context.functionVersion);
  console.log("Memory Limit:", context.memoryLimitInMB, "MB");

  console.log("\n=== Environment Variables ===");
  console.log("AWS_REGION:", process.env.AWS_REGION);
  console.log("ROLE_ARN:", process.env.ROLE_ARN);
  console.log("ENVIRONMENT:", process.env.ENVIRONMENT);
  console.log("PRIMARY_BUCKET:", process.env.PRIMARY_BUCKET);
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("PAYMENT_PROCESSOR_ENDPOINT:", process.env.PAYMENT_PROCESSOR_ENDPOINT);
  console.log("ORDER_MANAGEMENT_ENDPOINT:", process.env.ORDER_MANAGEMENT_ENDPOINT);

  console.log("\n=== Input Event ===");
  console.log("Document Type:", event.extractedData.documentType);
  console.log("Extraction Confidence:", event.extractedData.metadata.confidence);
  console.log("Fields Count:", Object.keys(event.extractedData.fields).length);
  console.log("Full Event:", JSON.stringify(event, null, 2));

  // Simulate business action processing based on document type
  // In production, this would integrate with payment systems, ERP, etc.
  let action = "";
  let result = "";
  let recordsProcessed = 0;

  switch (event.extractedData.documentType) {
    case "INVOICE":
      action = "PAYMENT_PROCESSING";
      result = "Invoice scheduled for payment";
      recordsProcessed = 1;
      console.log("\n>>> Processing INVOICE");
      console.log("Invoice Number:", event.extractedData.fields.invoiceNumber);
      console.log("Total Amount:", event.extractedData.fields.totalAmount);
      console.log("Payment scheduled via:", process.env.PAYMENT_PROCESSOR_ENDPOINT);
      break;

    case "RECEIPT":
      action = "EXPENSE_RECORDING";
      result = "Receipt recorded in expense management system";
      recordsProcessed = 1;
      console.log("\n>>> Processing RECEIPT");
      console.log("Receipt Number:", event.extractedData.fields.receiptNumber);
      console.log("Merchant:", event.extractedData.fields.merchantName);
      console.log("Amount:", event.extractedData.fields.totalAmount);
      break;

    case "PURCHASE_ORDER":
      action = "ORDER_FULFILLMENT";
      result = "Purchase order sent to fulfillment system";
      recordsProcessed = 1;
      console.log("\n>>> Processing PURCHASE_ORDER");
      console.log("PO Number:", event.extractedData.fields.poNumber);
      console.log("Supplier:", event.extractedData.fields.supplier);
      console.log("Order sent to:", process.env.ORDER_MANAGEMENT_ENDPOINT);
      break;

    case "CONTRACT":
      action = "CONTRACT_MANAGEMENT";
      result = "Contract archived and parties notified";
      recordsProcessed = 1;
      console.log("\n>>> Processing CONTRACT");
      console.log("Contract Number:", event.extractedData.fields.contractNumber);
      console.log("Parties:", event.extractedData.fields.parties);
      console.log("Contract Value:", event.extractedData.fields.contractValue);
      break;

    default:
      action = "GENERIC_PROCESSING";
      result = "Document archived for manual review";
      recordsProcessed = 1;
      console.log("\n>>> Processing UNKNOWN document type");
  }

  const response: ProcessorResponse = {
    status: "COMPLETED",
    processingDetails: {
      action,
      result,
      timestamp: new Date().toISOString(),
      recordsProcessed,
    },
  };

  console.log("\n=== Processing Result ===");
  console.log("Status:", response.status);
  console.log("Action Taken:", response.processingDetails?.action);
  console.log("Result:", response.processingDetails?.result);
  console.log("Records Processed:", response.processingDetails?.recordsProcessed);
  console.log("Full Response:", JSON.stringify(response, null, 2));
  console.log("=== Processor Lambda Completed ===\n");

  return response;
};
