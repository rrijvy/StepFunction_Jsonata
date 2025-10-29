# Building Intelligent Document Processing Workflows with AWS Step Functions and JSONata

## Introduction

Most serverless tutorials show you how to build individual Lambda functions. But the real power of AWS serverless architecture comes from **orchestration**—and that's where AWS Step Functions shines. In this deep dive, I'll walk you through a production-ready document processing workflow that demonstrates how Step Functions, combined with JSONata, can create sophisticated data transformations and conditional logic without writing additional code.

## Why Step Functions + JSONata?

Traditional approaches to document processing often result in "Lambda sprawl"—dozens of small functions doing simple data transformations. This architecture takes a different approach:

Instead of this:

```
Lambda → Transform Lambda → Route Lambda → Process Lambda
```

We have this:

```
Lambda → Step Functions (with JSONata) → Lambda → Step Functions (with JSONata) → Lambda
```

The key difference? **Data transformations happen in the state machine itself**, making the workflow logic visible, version-controlled, and easier to reason about.

## The Complete Workflow: A Step-by-Step Journey

Let's trace a document through the entire workflow, watching how data evolves at each state. I'll show you the actual state machine definition and explain what happens to the data payload at each step.

## The Complete Workflow: A Step-by-Step Journey

Let's trace a document through the entire workflow, watching how data evolves at each state. I'll show you the actual state machine definition and explain what happens to the data payload at each step.

### Initial Input Structure

When a document enters the workflow, it arrives with this structure:

```json
{
  "document": {
    "id": "doc-12345",
    "key": "s3://bucket/invoices/2025/invoice-001.pdf",
    "uploadedAt": "2025-10-30T10:00:00Z"
  }
}
```

Now let's watch this data transform through each state.

---

### State 1: ClassifyDocument - ML-Powered Classification

```json
"ClassifyDocument": {
  "Type": "Task",
  "Resource": "${DocumentClassifierArn}",
  "ResultPath": "$.classificationResult",
  "Next": "CheckClassification",
  "Retry": [
    {
      "ErrorEquals": ["States.TaskFailed"],
      "IntervalSeconds": 2,
      "MaxAttempts": 3,
      "BackoffRate": 2
    }
  ],
  "Catch": [
    {
      "ErrorEquals": ["States.ALL"],
      "ResultPath": "$.error",
      "Next": "ClassificationFailed"
    }
  ],
  "Comment": "Invokes DocumentClassifier Lambda to classify the document"
}
```

**What Happens Here:**

The Lambda function receives the entire input and returns classification metadata. Notice the **`"ResultPath": "$.classificationResult"`**—this is crucial. Instead of replacing the entire state, it **merges** the Lambda output into the state at a new path.

**Data Flow:**

```
Input  → Lambda Classifier → Output stored at $.classificationResult
```

**Resulting State After Classification:**

```json
{
  "document": {
    "id": "doc-12345",
    "key": "s3://bucket/invoices/2025/invoice-001.pdf",
    "uploadedAt": "2025-10-30T10:00:00Z"
  },
  "classificationResult": {
    "documentType": "INVOICE",
    "confidence": 0.94,
    "metadata": {
      "model": "sagemaker-doc-classifier-v2",
      "processingTime": 234
    }
  }
}
```

**Resilience Features:**

- **Exponential Backoff Retry**: If SageMaker is temporarily unavailable, retry 3 times with increasing intervals (2s, 4s, 8s)
- **Error Preservation**: The `Catch` block stores the error at `$.error` without losing the original document data
- **Graceful Failure**: Routes to a dedicated failure state for monitoring and alerting

---

### State 2: CheckClassification - Intelligent Decision Point

```json
"CheckClassification": {
  "Type": "Choice",
  "Choices": [
    {
      "Variable": "$.classificationResult.documentType",
      "IsNull": true,
      "Next": "ClassificationFailed"
    },
    {
      "Variable": "$.classificationResult.confidence",
      "NumericLessThan": 0.7,
      "Next": "ManualReview"
    }
  ],
  "Default": "TransformForExtraction"
}
```

**What Happens Here:**

This is a **Choice** state—Step Functions' branching logic. It evaluates conditions in order and takes the first matching path. No Lambda invocation, no code execution—just declarative routing logic.

**Decision Tree:**

```
Is documentType null?
    → YES → ClassificationFailed
    → NO  → Check confidence

Is confidence < 0.7?
    → YES → ManualReview (human intervention)
    → NO  → TransformForExtraction (continue automation)
```

**Why This Matters:**

This implements a **quality gate**. Documents with low confidence (< 70%) are flagged for human review via SNS, preventing automated processing of ambiguous documents. This is critical for compliance and accuracy in production systems.

**Three Possible Paths:**

1. **Null Classification** → Workflow fails (invalid state)
2. **Low Confidence (< 0.7)** → Manual review triggered
3. **High Confidence (≥ 0.7)** → Automatic processing continues

For our example (confidence = 0.94), we proceed to **TransformForExtraction**.

---

### State 3: TransformForExtraction - JSONata Magic ✨

This is where things get interesting. Here's the complete state definition:

```json
"TransformForExtraction": {
  "Type": "Pass",
  "Parameters": {
    "document.$": "$.document",
    "documentType.$": "$.classificationResult.documentType",
    "confidence.$": "$.classificationResult.confidence",
    "QueryLanguage": "JSONata",
    "Query": "$merge([$.document, {'metadata': {'classified': true, 'type': $.classificationResult.documentType}}])"
  },
  "ResultPath": "$.extractionInput",
  "Next": "ExtractDocumentData"
}
```

**What Happens Here:**

This is a **Pass** state—no Lambda invocation! Instead, it uses JSONata to transform data **within the state machine itself**. Let's break down the transformation:

**Parameters Breakdown:**

1. **`"document.$": "$.document"`** - Copies the original document object
2. **`"documentType.$": "$.classificationResult.documentType"`** - Extracts just the type
3. **`"confidence.$": "$.classificationResult.confidence"`** - Extracts confidence score
4. **`"QueryLanguage": "JSONata"`** - Enables JSONata processing
5. **`"Query": "$merge([...])`** - The actual transformation logic

**The JSONata Query Explained:**

```jsonata
$merge([
  $.document,
  {
    'metadata': {
      'classified': true,
      'type': $.classificationResult.documentType
    }
  }
])
```

This merges two objects:

- The original `$.document`
- A new metadata object with classification info

**Data Flow Visualization:**

```
BEFORE (current state):
{
  "document": { "id": "doc-12345", ... },
  "classificationResult": { "documentType": "INVOICE", "confidence": 0.94 }
}

AFTER (at $.extractionInput):
{
  "document": {
    "id": "doc-12345",
    "key": "s3://bucket/invoices/2025/invoice-001.pdf",
    "uploadedAt": "2025-10-30T10:00:00Z",
    "metadata": {
      "classified": true,
      "type": "INVOICE"
    }
  },
  "documentType": "INVOICE",
  "confidence": 0.94,
  "QueryLanguage": "JSONata",
  "Query": "..."
}
```

**Complete State After Transformation:**

```json
{
  "document": { ... },
  "classificationResult": { ... },
  "extractionInput": {
    "document": {
      "id": "doc-12345",
      "key": "s3://bucket/invoices/2025/invoice-001.pdf",
      "uploadedAt": "2025-10-30T10:00:00Z",
      "metadata": {
        "classified": true,
        "type": "INVOICE"
      }
    },
    "documentType": "INVOICE",
    "confidence": 0.94
  }
}
```

**Why This Is Powerful:**

- ✅ **No Lambda cold start**
- ✅ **No additional code to maintain**
- ✅ **Transformation logic is visible in the state machine**
- ✅ **No Lambda invocation costs**
- ✅ **Instant execution (milliseconds vs. seconds)**

---

### State 4: ExtractDocumentData - OCR and Data Extraction

```json
"ExtractDocumentData": {
  "Type": "Task",
  "Resource": "${DataExtractorArn}",
  "InputPath": "$.extractionInput",
  "ResultPath": "$.extractionResult",
  "Next": "ProcessExtractedData",
  "Comment": "Invokes DataExtractor Lambda to extract data from the document"
}
```

**What Happens Here:**

Now we invoke the DataExtractor Lambda, but notice two important parameters:

1. **`"InputPath": "$.extractionInput"`** - Send ONLY the extractionInput to Lambda (not the entire state)
2. **`"ResultPath": "$.extractionResult"`** - Merge the Lambda response at a new path

**Data Flow:**

```
Current State (full) → InputPath filters → Lambda receives only extractionInput
                                        ↓
Lambda Output → ResultPath merges → State grows with new data
```

**Lambda Receives:**

```json
{
  "document": {
    "id": "doc-12345",
    "key": "s3://bucket/invoices/2025/invoice-001.pdf",
    "metadata": { "classified": true, "type": "INVOICE" }
  },
  "documentType": "INVOICE",
  "confidence": 0.94
}
```

**Lambda Returns (example):**

```json
{
  "extractedData": {
    "invoiceNumber": "INV-2025-001",
    "date": "2025-10-15",
    "vendor": "Acme Corp",
    "amount": 1250.0,
    "lineItems": [
      { "description": "Professional Services", "amount": 1000.0 },
      { "description": "Tax", "amount": 250.0 }
    ]
  },
  "extractionMethod": "textract",
  "processingTime": 3456
}
```

**Complete State After Extraction:**

```json
{
  "document": { ... },
  "classificationResult": { ... },
  "extractionInput": { ... },
  "extractionResult": {
    "extractedData": {
      "invoiceNumber": "INV-2025-001",
      "date": "2025-10-15",
      "vendor": "Acme Corp",
      "amount": 1250.00,
      "lineItems": [ ... ]
    },
    "extractionMethod": "textract",
    "processingTime": 3456
  }
}
```

**Key Insight:**

By using `ResultPath`, we've **preserved the entire processing history** in the state. We can trace back through every step: original document → classification → enrichment → extraction. This is invaluable for debugging and auditing.

---

### State 5: ProcessExtractedData - Conditional Business Logic with JSONata

Here's the final state—and it's a masterpiece of conditional logic:

```json
"ProcessExtractedData": {
  "Type": "Task",
  "Resource": "${BusinessActionArn}",
  "Parameters": {
    "actionType.$": "$.extractionInput.documentType = 'INVOICE' ? 'processPayment' : 'createOrder'",
    "extractedData.$": "$.extractionResult.extractedData",
    "documentId.$": "$.document.id",
    "QueryLanguage": "JSONata",
    "Query": "{'action': documentType = 'INVOICE' ? 'processPayment' : 'createOrder', 'payload': data}"
  },
  "End": true,
  "Comment": "Invokes Processor Lambda to perform business action based on document type"
}
```

**What Happens Here:**

This demonstrates **inline conditional logic** using JSONata expressions. Look at this line:

```json
"actionType.$": "$.extractionInput.documentType = 'INVOICE' ? 'processPayment' : 'createOrder'"
```

This is a **ternary operator in the state machine**! Without writing Lambda code, we've implemented business routing logic.

**Conditional Logic Breakdown:**

```
IF documentType == 'INVOICE'
  THEN actionType = 'processPayment'
  ELSE actionType = 'createOrder'
```

**Lambda Receives (for our INVOICE example):**

```json
{
  "actionType": "processPayment",
  "extractedData": {
    "invoiceNumber": "INV-2025-001",
    "date": "2025-10-15",
    "vendor": "Acme Corp",
    "amount": 1250.00,
    "lineItems": [ ... ]
  },
  "documentId": "doc-12345",
  "QueryLanguage": "JSONata",
  "Query": "{'action': documentType = 'INVOICE' ? 'processPayment' : 'createOrder', 'payload': data}"
}
```

**The Processor Lambda's Logic:**

```typescript
// In ProcessorLambda/src/main.ts
const endpoint = event.actionType === "processPayment" ? process.env.PAYMENT_ENDPOINT : process.env.ORDER_ENDPOINT;

// Route to appropriate business system
await axios.post(endpoint, event.extractedData);
```

**Multiple Routing Possibilities:**

| Document Type  | actionType     | Endpoint     | Business Action    |
| -------------- | -------------- | ------------ | ------------------ |
| INVOICE        | processPayment | Payment API  | Accounts Payable   |
| PURCHASE_ORDER | createOrder    | Order API    | Procurement System |
| CONTRACT       | createOrder    | Contract API | Legal Review       |

**Why This Matters:**

Without JSONata, you'd need either:

- A separate Lambda for routing logic
- Hardcoded logic in each processor
- Multiple state machine branches

Instead, the routing logic is **declarative and visible** in the state machine definition.

---

### Alternative Path: ManualReview - Human-in-the-Loop

For documents with confidence < 0.7, the workflow takes a different path:

```json
"ManualReview": {
  "Type": "Task",
  "Resource": "arn:aws:states:::sns:publish",
  "Parameters": {
    "TopicArn": "${ManualReviewTopicArn}",
    "Message.$": "$.document.key"
  },
  "End": true
}
```

**What Happens Here:**

This uses Step Functions' **native SNS integration** (notice `:::sns:publish`). No Lambda wrapper needed!

**Data Flow:**

```
Low Confidence Document → SNS Topic → Email/SMS to Review Team
                                    → SQS Queue for Review Dashboard
                                    → Lambda for ticket creation
```

**SNS Message Sent:**

```
Subject: Document Requires Manual Review
Message: s3://bucket/invoices/2025/invoice-001.pdf
Metadata: {
  "confidence": 0.65,
  "documentType": "UNKNOWN",
  "reason": "Below confidence threshold"
}
```

This creates a **safety net** for edge cases, ensuring quality over speed.

---

### Alternative Path: ClassificationFailed - Error Handling

```json
"ClassificationFailed": {
  "Type": "Fail",
  "Error": "ClassificationError",
  "Cause": "Unable to classify document"
}
```

**What Happens Here:**

The workflow terminates with a well-defined error. This triggers:

- CloudWatch Alarms
- SNS notifications to operations team
- Automatic incident creation (if configured)

**When This Occurs:**

- SageMaker endpoint is down after retries
- Document is corrupted
- Classification result is null
- Unexpected exception in classifier Lambda

---

## The Complete Data Flow Diagram

Here's how data evolves through a successful execution:

```
┌─────────────────────────────────────────────────────────────┐
│ INPUT                                                       │
│ { "document": { "id": "...", "key": "..." } }               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ ClassifyDocument (Lambda)                                   │
│ + classificationResult: { type, confidence }                │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ CheckClassification (Choice)                                │
│ Decision: confidence >= 0.7? → Continue                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ TransformForExtraction (Pass + JSONata)                     │
│ + extractionInput: { enriched document, type, confidence }  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ ExtractDocumentData (Lambda)                                │
│ + extractionResult: { extractedData, method, time }         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ ProcessExtractedData (Lambda + JSONata conditional)         │
│ Routes based on: documentType → payment or order            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ OUTPUT                                                      │
│ Complete state with full audit trail                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Why This Architecture Excels

### 1. **Visibility**

Every transformation is visible in the state machine definition. No need to dive into Lambda code to understand business logic.

### 2. **Auditability**

The state at any point contains the complete processing history. You can see:

- Original input
- Classification result
- Transformed data
- Extraction result
- Final processing outcome

### 3. **Cost Optimization**

JSONata transformations avoid Lambda invocations:

- **Traditional**: 5 Lambda calls per document
- **This architecture**: 3 Lambda calls + 2 Pass states
- **Savings**: ~40% reduction in Lambda costs

### 4. **Performance**

Pass states execute in milliseconds. No cold starts, no network hops.

### 5. **Maintainability**

Changing routing logic? Update the JSONata expression in the state machine. No code deployment required.

---

---

## Supporting Lambda Functions

While Step Functions handles orchestration and data transformation, three specialized TypeScript Lambda functions provide the computational heavy lifting:

### DocumentClassifier Lambda (2048 MB, 5 min timeout)

Integrates with Amazon SageMaker for ML-based document classification with confidence scoring.

### DataExtractor Lambda (3008 MB, 10 min timeout)

The heavyweight function configured for intensive Textract OCR operations on large documents.

### Processor Lambda (1024 MB, 5 min timeout)

Routes extracted data to business systems (payment APIs, order management, etc.) based on document type.

Each function is built with TypeScript for type safety and includes comprehensive logging for debugging.

---

## Infrastructure as Code with SAM

The entire infrastructure is defined using AWS SAM (Serverless Application Model), providing multi-environment support (dev/stage/live), esbuild integration for fast TypeScript compilation with tree-shaking and minification, and global configuration across all functions. The PowerShell installation script automates dependency management across all Lambda functions.

---

## Key Learnings

### JSONata Transforms Everything

The ability to perform complex data transformations directly in the state machine definition reduces code complexity, eliminates Lambda invocations, and makes business logic immediately visible.

### Step Functions State Management is Brilliant

Using `ResultPath`, `InputPath`, and `Parameters` strategically allows you to:

- Preserve the complete audit trail through the workflow
- Send only relevant data to each Lambda
- Build up state incrementally without overwriting
- Debug easily by inspecting state at any point

### Error Handling Matters

Exponential backoff retries, error preservation with `ResultPath: "$.error"`, and dedicated failure states create robust production workflows.

### Memory Configuration is Critical

The DataExtractor Lambda's 3GB allocation wasn't arbitrary—it was tuned based on Textract processing requirements for large documents.

---

## Real-World Applications

This architecture pattern works for:

- **Invoice Processing**: Classify → Extract line items → Process payment
- **Insurance Claims**: Route by claim type → Extract entities → Trigger approval
- **Contract Analysis**: Classify contract type → Extract terms → Route for review
- **HR Documents**: Process resumes, tax forms, employee onboarding
- **Healthcare Forms**: Medical records, insurance claims, prescriptions

---

## Conclusion

This document processing workflow showcases the power of **AWS Step Functions as an orchestration engine**. By combining Lambda for computation with JSONata for transformation, we've created a system where:

- **Data flow is transparent**: Every transformation is visible in the state machine
- **State is preserved**: Complete audit trail from input to output
- **Logic is declarative**: Business rules live in the workflow definition, not scattered across Lambda functions
- **Costs are optimized**: JSONata eliminates unnecessary compute invocations
- **Resilience is built-in**: Retry logic, error handling, and manual review paths

The Step Functions state machine isn't just orchestration—it's the **intelligent heart** of the system, making decisions, transforming data, and routing documents with minimal Lambda overhead.

## Getting Started

To deploy this solution:

```bash
# Install dependencies
.\install.ps1

# Build and deploy
sam build
sam deploy --guided
```

The guided deployment will prompt for environment-specific parameters, and you'll have a fully functional document processing pipeline in minutes.

---

**Repository Structure:**

```text
StepFunction_Jsonata/
├── template.yaml                   # SAM infrastructure definition
├── stepFunction.asl.json           # Step Functions state machine
├── install.ps1                     # Automated setup script
├── DocumentClassifierLambda/       # Classification function
├── DataExtractorLambda/            # Data extraction function
└── ProcessorLambda/                # Business action processor
```

---

**Built with AWS SAM, TypeScript, and JSONata**
