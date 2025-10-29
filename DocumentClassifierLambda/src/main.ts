import { Handler, Context } from "aws-lambda";

interface DocumentClassifierEvent {
  documentId: string;
  documentUrl?: string;
  metadata?: Record<string, unknown>;
}

interface DocumentClassifierResponse {
  statusCode: number;
  body: string;
}

export const lambda_handler: Handler<DocumentClassifierEvent, DocumentClassifierResponse> = async (
  event: DocumentClassifierEvent,
  context: Context
): Promise<DocumentClassifierResponse> => {
  // Log environment variables
  console.log("=== Document Classifier Lambda - Environment Variables ===");
  console.log("AWS_REGION:", process.env.AWS_REGION);
  console.log("ROLE_ARN:", process.env.ROLE_ARN);
  console.log("ENVIRONMENT:", process.env.ENVIRONMENT);
  console.log("PRIMARY_BUCKET:", process.env.PRIMARY_BUCKET);
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("CLASSIFICATION_MODEL_ENDPOINT:", process.env.CLASSIFICATION_MODEL_ENDPOINT);
  console.log("MIN_CONFIDENCE_THRESHOLD:", process.env.MIN_CONFIDENCE_THRESHOLD);
  console.log("=========================================================\n");

  // Document Classifier Lambda Handler
  console.log("Event received:", JSON.stringify(event, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Document Classifier executed" }),
  };
};
