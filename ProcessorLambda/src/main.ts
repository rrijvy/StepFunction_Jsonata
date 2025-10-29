import { Handler, Context } from "aws-lambda";

interface BusinessActionEvent {
  actionType: string;
  extractedData?: Record<string, unknown>;
  documentId?: string;
}

interface BusinessActionResponse {
  statusCode: number;
  body: string;
}

export const lambda_handler: Handler<BusinessActionEvent, BusinessActionResponse> = async (
  event: BusinessActionEvent,
  context: Context
): Promise<BusinessActionResponse> => {
  // Log environment variables
  console.log("=== Processor Lambda - Environment Variables ===");
  console.log("AWS_REGION:", process.env.AWS_REGION);
  console.log("ROLE_ARN:", process.env.ROLE_ARN);
  console.log("ENVIRONMENT:", process.env.ENVIRONMENT);
  console.log("PRIMARY_BUCKET:", process.env.PRIMARY_BUCKET);
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("PAYMENT_PROCESSOR_ENDPOINT:", process.env.PAYMENT_PROCESSOR_ENDPOINT);
  console.log("ORDER_MANAGEMENT_ENDPOINT:", process.env.ORDER_MANAGEMENT_ENDPOINT);
  console.log("=================================================\n");

  // Business Action Lambda Handler
  console.log("Event received:", JSON.stringify(event, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Business Action executed" }),
  };
};
