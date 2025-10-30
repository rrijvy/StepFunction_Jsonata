# Document Processing Workflow - Lambda Functions Guide

This workspace contains three Lambda functions that work together with AWS Step Functions to process documents using JSONata for intelligent data transformation.

## 📁 Project Structure

```
StepFunction_Jsonata/
├── DocumentClassifierLambda/     # Classifies documents using ML
├── DataExtractorLambda/          # Extracts data using Textract
├── ProcessorLambda/              # Processes business actions
├── stepFunction.asl.json         # Step Functions state machine
├── template.yaml                 # SAM deployment template
└── install.ps1                   # Install dependencies script
```

## 🔄 Workflow Flow

```
Input: { documentId, s3Key }
    ↓
┌─────────────────────────────────────┐
│ 1. DocumentClassifier Lambda        │
│    Input: { id, s3Key }             │
│    Output: {                        │
│      classificationResult: {        │
│        documentType, confidence     │
│      },                             │
│      needManualReview               │
│    }                                │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 2. CheckClassification (Choice)     │
│    - confidence < 0.7? → Fail       │
│    - needManualReview? → SNS        │
│    - else → Continue                │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 3. GetConfig (DynamoDB)             │
│    Fetches configuration from       │
│    PrimaryTable based on docType    │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 4. DataExtractor Lambda             │
│    Input: {                         │
│      config, documentType, s3Key    │
│    }                                │
│    Output: {                        │
│      extractedData: {               │
│        documentType, fields,        │
│        metadata                     │
│      }                              │
│    }                                │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 5. Processor Lambda                 │
│    Input: { extractedData }         │
│    Output: {                        │
│      status: "COMPLETED",           │
│      processingDetails              │
│    }                                │
└─────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Install Dependencies

```powershell
# Run the installation script
.\install.ps1
```

Or install manually for each Lambda:

```powershell
cd DocumentClassifierLambda
npm install

cd ..\DataExtractorLambda
npm install

cd ..\ProcessorLambda
npm install
```

### 2. Configure Environment Variables

Each Lambda has a `.env` file with configuration. Update values as needed:

**DocumentClassifierLambda/.env**

```bash
AWS_REGION=us-east-1
ENVIRONMENT=dev
CLASSIFICATION_MODEL_ENDPOINT=arn:aws:sagemaker:...
MIN_CONFIDENCE_THRESHOLD=0.7
```

**DataExtractorLambda/.env**

```bash
AWS_REGION=us-east-1
ENVIRONMENT=dev
TEXTRACT_ROLE_ARN=arn:aws:iam::...
```

**ProcessorLambda/.env**

```bash
AWS_REGION=us-east-1
ENVIRONMENT=dev
PAYMENT_PROCESSOR_ENDPOINT=https://api.payments...
ORDER_MANAGEMENT_ENDPOINT=https://api.orders...
```

### 3. Build All Lambdas

```powershell
# Build each Lambda
cd DocumentClassifierLambda
npm run build

cd ..\DataExtractorLambda
npm run build

cd ..\ProcessorLambda
npm run build
```

### 4. Deploy with SAM

```powershell
# Build SAM application
sam build

# Deploy (first time - guided)
sam deploy --guided

# Subsequent deploys
sam deploy
```

## 📝 Lambda Functions Details

### 1️⃣ DocumentClassifierLambda

**Purpose:** Classifies documents using Amazon SageMaker

**Input:**

```typescript
{
  id: string; // Document ID
  s3Key: string; // S3 object key
}
```

**Output:**

```typescript
{
  classificationResult: {
    documentType: string; // INVOICE, RECEIPT, PURCHASE_ORDER, etc.
    confidence: number; // 0.0 to 1.0
  }
  needManualReview: boolean; // true if confidence < 0.85
}
```

**Document Types:**

- `INVOICE` - Tax invoices, bills
- `RECEIPT` - Purchase receipts
- `PURCHASE_ORDER` - Purchase orders
- `CONTRACT` - Legal contracts
- `FORM` - Generic forms

### 2️⃣ DataExtractorLambda

**Purpose:** Extracts structured data from documents using Amazon Textract

**Input:**

```typescript
{
  config: Record<string, string>; // Config from DynamoDB
  documentType: string; // From classifier
  s3Key: string; // S3 object key
}
```

**Output:**

```typescript
{
  extractedData: {
    documentType: string;
    fields: Record<string, unknown>; // Type-specific fields
    metadata: {
      extractionMethod: string;
      confidence: number;
      timestamp: string;
    }
  }
}
```

**Extracted Fields by Type:**

**INVOICE:**

```typescript
{
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  vendorName: string;
  totalAmount: number;
  currency: string;
  lineItems: Array<{...}>
}
```

**RECEIPT:**

```typescript
{
  receiptNumber: string;
  date: string;
  merchantName: string;
  totalAmount: number;
  currency: string;
  paymentMethod: string;
}
```

### 3️⃣ ProcessorLambda

**Purpose:** Executes business actions based on document type

**Input:**

```typescript
{
  extractedData: {
    documentType: string;
    fields: Record<string, unknown>;
    metadata: {...};
  };
}
```

**Output:**

```typescript
{
  status: string; // "COMPLETED"
  processingDetails: {
    action: string; // Action taken
    result: string; // Result description
    timestamp: string;
    recordsProcessed: number;
  }
}
```

**Actions by Document Type:**

- **INVOICE** → Payment processing
- **RECEIPT** → Expense recording
- **PURCHASE_ORDER** → Order fulfillment
- **CONTRACT** → Contract management
- **Other** → Archive for manual review

## 🔧 Development

### Running Locally

Each Lambda can be tested independently:

```powershell
# Build
cd DocumentClassifierLambda
npm run build

# Test with SAM Local
sam local invoke DocumentClassifierFunction --event test-event.json
```

### Test Event Examples

**DocumentClassifier test event:**

```json
{
  "id": "doc-123",
  "s3Key": "documents/invoice-2025-001.pdf"
}
```

**DataExtractor test event:**

```json
{
  "config": {
    "extractionLevel": "detailed"
  },
  "documentType": "INVOICE",
  "s3Key": "documents/invoice-2025-001.pdf"
}
```

**Processor test event:**

```json
{
  "extractedData": {
    "documentType": "INVOICE",
    "fields": {
      "invoiceNumber": "INV-2025-001234",
      "totalAmount": 15000.5
    },
    "metadata": {
      "extractionMethod": "AWS Textract",
      "confidence": 0.95,
      "timestamp": "2025-10-30T10:00:00Z"
    }
  }
}
```

## 📊 Monitoring

All Lambdas use structured JSON logging:

```typescript
console.log("=== Lambda Started ===");
console.log("Request ID:", context.requestId);
console.log("Input Event:", JSON.stringify(event, null, 2));
// ... processing ...
console.log("Output:", JSON.stringify(response, null, 2));
console.log("=== Lambda Completed ===");
```

View logs in CloudWatch:

```powershell
sam logs -n DocumentClassifierFunction --tail
```

## 🔐 IAM Permissions Required

The `StateMachineRole` needs:

- `lambda:InvokeFunction` - Invoke Lambda functions
- `dynamodb:GetItem` - Read from PrimaryTable
- `sns:Publish` - Send manual review notifications
- `logs:*` - CloudWatch logging

The `ServiceRole` (Lambda execution) needs:

- `s3:GetObject` - Read documents from S3
- `sagemaker:InvokeEndpoint` - Call ML models
- `textract:*` - Use Textract services
- `logs:*` - CloudWatch logging

## 📦 Deployment Parameters

Update these in `template.yaml` or via `sam deploy --guided`:

- `Environment`: dev | stage | live
- `ServiceRole`: Lambda execution role ARN
- `StateMachineRole`: Step Functions execution role ARN
- `PrimaryBucket`: S3 bucket for documents
- `PrimaryTableName`: DynamoDB config table name

## 🐛 Troubleshooting

**Build fails:**

```powershell
# Clean and rebuild
cd DocumentClassifierLambda
npm run clean
npm install
npm run build
```

**Lambda errors in Step Functions:**

- Check CloudWatch Logs for the specific Lambda
- Verify IAM permissions
- Check input/output structure matches expected types

**DynamoDB errors:**

- Ensure PrimaryTable exists
- Verify StateMachineRole has dynamodb:GetItem permission
- Check table name in template.yaml matches actual table

## 📚 Additional Resources

- [AWS Step Functions JSONata Guide](https://docs.aws.amazon.com/step-functions/latest/dg/transforming-data.html)
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [AWS Lambda TypeScript](https://docs.aws.amazon.com/lambda/latest/dg/lambda-typescript.html)

## 🎯 Next Steps

1. ✅ Install dependencies: `.\install.ps1`
2. ✅ Build all Lambdas: `npm run build` in each folder
3. ✅ Deploy infrastructure: `sam build && sam deploy --guided`
4. 📝 Test the workflow with a sample document
5. 🔍 Monitor execution in Step Functions console
6. 📊 Review CloudWatch logs for optimization

---

**Questions?** Check the Step Functions execution history in AWS Console for detailed state transitions and data transformations.
