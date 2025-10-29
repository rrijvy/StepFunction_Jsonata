import { Handler, Context } from "aws-lambda";

interface DataExtractorEvent {
  documentId: string;
  classificationType?: string;
  extractionParams?: Record<string, unknown>;
}

interface DataExtractorResponse {
  statusCode: number;
  body: string;
}

export const lambda_handler: Handler<DataExtractorEvent, DataExtractorResponse> = async (
  event: DataExtractorEvent,
  context: Context
): Promise<DataExtractorResponse> => {
  // Log environment variables
  console.log("=== Data Extractor Lambda - Environment Variables ===");
  console.log("AWS_REGION:", process.env.AWS_REGION);
  console.log("ROLE_ARN:", process.env.ROLE_ARN);
  console.log("ENVIRONMENT:", process.env.ENVIRONMENT);
  console.log("PRIMARY_BUCKET:", process.env.PRIMARY_BUCKET);
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("TEXTRACT_ROLE_ARN:", process.env.TEXTRACT_ROLE_ARN);
  console.log("======================================================\n");

  // Data Extractor Lambda Handler
  console.log("Event received:", JSON.stringify(event, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Data Extractor executed" }),
  };
};
