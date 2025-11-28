#!/bin/bash

echo "================================================"
echo "  RAG System API Test Suite"
echo "================================================"
echo ""

BASE_URL="http://localhost:3000"

# Test 1: Health Check
echo "Test 1: Health Check"
curl -s "$BASE_URL/health" | json_pp
echo ""
echo "------------------------------------------------"
echo ""

# Test 2: Get Root
echo "Test 2: Root Endpoint"
curl -s "$BASE_URL/" | json_pp
echo ""
echo "------------------------------------------------"
echo ""

# Test 3: Get All Documents (should be empty initially)
echo "Test 3: Get All Documents"
curl -s "$BASE_URL/api/documents" | json_pp
echo ""
echo "------------------------------------------------"
echo ""

# Test 4: Get Stats
echo "Test 4: Get Statistics"
curl -s "$BASE_URL/api/documents/stats/summary" | json_pp
echo ""
echo "================================================"
echo "  Basic API tests completed!"
echo "================================================"
