import { Handler, Context } from "aws-lambda";

/**
 * Input event structure from Step Function
 * Arguments from stepFunction.asl.json:
 * - id: documentId from initial input
 * - s3Key: s3Key from initial input
 */
interface DocumentClassifierEvent {
  id: string;
  s3Key: string;
}

/**
 * Response structure expected by Step Function
 * Step Function expects:
 * - classificationResult.documentType
 * - classificationResult.confidence
 * - needManualReview
 */
interface DocumentClassifierResponse {
  classificationResult: {
    documentType: string;
    confidence: number;
  };
  needManualReview: boolean;
}

export const lambda_handler: Handler<DocumentClassifierEvent, DocumentClassifierResponse> = async (
  event: DocumentClassifierEvent,
  context: Context
): Promise<DocumentClassifierResponse> => {
  console.log("=== Document Classifier Lambda Started ===");
  console.log("Function Name:", context.functionName);
  console.log("Function Version:", context.functionVersion);
  console.log("Memory Limit:", context.memoryLimitInMB, "MB");

  console.log("\n=== Environment Variables ===");
  console.log("AWS_REGION:", process.env.AWS_REGION);
  console.log("ROLE_ARN:", process.env.ROLE_ARN);
  console.log("ENVIRONMENT:", process.env.ENVIRONMENT);
  console.log("PRIMARY_BUCKET:", process.env.PRIMARY_BUCKET);
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("CLASSIFICATION_MODEL_ENDPOINT:", process.env.CLASSIFICATION_MODEL_ENDPOINT);
  console.log("MIN_CONFIDENCE_THRESHOLD:", process.env.MIN_CONFIDENCE_THRESHOLD);

  console.log("\n=== Input Event ===");
  console.log("Document ID:", event.id);
  console.log("S3 Key:", event.s3Key);
  console.log("Full Event:", JSON.stringify(event, null, 2));

  // Simulate document classification
  // In production, this would call Amazon SageMaker or other ML service
  const documentTypes = ["INVOICE", "RECEIPT", "PURCHASE_ORDER", "CONTRACT", "FORM"];
  const randomType = documentTypes[Math.floor(Math.random() * documentTypes.length)];
  const randomConfidence = 0.7 + Math.random() * 0.3; // Between 0.7 and 1.0
  const needsReview = randomConfidence < 0.85; // Review if confidence < 85%

  const response: DocumentClassifierResponse = {
    classificationResult: {
      documentType: randomType,
      confidence: parseFloat(randomConfidence.toFixed(4)),
    },
    needManualReview: needsReview,
  };

  console.log("\n=== Classification Result ===");
  console.log("Document Type:", response.classificationResult.documentType);
  console.log("Confidence:", response.classificationResult.confidence);
  console.log("Needs Manual Review:", response.needManualReview);
  console.log("Full Response:", JSON.stringify(response, null, 2));
  console.log("=== Document Classifier Lambda Completed ===\n");

  return response;
};
