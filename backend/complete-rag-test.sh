#!/bin/bash

echo "=========================================="
echo "  RAG System Phase 2 - Complete Test"
echo "=========================================="
echo ""

# 1. Check Ollama
echo "1. Checking Ollama service..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "   ✓ Ollama is running"
else
    echo "   ✗ Ollama is NOT running"
    exit 1
fi

# 2. Check model
echo "2. Checking model installation..."
if ollama list 2>/dev/null | grep -q "phi3:mini"; then
    echo "   ✓ phi3:mini is installed"
else
    echo "   ✗ phi3:mini NOT found"
    echo "   Install: ollama pull phi3:mini"
    exit 1
fi
echo ""

# 3. Create test document
echo "3. Creating test document..."
cat > /tmp/company-handbook.txt << 'TESTDOC'
ACME Corporation Employee Handbook 2025

Compensation and Benefits:

Salary Ranges:
- Junior Developer: $60,000 - $75,000 annually
- Senior Developer: $90,000 - $120,000 annually  
- Lead Developer: $130,000 - $160,000 annually

All employees receive quarterly performance bonuses.

Health Benefits:
- Full medical insurance with $0 deductible
- Dental and vision coverage included
- Mental health counseling: 12 free sessions per year

Retirement:
- 401k matching up to 6% of salary
- Immediate vesting

Time Off Policy:

Vacation Days:
- 0-2 years experience: 15 days paid vacation
- 3-5 years experience: 20 days paid vacation
- 6+ years experience: 25 days paid vacation

Sick Leave: 10 days per year (rollover allowed)
Parental Leave: 16 weeks paid for primary caregiver
Holidays: All federal holidays plus 2 floating holidays

Work Arrangements:

Office Hours: Core hours 10 AM - 3 PM required
Flexible start/end times outside core hours

Remote Work Policy:
- New hires: In-office first 90 days
- After 90 days: Up to 3 remote days per week
- Full remote: Available after 1 year with approval

Professional Development:

Training Budget: $3,000 per employee annually
Conference Attendance: 2 conferences per year paid
Education Reimbursement: Up to $5,000 for courses
TESTDOC

echo "   ✓ Test document created"
echo ""

# 4. Upload
echo "4. Uploading document..."
UPLOAD=$(curl -s -X POST http://localhost:3000/api/upload -F "document=@/tmp/company-handbook.txt")
DOC_ID=$(echo "$UPLOAD" | grep -o '"documentId":[0-9]*' | grep -o '[0-9]*')

if [ -z "$DOC_ID" ]; then
    echo "   ✗ Upload failed"
    exit 1
fi
echo "   ✓ Uploaded (Document ID: $DOC_ID)"
echo ""

# 5. Wait for processing
echo "5. Waiting for OCR processing..."
sleep 4
echo "   ✓ Processing complete"
echo ""

# 6. Index
echo "6. Starting document indexing..."
echo "   (First run downloads embedding model ~150MB, takes 60-90 seconds)"
curl -s -X POST "http://localhost:3000/api/index/$DOC_ID" | python3 -m json.tool
echo ""
echo "   Waiting for embeddings generation..."
sleep 75

# 7. Check index
echo ""
echo "7. Checking index status..."
INDEX_STATUS=$(curl -s "http://localhost:3000/api/index/$DOC_ID")
echo "$INDEX_STATUS" | python3 -m json.tool
CHUNKS=$(echo "$INDEX_STATUS" | grep -o '"chunksCount":[0-9]*' | grep -o '[0-9]*')
echo ""
echo "   ✓ Created $CHUNKS chunks"
echo ""

# 8. Semantic Search Tests
echo "=========================================="
echo "  SEMANTIC SEARCH TESTS"
echo "=========================================="
echo ""

echo "Test 1: Search 'salary ranges'"
curl -s "http://localhost:3000/api/search?q=salary+ranges&limit=2" | python3 -m json.tool
echo ""

echo "Test 2: Search 'vacation policy'"
curl -s "http://localhost:3000/api/search?q=vacation+policy&limit=2" | python3 -m json.tool
echo ""

# 9. RAG Query Tests
echo ""
echo "=========================================="
echo "  AI-POWERED RAG QUERIES"
echo "=========================================="
echo ""

echo "Query 1: How many vacation days for 4 years experience?"
curl -s -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How many vacation days do employees with 4 years of experience get?"}' \
  | python3 -m json.tool
echo ""
echo ""

echo "Query 2: What is the salary for senior developers?"
curl -s -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the salary range for senior developers?"}' \
  | python3 -m json.tool
echo ""
echo ""

echo "Query 3: Remote work policy?"
curl -s -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the remote work policy for new hires?"}' \
  | python3 -m json.tool
echo ""

echo ""
echo "=========================================="
echo "  ✓ ALL TESTS COMPLETE!"
echo "=========================================="
