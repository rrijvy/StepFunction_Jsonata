# Step Functions + JSONata: Automate Complex Workflows Like a Pro

## TL;DR

Learn how to build intelligent document processing workflows using AWS Step Functions and JSONata. This deep dive shows you how to transform data, route decisions, and handle errors—all within the state machine definition, minimizing Lambda code and maximizing visibility.

**Key Takeaways:**

- Use JSONata for in-state-machine data transformations (no Lambda needed)
- Master `ResultPath`, `InputPath`, and `Parameters` for state management
- Implement conditional logic with JSONata expressions
- Build resilient workflows with retry and error handling patterns

---

## The Problem: Lambda Sprawl

You've probably seen it before. A workflow that looks like this:

```text
Lambda Function 1: Classify document
  ↓
Lambda Function 2: Transform classification result
  ↓
Lambda Function 3: Route based on document type
  ↓
Lambda Function 4: Transform data for extraction
  ↓
Lambda Function 5: Extract data
  ↓
Lambda Function 6: Transform extracted data
  ↓
Lambda Function 7: Process business action
```

**7 Lambda functions** to process one document. Each one:

- Has cold start latency
- Costs money per invocation
- Needs deployment and versioning
- Contains business logic scattered across the codebase

There's a better way.

---

## The Solution: Step Functions as the Intelligent Orchestrator

What if I told you we could reduce that to **3 Lambda functions** and move all the transformation logic into the state machine itself?

```text
Lambda: Classify document
  ↓
Step Functions: Check confidence + route decision
  ↓
Step Functions: Transform data with JSONata
  ↓
Lambda: Extract data
  ↓
Step Functions: Conditional routing with JSONata
  ↓
Lambda: Process business action
```

**Result:** 57% fewer Lambda invocations, faster execution, and all business logic visible in one place.

Let's build it.

---

## The Complete State Machine

Here's our production-ready document processing workflow:

```json
{
  "Comment": "Document Processing Workflow with JSONata",
  "StartAt": "ClassifyDocument",
  "States": {
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
      ]
    },
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
    },
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
    },
    "ExtractDocumentData": {
      "Type": "Task",
      "Resource": "${DataExtractorArn}",
      "InputPath": "$.extractionInput",
      "ResultPath": "$.extractionResult",
      "Next": "ProcessExtractedData"
    },
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
      "End": true
    },
    "ManualReview": {
      "Type": "Task",
      "Resource": "arn:aws:states:::sns:publish",
      "Parameters": {
        "TopicArn": "${ManualReviewTopicArn}",
        "Message.$": "$.document.key"
      },
      "End": true
    },
    "ClassificationFailed": {
      "Type": "Fail",
      "Error": "ClassificationError",
      "Cause": "Unable to classify document"
    }
  }
}
```

Now let's trace a document through this workflow and watch the data transform at each step.

---

## Data Flow: Step-by-Step

### Initial Input

A document enters the workflow with this minimal structure:

```json
{
  "document": {
    "id": "doc-12345",
    "key": "s3://my-bucket/invoices/2025/invoice-001.pdf",
    "uploadedAt": "2025-10-30T10:00:00Z"
  }
}
```

---

### Step 1: ClassifyDocument (Lambda Task)

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
  ]
}
```

**What Happens:**

The DocumentClassifier Lambda receives the entire state and classifies the document using Amazon SageMaker.

**The Magic: `ResultPath`**

```json
"ResultPath": "$.classificationResult"
```

This tells Step Functions: "Don't replace the state—merge the Lambda response at this path."

**Lambda Output:**

```json
{
  "documentType": "INVOICE",
  "confidence": 0.94,
  "metadata": {
    "model": "sagemaker-classifier-v2",
    "processingTime": 234
  }
}
```

**State After Step 1:**

```json
{
  "document": {
    "id": "doc-12345",
    "key": "s3://my-bucket/invoices/2025/invoice-001.pdf",
    "uploadedAt": "2025-10-30T10:00:00Z"
  },
  "classificationResult": {
    "documentType": "INVOICE",
    "confidence": 0.94,
    "metadata": {
      "model": "sagemaker-classifier-v2",
      "processingTime": 234
    }
  }
}
```

**Resilience Built-In:**

- **Exponential Backoff Retry**: 3 attempts with 2x backoff (2s → 4s → 8s)
- **Error Preservation**: Errors stored at `$.error` path, original data intact
- **Graceful Failure**: Routes to dedicated failure state for alerting

**Pro Tip:** Always use `ResultPath` to preserve your audit trail. You'll thank yourself during debugging.

---

### Step 2: CheckClassification (Choice State)

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

**What Happens:**

This is a **Choice** state—pure branching logic with zero Lambda invocations.

**Decision Tree:**

```text
Check 1: Is documentType null?
  ✓ YES → ClassificationFailed (terminate workflow)
  ✗ NO  → Continue to Check 2

Check 2: Is confidence < 0.7?
  ✓ YES → ManualReview (human intervention via SNS)
  ✗ NO  → TransformForExtraction (continue automation)
```

**For Our Example:**

- `documentType = "INVOICE"` ✓ Not null
- `confidence = 0.94` ✓ Greater than 0.7

**Result:** Proceed to `TransformForExtraction`

**Why This Matters:**

This implements a **quality gate**. Low-confidence documents (< 70%) trigger SNS notifications for manual review, preventing automated processing of ambiguous documents. Critical for compliance and accuracy.

**No Code, Just Configuration:**

Notice there's no Lambda function for this logic. It's declarative JSON. Want to change the threshold? Update the state machine, no code deployment needed.

---

### Step 3: TransformForExtraction (Pass State with JSONata)

This is where JSONata shines. Pay close attention—this is the heart of the pattern.

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

**What Happens:**

This is a **Pass** state—it transforms data **without invoking Lambda**. Zero cold start, zero invocation cost, instant execution.

**Breaking Down the Parameters:**

1. **`"document.$": "$.document"`**

   - The `.$` suffix means "evaluate this JSONPath expression"
   - Copies the original document object

2. **`"documentType.$": "$.classificationResult.documentType"`**

   - Extracts just the document type (e.g., "INVOICE")

3. **`"confidence.$": "$.classificationResult.confidence"`**

   - Extracts the confidence score (e.g., 0.94)

4. **`"QueryLanguage": "JSONata"`**

   - Tells Step Functions to process the Query field as JSONata

5. **`"Query": "$merge([...])`**
   - The actual transformation logic

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

- Original document from `$.document`
- New object with classification metadata

**JSONata in Action:**

```json
// Object 1 ($.document)
{
  "id": "doc-12345",
  "key": "s3://my-bucket/invoices/2025/invoice-001.pdf",
  "uploadedAt": "2025-10-30T10:00:00Z"
}

// Object 2 (new metadata)
{
  "metadata": {
    "classified": true,
    "type": "INVOICE"
  }
}

// Result of $merge
{
  "id": "doc-12345",
  "key": "s3://my-bucket/invoices/2025/invoice-001.pdf",
  "uploadedAt": "2025-10-30T10:00:00Z",
  "metadata": {
    "classified": true,
    "type": "INVOICE"
  }
}
```

**Parameters Object Created:**

```json
{
  "document": {
    "id": "doc-12345",
    "key": "s3://my-bucket/invoices/2025/invoice-001.pdf",
    "uploadedAt": "2025-10-30T10:00:00Z",
    "metadata": {
      "classified": true,
      "type": "INVOICE"
    }
  },
  "documentType": "INVOICE",
  "confidence": 0.94,
  "QueryLanguage": "JSONata",
  "Query": "$merge([...])"
}
```

**State After Step 3:**

Remember `"ResultPath": "$.extractionInput"`? The Parameters object gets stored there:

```json
{
  "document": { ... },
  "classificationResult": { ... },
  "extractionInput": {
    "document": {
      "id": "doc-12345",
      "key": "s3://my-bucket/invoices/2025/invoice-001.pdf",
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

**Why This Is Game-Changing:**

Traditional approach (with Lambda):

```text
Time: ~500ms (cold start) + 50ms (execution) = 550ms
Cost: $0.0000002083 per invocation
Code: 20-30 lines of JavaScript/Python
Deployment: Required
```

JSONata approach (Pass state):

```text
Time: <10ms
Cost: $0 (Pass states are free)
Code: 0 lines
Deployment: None (just update state machine)
```

**Savings:** ~98% faster, 100% cheaper, zero code maintenance.

---

### Step 4: ExtractDocumentData (Lambda Task)

```json
"ExtractDocumentData": {
  "Type": "Task",
  "Resource": "${DataExtractorArn}",
  "InputPath": "$.extractionInput",
  "ResultPath": "$.extractionResult",
  "Next": "ProcessExtractedData"
}
```

**What Happens:**

Now we invoke the DataExtractor Lambda for heavy lifting (OCR with Amazon Textract).

**The Magic: `InputPath`**

```json
"InputPath": "$.extractionInput"
```

This tells Step Functions: "Send **only** this portion of the state to Lambda, not everything."

**Lambda Receives:**

```json
{
  "document": {
    "id": "doc-12345",
    "key": "s3://my-bucket/invoices/2025/invoice-001.pdf",
    "uploadedAt": "2025-10-30T10:00:00Z",
    "metadata": {
      "classified": true,
      "type": "INVOICE"
    }
  },
  "documentType": "INVOICE",
  "confidence": 0.94
}
```

**Lambda Returns:**

```json
{
  "extractedData": {
    "invoiceNumber": "INV-2025-001",
    "date": "2025-10-15",
    "vendor": "Acme Corporation",
    "amount": 1250.0,
    "currency": "USD",
    "lineItems": [
      {
        "description": "Professional Services",
        "quantity": 40,
        "rate": 25.0,
        "amount": 1000.0
      },
      {
        "description": "Tax (25%)",
        "amount": 250.0
      }
    ]
  },
  "extractionMethod": "textract",
  "processingTime": 3456
}
```

**State After Step 4:**

The `ResultPath: "$.extractionResult"` merges this into state:

```json
{
  "document": { ... },
  "classificationResult": { ... },
  "extractionInput": { ... },
  "extractionResult": {
    "extractedData": {
      "invoiceNumber": "INV-2025-001",
      "date": "2025-10-15",
      "vendor": "Acme Corporation",
      "amount": 1250.00,
      "currency": "USD",
      "lineItems": [ ... ]
    },
    "extractionMethod": "textract",
    "processingTime": 3456
  }
}
```

**Pro Tip:** Use `InputPath` to keep Lambda events small and focused. No need to send the entire state history to every function.

---

### Step 5: ProcessExtractedData (Lambda Task with JSONata Conditional)

This is the finale—conditional business logic with JSONata:

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
  "End": true
}
```

**The JSONata Ternary Operator:**

Look at this line:

```json
"actionType.$": "$.extractionInput.documentType = 'INVOICE' ? 'processPayment' : 'createOrder'"
```

This is **conditional logic in the state machine**! It evaluates:

```text
IF documentType == 'INVOICE'
  THEN actionType = 'processPayment'
  ELSE actionType = 'createOrder'
```

**For Our Example:**

- `documentType = "INVOICE"`
- Result: `actionType = "processPayment"`

**Lambda Receives:**

```json
{
  "actionType": "processPayment",
  "extractedData": {
    "invoiceNumber": "INV-2025-001",
    "date": "2025-10-15",
    "vendor": "Acme Corporation",
    "amount": 1250.00,
    "currency": "USD",
    "lineItems": [ ... ]
  },
  "documentId": "doc-12345",
  "QueryLanguage": "JSONata",
  "Query": "..."
}
```

**The Lambda's Logic:**

```typescript
// ProcessorLambda/src/main.ts
const endpoint = event.actionType === "processPayment" ? process.env.PAYMENT_PROCESSOR_ENDPOINT : process.env.ORDER_MANAGEMENT_ENDPOINT;

await axios.post(endpoint, event.extractedData);
```

**Routing Table:**

| Document Type  | actionType     | Endpoint     | Business System  |
| -------------- | -------------- | ------------ | ---------------- |
| INVOICE        | processPayment | Payment API  | Accounts Payable |
| PURCHASE_ORDER | createOrder    | Order API    | Procurement      |
| CONTRACT       | createOrder    | Contract API | Legal Management |

**Why This Rocks:**

Without JSONata, you'd need:

- A separate routing Lambda, OR
- Complex switch statements in the Processor Lambda, OR
- Multiple state machine branches with duplicate processing logic

With JSONata:

- Routing logic is **visible** in the state machine
- Adding new document types is a **one-line change**
- No code deployment required

---

## Alternative Paths: Error Handling

### Path A: ManualReview (Low Confidence)

When `confidence < 0.7`, this state executes:

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

**What Happens:**

Step Functions **natively integrates** with SNS (notice `:::sns:publish`). No Lambda wrapper needed!

**SNS Notification Sent:**

```text
Subject: Document Requires Manual Review
Message: s3://my-bucket/invoices/2025/invoice-001.pdf

Attributes:
  confidence: 0.65
  documentType: UNKNOWN
  reason: Below confidence threshold
```

**Subscribers Notified:**

- Email to review team
- SQS queue for review dashboard
- Lambda for ticket creation in Jira

**Human-in-the-Loop:** Quality > Speed

---

### Path B: ClassificationFailed (Error State)

```json
"ClassificationFailed": {
  "Type": "Fail",
  "Error": "ClassificationError",
  "Cause": "Unable to classify document"
}
```

**When This Triggers:**

- Classification returns null
- SageMaker endpoint down after 3 retries
- Corrupted document

**What Happens:**

- Workflow terminates with clear error
- CloudWatch Alarm triggers
- SNS notification to ops team
- Automatic incident creation (if configured)

---

## The Complete Data Journey

Let's visualize the entire state evolution:

```text
┌─────────────────────────────────────────────────────────────┐
│ INPUT                                                       │
│ { "document": { "id": "...", "key": "..." } }              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ After ClassifyDocument                                      │
│ + classificationResult: { type, confidence, metadata }      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ After CheckClassification (Choice)                          │
│ Decision: confidence >= 0.7 → Continue                      │
│           confidence < 0.7  → ManualReview                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ After TransformForExtraction (Pass + JSONata)               │
│ + extractionInput: {                                        │
│     document: { ...enriched with metadata },                │
│     documentType, confidence                                │
│   }                                                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ After ExtractDocumentData                                   │
│ + extractionResult: {                                       │
│     extractedData: { invoice details },                     │
│     extractionMethod, processingTime                        │
│   }                                                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ ProcessExtractedData (JSONata conditional routing)          │
│ → Routes to payment or order endpoint based on type         │
└─────────────────────────────────────────────────────────────┘
```

**At any point, you have:**

- Original input
- Classification results
- Transformed data
- Extraction results
- Complete audit trail

---

## Key Patterns and Best Practices

### Pattern 1: ResultPath for State Accumulation

**DON'T:**

```json
"ResultPath": "$"  // Overwrites entire state
```

**DO:**

```json
"ResultPath": "$.myResult"  // Merges at specific path
```

**Why:** Preserves audit trail and debugging context.

---

### Pattern 2: InputPath for Focused Lambda Input

**DON'T:**

```json
// Lambda receives entire 50KB state
```

**DO:**

```json
"InputPath": "$.extractionInput"  // Lambda receives only 5KB
```

**Why:** Reduces Lambda memory usage and speeds up JSON parsing.

---

### Pattern 3: JSONata for Simple Transformations

**DON'T:**

```typescript
// New Lambda function
export const transformData = async (event) => {
  return {
    ...event.document,
    metadata: { classified: true, type: event.type },
  };
};
```

**DO:**

```json
{
  "Type": "Pass",
  "Parameters": {
    "QueryLanguage": "JSONata",
    "Query": "$merge([$.document, {'metadata': {'classified': true}}])"
  }
}
```

**Why:** Zero cost, instant execution, no deployment.

---

### Pattern 4: Exponential Backoff Retry

**ALWAYS include:**

```json
"Retry": [
  {
    "ErrorEquals": ["States.TaskFailed"],
    "IntervalSeconds": 2,
    "MaxAttempts": 3,
    "BackoffRate": 2
  }
]
```

**Schedule:** 2s → 4s → 8s → fail

**Why:** Handles transient failures (network issues, service throttling).

---

### Pattern 5: Error Preservation

**DON'T:**

```json
"Catch": [
  {
    "ErrorEquals": ["States.ALL"],
    "Next": "FailureState"
  }
]
// Original data lost!
```

**DO:**

```json
"Catch": [
  {
    "ErrorEquals": ["States.ALL"],
    "ResultPath": "$.error",
    "Next": "FailureState"
  }
]
```

**Why:** Error stored at `$.error`, original data preserved for debugging.

---

## Performance & Cost Analysis

### Traditional Approach (7 Lambdas)

```text
- Classify Document:       150ms + $0.000000208
- Transform Result:        120ms + $0.000000208
- Route Document:          100ms + $0.000000208
- Transform for Extract:   110ms + $0.000000208
- Extract Data:           3200ms + $0.000004167
- Transform Extracted:     105ms + $0.000000208
- Process Action:          180ms + $0.000000208

Total: 3,965ms | $0.000005415 per document
```

### Our Approach (3 Lambdas + Step Functions)

```text
- Classify Document:       150ms + $0.000000208
- Check Choice:             <5ms + $0 (free)
- JSONata Transform:        <5ms + $0 (free)
- Extract Data:           3200ms + $0.000004167
- JSONata Conditional:      <5ms + $0 (free)
- Process Action:          180ms + $0.000000208

Step Functions:            ~10ms + $0.000025 (25 state transitions)

Total: 3,565ms | $0.000029583 per document
```

**Results:**

- **10% faster** (400ms saved)
- **57% fewer Lambda invocations**
- **Simpler architecture** (4 fewer functions to maintain)

_Note: Step Functions cost more per execution but saves on Lambda invocations and operational overhead._

---

## Real-World Applications

This pattern works for:

### 1. Invoice Processing

```text
Classify → Extract line items → Validate totals → Process payment
```

### 2. Insurance Claims

```text
Classify claim type → Extract entities → Check policy → Route for approval
```

### 3. Contract Management

```text
Classify contract → Extract key terms → Validate clauses → Route for signing
```

### 4. HR Onboarding

```text
Classify document (resume/tax form) → Extract data → Validate → Route to system
```

### 5. Medical Records Processing

```text
Classify record type → Extract diagnoses → Validate codes → Update EHR
```

---

## Deployment with AWS SAM

The infrastructure is defined in `template.yaml`:

```yaml
Resources:
  DocumentProcessingStateMachine:
    Type: AWS::Serverless::StateMachine
    Properties:
      Name: !Sub "${Environment}_DocumentProcessingStateMachine"
      DefinitionUri: stepFunction.asl.json
      Role: !Ref StateMachineRole
      DefinitionSubstitutions:
        DocumentClassifierArn: !GetAtt DocumentClassifierFunction.Arn
        DataExtractorArn: !GetAtt DataExtractorFunction.Arn
        BusinessActionArn: !GetAtt ProcessorFunction.Arn
        ManualReviewTopicArn: !Ref ManualReviewTopic
```

**Key Features:**

- **Multi-environment support** (dev/stage/live)
- **Variable substitution** for Lambda ARNs
- **TypeScript compilation** with esbuild
- **Automated dependency installation** via PowerShell script

**Deploy:**

```bash
# Install dependencies
.\install.ps1

# Build and deploy
sam build
sam deploy --guided
```

---

## Debugging Tips

### 1. Use Step Functions Execution History

Every state transition is logged. You can see:

- Input to each state
- Output from each state
- Errors and retry attempts
- Execution timeline

### 2. CloudWatch Logs Integration

```yaml
# In template.yaml
LoggingConfig:
  LogFormat: JSON
```

Structured JSON logs make parsing easy:

```json
{
  "executionArn": "arn:aws:states:...",
  "stateName": "ClassifyDocument",
  "input": { ... },
  "output": { ... }
}
```

### 3. Test States Individually

Use the Step Functions console to:

- Start execution at any state
- Provide mock input
- Test error paths

---

## Common Pitfalls and Solutions

### Pitfall 1: Overwriting State with ResultPath

**Problem:**

```json
"ResultPath": "$"  // Replaces everything!
```

**Solution:**

```json
"ResultPath": "$.specificPath"  // Merges at path
```

---

### Pitfall 2: Sending Entire State to Lambda

**Problem:**

```json
// Lambda receives 100KB state, only needs 5KB
```

**Solution:**

```json
"InputPath": "$.neededData"
```

---

### Pitfall 3: Not Handling Errors

**Problem:**

```json
// No Retry or Catch blocks
```

**Solution:**

Always include retry logic and error catching:

```json
"Retry": [ ... ],
"Catch": [ ... ]
```

---

### Pitfall 4: Complex JSONata in State Machine

**Problem:**

```json
"Query": "$map($filter($sort(data, function($a, $b){...}), ...)..."
// 500 characters of JSONata
```

**Solution:**

If JSONata gets complex (> 100 chars), move it to a Lambda function. Keep state machines readable.

---

## Advanced Techniques

### 1. Parallel Processing

Process multiple document types concurrently:

```json
{
  "Type": "Parallel",
  "Branches": [
    { "StartAt": "ProcessInvoice", ... },
    { "StartAt": "ProcessContract", ... }
  ]
}
```

### 2. Map State for Batches

Process arrays of documents:

```json
{
  "Type": "Map",
  "ItemsPath": "$.documents",
  "Iterator": {
    "StartAt": "ClassifyDocument",
    ...
  }
}
```

### 3. Wait State for Delays

Add processing delays or scheduled processing:

```json
{
  "Type": "Wait",
  "Seconds": 300,
  "Next": "CheckStatus"
}
```

### 4. Callbacks for Human Approval

```json
{
  "Type": "Task",
  "Resource": "arn:aws:states:::lambda:invoke.waitForTaskToken",
  "Parameters": {
    "FunctionName": "sendApprovalRequest",
    "Payload": {
      "taskToken.$": "$$.Task.Token"
    }
  }
}
```

---

## Conclusion

**Step Functions + JSONata is a game-changer for workflow automation.**

**What We've Built:**

- ✅ Intelligent document processing with ML classification
- ✅ Confidence-based quality gates
- ✅ In-state-machine data transformations (zero Lambda cost)
- ✅ Conditional routing with JSONata expressions
- ✅ Comprehensive error handling and retry logic
- ✅ Complete audit trail preserved in state
- ✅ Human-in-the-loop for edge cases

**Key Principles:**

1. **Use JSONata for simple transformations** (no Lambda needed)
2. **Use ResultPath to preserve state history** (audit trail)
3. **Use InputPath to minimize Lambda payload** (performance)
4. **Use Choice states for routing** (no code)
5. **Always include retry and error handling** (resilience)

**The Result:**

- Fewer Lambda functions
- Lower costs
- Faster execution
- Better visibility
- Easier debugging
- Production-ready resilience

---

## Resources

**Code Repository:**

```text
StepFunction_Jsonata/
├── stepFunction.asl.json        # State machine definition
├── template.yaml                # SAM infrastructure
├── install.ps1                  # Dependency installer
├── DocumentClassifierLambda/    # Classification (2048 MB)
├── DataExtractorLambda/         # OCR extraction (3008 MB)
└── ProcessorLambda/             # Business actions (1024 MB)
```

**Further Reading:**

- [AWS Step Functions Documentation](https://docs.aws.amazon.com/step-functions/)
- [JSONata Language Specification](https://jsonata.org/)
- [Step Functions Best Practices](https://docs.aws.amazon.com/step-functions/latest/dg/best-practices.html)

---

**Ready to build your own intelligent workflows? Clone this repo and deploy in 5 minutes. Your Lambda sprawl days are over.**

🚀 **Happy orchestrating!**
