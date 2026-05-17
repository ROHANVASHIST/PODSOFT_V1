# PodSoft — Deployment & Operations Guide

**Version:** 2.0  
**Status:** Production Ready  
**Last Updated:** May 2026  
**Audience:** DevOps, SRE, Platform Engineers  
**Document Owner:** Head of Infrastructure

---

## Executive Summary

This guide covers deploying PodSoft to production, operational runbooks, disaster recovery, and SRE best practices. It follows a cloud-native, containerized approach on AWS with infrastructure-as-code (IaC) using Terraform and ECS.

---

## 1. Pre-Deployment Checklist

### 1.1 Infrastructure Prerequisites

- [ ] AWS account created with billing enabled
- [ ] AWS IAM roles configured (admin, CI/CD, app service roles)
- [ ] VPC created with public/private subnets across 3 AZs
- [ ] Security groups configured (ALB, API, database, cache, workers)
- [ ] SSL/TLS certificates provisioned (ACM)
- [ ] Route 53 domain configured
- [ ] CloudTrail enabled for audit logging
- [ ] CloudWatch log groups created

### 1.2 Application Prerequisites

- [ ] All source code in Git repository (GitHub, GitLab, CodeCommit)
- [ ] CI/CD pipeline configured (GitHub Actions, GitLab CI, or AWS CodePipeline)
- [ ] Docker images built and pushed to ECR
- [ ] Database migrations validated in staging
- [ ] Secrets configured (API keys, JWT secrets, S3 credentials)
- [ ] Monitoring and logging configured (CloudWatch, Prometheus, DataDog)
- [ ] Load testing completed (k6, Locust)
- [ ] Security scan passed (no critical vulnerabilities)
- [ ] Code reviewed by 2+ team members

### 1.3 Team Prerequisites

- [ ] On-call rotation established (PagerDuty or similar)
- [ ] Runbooks written for common issues
- [ ] Team trained on deployment procedures
- [ ] Disaster recovery plan tested
- [ ] Communication channels set up (#podsoft-incidents Slack)

---

## 2. AWS Infrastructure Setup

### 2.1 Terraform Configuration Structure

```
infra/
├── main.tf                     # Terraform configuration
├── variables.tf                # Input variables
├── outputs.tf                  # Outputs (IP addresses, URLs)
├── vpc.tf                      # VPC, subnets, security groups
├── database.tf                 # RDS PostgreSQL
├── cache.tf                    # ElastiCache Redis
├── storage.tf                  # S3 buckets
├── ecs.tf                      # ECS clusters, services
├── alb.tf                      # Application Load Balancer
├── cloudwatch.tf               # Monitoring, alarms
├── iam.tf                      # IAM roles and policies
├── secrets.tf                  # Secrets Manager
├── cdn.tf                      # CloudFront distribution
├── terraform.tfvars            # Environment-specific values
├── backend.tf                  # Terraform state in S3
└── environments/
    ├── dev.tfvars
    ├── staging.tfvars
    └── prod.tfvars
```

### 2.2 Deploy VPC & Core Infrastructure

```bash
# 1. Initialize Terraform
cd infra/
terraform init

# 2. Validate configuration
terraform validate

# 3. Plan deployment (review changes)
terraform plan -var-file=environments/prod.tfvars -out=tfplan

# 4. Apply configuration
terraform apply tfplan

# 5. Output important values
terraform output

# Expected outputs:
# - vpc_id: vpc-0123456789abcdef0
# - database_endpoint: podsoft-db.c9akciq32.us-east-1.rds.amazonaws.com:5432
# - redis_endpoint: podsoft-redis.abcde1.ng.0001.use1.cache.amazonaws.com:6379
# - alb_dns: podsoft-alb-1234567890.us-east-1.elb.amazonaws.com
# - api_endpoint: https://api.podsoft.io
```

### 2.3 Database Setup

```bash
# 1. Wait for RDS to be available
aws rds wait db-instance-available --db-instance-identifier podsoft-db

# 2. Get database endpoint
DB_ENDPOINT=$(terraform output -raw database_endpoint)

# 3. Create database and user
psql -h $DB_ENDPOINT -U postgres -c "CREATE DATABASE podsoft"
psql -h $DB_ENDPOINT -U postgres -c "CREATE USER podsoft_app WITH PASSWORD 'SecurePassword'"
psql -h $DB_ENDPOINT -U postgres -d podsoft -c "GRANT ALL PRIVILEGES ON DATABASE podsoft TO podsoft_app"

# 4. Run migrations
export DATABASE_URL="postgresql://podsoft_app:SecurePassword@$DB_ENDPOINT:5432/podsoft"
npm run migrate:latest

# 5. Seed default data
npm run seed:templates
npm run seed:defaults

# 6. Verify schema
psql -h $DB_ENDPOINT -U podsoft_app -d podsoft -c "\dt"
# Should show: users, sessions, devices, chunks, processing_jobs, templates, outputs, etc.
```

### 2.4 Configure Secrets Manager

```bash
# 1. Create database secrets
aws secretsmanager create-secret \
  --name /podsoft/database \
  --secret-string '{
    "host": "'$DB_ENDPOINT'",
    "port": 5432,
    "username": "podsoft_app",
    "password": "SecurePassword",
    "database": "podsoft"
  }'

# 2. Create API secrets
aws secretsmanager create-secret \
  --name /podsoft/api \
  --secret-string '{
    "jwt_secret": "random-secret-key-32-chars-minimum",
    "jwt_expiry": "24h",
    "cors_origins": "https://studio.podsoft.io,https://app.podsoft.io"
  }'

# 3. Create S3 secrets
aws secretsmanager create-secret \
  --name /podsoft/s3 \
  --secret-string '{
    "access_key": "AKIA...",
    "secret_key": "...",
    "bucket_recordings": "podsoft-recordings",
    "bucket_archive": "podsoft-archive",
    "region": "us-east-1"
  }'

# 4. Create OpenAI secrets
aws secretsmanager create-secret \
  --name /podsoft/openai \
  --secret-string '{
    "api_key": "sk-...",
    "model": "whisper-1"
  }'

# 5. List all secrets
aws secretsmanager list-secrets --filters Key=name,Values=/podsoft/
```

---

## 3. Docker Image Building & Deployment

### 3.1 Build Images

```bash
# 1. Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

# 2. Build API image
docker build -t podsoft:api-v1.0.0 -f backend/Dockerfile.api .
docker tag podsoft:api-v1.0.0 \
  123456789.dkr.ecr.us-east-1.amazonaws.com/podsoft:api-v1.0.0
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/podsoft:api-v1.0.0

# 3. Build Worker image
docker build -t podsoft:worker-v1.0.0 -f backend/Dockerfile.worker .
docker tag podsoft:worker-v1.0.0 \
  123456789.dkr.ecr.us-east-1.amazonaws.com/podsoft:worker-v1.0.0
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/podsoft:worker-v1.0.0

# 4. Build Web image
docker build -t podsoft:web-v1.0.0 -f frontend/Dockerfile .
docker tag podsoft:web-v1.0.0 \
  123456789.dkr.ecr.us-east-1.amazonaws.com/podsoft:web-v1.0.0
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/podsoft:web-v1.0.0

# 5. Tag as latest
docker tag podsoft:api-v1.0.0 \
  123456789.dkr.ecr.us-east-1.amazonaws.com/podsoft:api-latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/podsoft:api-latest
```

### 3.2 ECS Task Definitions

**api-task-definition.json**
```json
{
  "family": "podsoft-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "4096",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/podsoft:api-latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "hostPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "LOG_LEVEL",
          "value": "info"
        },
        {
          "name": "API_PORT",
          "value": "3001"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:/podsoft/database:host::"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:/podsoft/api:jwt_secret::"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/podsoft-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "curl -f http://localhost:3001/health || exit 1"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### 3.3 Deploy to ECS

```bash
# 1. Register task definition
aws ecs register-task-definition \
  --cli-input-json file://api-task-definition.json

# 2. Create ECS service (if first deployment)
aws ecs create-service \
  --cluster podsoft-prod \
  --service-name podsoft-api \
  --task-definition podsoft-api:1 \
  --desired-count 4 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-0123,subnet-0456,subnet-0789],securityGroups=[sg-0123],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:123456789:targetgroup/podsoft-api/abc,containerName=api,containerPort=3001" \
  --enable-ecs-managed-tags

# 3. Update service with new task definition (subsequent deployments)
aws ecs update-service \
  --cluster podsoft-prod \
  --service podsoft-api \
  --task-definition podsoft-api:2 \
  --force-new-deployment

# 4. Monitor deployment
aws ecs wait services-stable \
  --cluster podsoft-prod \
  --services podsoft-api

# 5. Verify service health
aws ecs describe-services \
  --cluster podsoft-prod \
  --services podsoft-api \
  --query 'services[0].{Status: status, Running: runningCount, Desired: desiredCount}'
```

---

## 4. Automated CI/CD Pipeline

### 4.1 GitHub Actions Workflow (.github/workflows/deploy.yml)

```yaml
name: Deploy PodSoft

on:
  push:
    branches:
      - main
      - staging
  workflow_dispatch:

env:
  AWS_REGION: us-east-1
  ECR_REGISTRY: 123456789.dkr.ecr.us-east-1.amazonaws.com

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run test:coverage
      
      - uses: codecov/codecov-action@v3

  build:
    needs: test
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v3
      
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - uses: aws-actions/amazon-ecr-login@v1
        id: login-ecr
      
      - uses: docker/setup-buildx-action@v2
      
      - uses: docker/build-push-action@v4
        with:
          context: backend
          file: backend/Dockerfile.api
          push: true
          tags: |
            ${{ env.ECR_REGISTRY }}/podsoft:api-${{ github.sha }}
            ${{ env.ECR_REGISTRY }}/podsoft:api-latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Update ECS task definition
        run: |
          aws ecs register-task-definition \
            --cli-input-json file://api-task-definition.json \
            --region ${{ env.AWS_REGION }}
      
      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster podsoft-staging \
            --service podsoft-api \
            --task-definition podsoft-api:$(aws ecs describe-task-definition --task-definition podsoft-api --query 'taskDefinition.revision' --output text) \
            --force-new-deployment \
            --region ${{ env.AWS_REGION }}
      
      - name: Wait for service stability
        run: |
          aws ecs wait services-stable \
            --cluster podsoft-staging \
            --services podsoft-api \
            --region ${{ env.AWS_REGION }}
      
      - name: Run smoke tests
        run: npm run test:smoke -- --baseUrl=https://api-staging.podsoft.io

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v3
      
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
          role-to-assume: arn:aws:iam::123456789:role/github-actions-deploy
      
      - name: Create deployment
        run: |
          echo "🚀 Starting production deployment"
          aws ecs describe-services \
            --cluster podsoft-prod \
            --services podsoft-api \
            --query 'services[0].{Running: runningCount, Desired: desiredCount}'
      
      - name: Canary deploy (25%)
        run: |
          aws ecs update-service \
            --cluster podsoft-prod \
            --service podsoft-api-canary \
            --task-definition podsoft-api:new_version \
            --desired-count 2 \
            --force-new-deployment
      
      - name: Monitor canary (30 minutes)
        run: |
          echo "⏱️ Monitoring canary deployment for errors..."
          for i in {1..60}; do
            sleep 30
            ERROR_RATE=$(aws cloudwatch get-metric-statistics \
              --namespace AWS/ECS \
              --metric-name CPUUtilization \
              --dimensions Name=ServiceName,Value=podsoft-api-canary \
              --start-time $(date -u -d '5 min ago' +%Y-%m-%dT%H:%M:%S) \
              --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
              --period 300 \
              --statistics Average | jq '.Datapoints[0].Average // 0')
            echo "  Canary CPU: $ERROR_RATE%"
            if (( $(echo "$ERROR_RATE > 80" | bc -l) )); then
              echo "❌ Canary CPU high, rolling back"
              exit 1
            fi
          done
      
      - name: Production deployment (100%)
        run: |
          aws ecs update-service \
            --cluster podsoft-prod \
            --service podsoft-api \
            --task-definition podsoft-api:new_version \
            --desired-count 8 \
            --force-new-deployment
      
      - name: Wait for stability
        run: |
          aws ecs wait services-stable \
            --cluster podsoft-prod \
            --services podsoft-api
      
      - name: Smoke tests
        run: npm run test:smoke:production
      
      - name: Notify deployment success
        uses: 8398a7/action-slack@v3
        with:
          status: success
          text: '✅ Production deployment successful'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 5. Database Migrations

### 5.1 Migration Scripts

**migrations/001_init_schema.sql**
```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  plan VARCHAR(50) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'prep',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_status ON sessions(status);

-- ... more tables
```

### 5.2 Run Migrations

```bash
# Connect to database
export DATABASE_URL="postgresql://user:pass@host:5432/podsoft"

# Using db-migrate (Node.js)
npm install -g db-migrate db-migrate-pg
db-migrate up

# Using Flyway (Java-based, recommended for prod)
docker run --rm \
  -v "$(pwd)/sql:/flyway/sql" \
  -e FLYWAY_URL=jdbc:postgresql://host:5432/podsoft \
  -e FLYWAY_USER=user \
  -e FLYWAY_PASSWORD=pass \
  flyway/flyway:latest migrate

# Verify schema
psql $DATABASE_URL -c "\dt"
psql $DATABASE_URL -c "\di"  # indexes
```

---

## 6. Monitoring & Alerting

### 6.1 CloudWatch Dashboard

```bash
# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name podsoft-prod \
  --dashboard-body file://cloudwatch-dashboard.json
```

**cloudwatch-dashboard.json**
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          [ "AWS/ECS", "CPUUtilization", { "stat": "Average" } ],
          [ ".", "MemoryUtilization", { "stat": "Average" } ],
          [ "AWS/RDS", "CPUUtilization", { "stat": "Average" } ],
          [ "AWS/ElastiCache", "CPUUtilization", { "stat": "Average" } ]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "Infrastructure Health"
      }
    },
    {
      "type": "log",
      "properties": {
        "query": "fields @timestamp, @message | filter @message like /ERROR/ | stats count()",
        "region": "us-east-1",
        "title": "Error Rate (5m)"
      }
    }
  ]
}
```

### 6.2 CloudWatch Alarms

```bash
# High CPU on API servers
aws cloudwatch put-metric-alarm \
  --alarm-name podsoft-api-high-cpu \
  --alarm-description "Alert if API CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:123456789:podsoft-alerts

# Database connection pool exhausted
aws cloudwatch put-metric-alarm \
  --alarm-name podsoft-db-connections-high \
  --alarm-description "Alert if DB connections > 90" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Maximum \
  --period 60 \
  --threshold 90 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 3 \
  --alarm-actions arn:aws:sns:us-east-1:123456789:podsoft-alerts

# Queue backlog
aws cloudwatch put-metric-alarm \
  --alarm-name podsoft-queue-backlog-high \
  --alarm-description "Alert if job backlog > 1 hour" \
  --metric-name QueueBacklogSeconds \
  --namespace PodSoft \
  --statistic Maximum \
  --period 300 \
  --threshold 3600 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:123456789:podsoft-alerts
```

---

## 7. Operational Runbooks

### 7.1 High Error Rate (Critical)

**Symptoms**: 5xx error rate >5% for 5+ minutes

**Diagnosis**
```bash
# 1. Check error logs
aws logs tail /ecs/podsoft-api --follow --filter-pattern "ERROR"

# 2. Check recent deployments
aws ecs describe-services --cluster podsoft-prod --services podsoft-api

# 3. Check database connection pool
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# 4. Check Redis
redis-cli -h <redis-endpoint> info

# 5. Review CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --metric-name HTTPCode_Target_5XX_Count \
  --namespace AWS/ApplicationELB \
  --start-time $(date -u -d '30 min ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

**Remediation**

*Option 1: Rollback*
```bash
# Get previous task definition
TASK_DEF=$(aws ecs describe-services \
  --cluster podsoft-prod \
  --services podsoft-api \
  --query 'services[0].taskDefinition' \
  --output text)

# Extract revision number
OLD_REV=$(($TASK_DEF:##*:} - 1))

# Rollback
aws ecs update-service \
  --cluster podsoft-prod \
  --service podsoft-api \
  --task-definition podsoft-api:$OLD_REV \
  --force-new-deployment

# Verify
aws ecs wait services-stable --cluster podsoft-prod --services podsoft-api
```

*Option 2: Scale Down & Investigate*
```bash
# Reduce traffic to failing service
aws ecs update-service \
  --cluster podsoft-prod \
  --service podsoft-api \
  --desired-count 0

# Give time to stabilize other services
sleep 30

# Scale back up once investigation complete
aws ecs update-service \
  --cluster podsoft-prod \
  --service podsoft-api \
  --desired-count 8
```

---

### 7.2 Database Connection Pool Exhausted

**Symptoms**: Database connection errors, slow queries

**Diagnosis**
```bash
# Check connection count
psql $DATABASE_URL -c "SELECT \
  datname, \
  count(*) as total_connections, \
  max_conn \
FROM pg_stat_activity \
GROUP BY datname, max_conn \
ORDER BY total_connections DESC;"

# Check idle connections
psql $DATABASE_URL -c "SELECT \
  usename, \
  application_name, \
  state, \
  query, \
  query_start \
FROM pg_stat_activity \
WHERE state = 'idle' \
AND query_start < NOW() - INTERVAL '5 minutes';"

# Check slow queries
psql $DATABASE_URL -c "SELECT \
  query, \
  query_start, \
  (NOW() - query_start) as duration \
FROM pg_stat_activity \
WHERE state != 'idle' \
ORDER BY query_start;"
```

**Remediation**
```bash
# Option 1: Terminate idle connections
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) \
  FROM pg_stat_activity \
  WHERE state = 'idle' \
  AND query_start < NOW() - INTERVAL '10 minutes' \
  AND pid <> pg_backend_pid();"

# Option 2: Increase connection pool size
# Update RDS parameter group
aws rds modify-db-parameter-group \
  --db-parameter-group-name podsoft-param-group \
  --parameters "ParameterName=max_connections,ParameterValue=300,ApplyMethod=immediate"

# Restart database
aws rds reboot-db-instance --db-instance-identifier podsoft-db

# Wait for restart
aws rds wait db-instance-available --db-instance-identifier podsoft-db

# Option 3: Update API pool size
# Edit environment variable: DB_POOL_SIZE
# Redeploy API service
```

---

### 7.3 Storage Full

**Symptoms**: S3 upload failures, disk full errors

**Diagnosis**
```bash
# Check S3 bucket size
aws s3api list-bucket-metrics-configurations \
  --bucket podsoft-recordings

# Get bucket size
aws s3api head-bucket --bucket podsoft-recordings

# Check storage by prefix
aws s3 ls podsoft-recordings --summarize --human-readable --recursive

# Check lifecycle rules
aws s3api get-bucket-lifecycle-configuration \
  --bucket podsoft-recordings
```

**Remediation**
```bash
# Option 1: Scale S3 bucket (automatic)
# No action needed - S3 automatically scales

# Option 2: Move old data to Glacier
aws s3api put-bucket-lifecycle-configuration \
  --bucket podsoft-recordings \
  --lifecycle-configuration file://lifecycle-rules.json

# Option 3: Clean up old sessions
# Query and identify sessions >90 days old
aws dynamodb query \
  --table-name sessions \
  --index-name created_at \
  --key-condition-expression "created_at < :date" \
  --expression-attribute-values '{":date": {"N": "'$(date -d '90 days ago' +%s)'"}}'

# Archive old sessions to Glacier
for session in $(aws s3 ls podsoft-recordings/sessions --recursive | grep -o 'sessions/[^/]*' | sort -u); do
  aws s3 cp "s3://podsoft-recordings/$session" \
    "s3://podsoft-archive/$session" \
    --recursive
done
```

---

### 7.4 Processing Queue Backlog

**Symptoms**: Jobs taking >1 hour to complete, backlog >1000 jobs

**Diagnosis**
```bash
# Check queue length
redis-cli -h <redis-endpoint> LLEN bull:processing:queue

# Check job status distribution
redis-cli -h <redis-endpoint> HGETALL bull:processing:counts

# Check worker utilization
aws ecs describe-services \
  --cluster podsoft-prod \
  --services podsoft-worker \
  --query 'services[0].{RunningCount: runningCount, DesiredCount: desiredCount}'

# Check worker CPU/Memory
aws cloudwatch get-metric-statistics \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --dimensions Name=ServiceName,Value=podsoft-worker \
  --start-time $(date -u -d '30 min ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum
```

**Remediation**
```bash
# Option 1: Scale workers up
aws ecs update-service \
  --cluster podsoft-prod \
  --service podsoft-worker \
  --desired-count 50  # Increase from default 20

# Wait for new instances to start
sleep 120

# Monitor backlog reduction
watch -n 10 'redis-cli -h <redis-endpoint> LLEN bull:processing:queue'

# Option 2: Increase worker performance
# Update worker task definition with more CPU/memory
# Rebuild with optimizations (GPU support for rendering, etc.)

# Option 3: Identify stuck jobs
redis-cli -h <redis-endpoint> LRANGE bull:processing:queue 0 10
# Check logs for specific job failures
aws logs tail /ecs/podsoft-worker --follow --filter-pattern "error"
```

---

## 8. Backup & Disaster Recovery

### 8.1 Automated Backups

**Database**
```bash
# Enable automated backups
aws rds modify-db-instance \
  --db-instance-identifier podsoft-db \
  --backup-retention-period 30 \
  --preferred-backup-window "03:00-04:00"

# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier podsoft-db \
  --db-snapshot-identifier podsoft-db-backup-$(date +%Y%m%d)
```

**S3**
```bash
# Enable versioning
aws s3api put-bucket-versioning \
  --bucket podsoft-recordings \
  --versioning-configuration Status=Enabled

# Enable replication
aws s3api put-bucket-replication \
  --bucket podsoft-recordings \
  --replication-configuration file://replication-config.json
```

**Redis**
```bash
# Enable automatic snapshots
aws elasticache modify-replication-group \
  --replication-group-id podsoft-redis \
  --snapshot-retention-limit 7 \
  --snapshot-window "04:00-05:00"

# Create manual snapshot
aws elasticache create-snapshot \
  --replication-group-id podsoft-redis \
  --snapshot-name podsoft-redis-backup-$(date +%Y%m%d)
```

### 8.2 Disaster Recovery Plan

**RTO: <5 minutes | RPO: <1 hour**

```
Database Failure:
1. Promote read replica to standalone (1 min)
2. Update DNS to point to new primary (30 sec)
3. Run smoke tests (2 min)
4. Declare recovery complete (1 min)
Total RTO: ~5 min

S3 Failure:
1. Activate cross-region replication immediately (automatic)
2. Update S3 endpoint DNS (30 sec)
3. RPO: Automatic, typically <5 min
Total RTO: <5 min

Regional Failure:
1. Activate failover to secondary region (5 min)
2. Update Route 53 to secondary region endpoint (1 min)
3. Scale secondary region to match primary capacity (10 min)
Total RTO: ~15 min

Complete Outage:
1. Restore database from latest snapshot (30 min)
2. Restore S3 objects from cross-region backup (ongoing)
3. Restore Redis from snapshot (10 min)
4. Deploy application to fresh infrastructure (15 min)
5. Verify all systems healthy (10 min)
Total RTO: ~60 min
```

### 8.3 Test Disaster Recovery

```bash
# Monthly disaster recovery drill (every 1st of month, 2 AM)

# Step 1: Backup current state
aws rds create-db-snapshot \
  --db-instance-identifier podsoft-db \
  --db-snapshot-identifier podsoft-dr-drill-$(date +%Y%m%d)

# Step 2: Restore from snapshot in secondary region
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier podsoft-db-dr-test \
  --db-snapshot-identifier podsoft-db-backup-latest \
  --db-instance-class db.t3.large \
  --region us-west-2

# Step 3: Test connection and queries
aws rds wait db-instance-available \
  --db-instance-identifier podsoft-db-dr-test \
  --region us-west-2

psql -h <new-db-endpoint> -U podsoft_app -d podsoft -c "SELECT COUNT(*) FROM users;"

# Step 4: Cleanup
aws rds delete-db-instance \
  --db-instance-identifier podsoft-db-dr-test \
  --skip-final-snapshot
```

---

## 9. Performance Tuning

### 9.1 Database Optimization

```sql
-- Analyze table for query planner
ANALYZE sessions;
ANALYZE chunks;
ANALYZE processing_jobs;

-- Check slow query log
SELECT query, calls, mean_exec_time, max_exec_time 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Create missing indexes
CREATE INDEX CONCURRENTLY idx_sessions_user_created 
  ON sessions(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_chunks_status_upload
  ON chunks(upload_status, created_at);

-- Enable query parallelization
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET max_parallel_workers = 8;
SELECT pg_reload_conf();
```

### 9.2 Redis Optimization

```bash
# Monitor Redis performance
redis-cli --latency

# Check memory usage
redis-cli info memory

# Optimize eviction policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Monitor keyspace
redis-cli info keyspace

# Clean up expired keys
redis-cli SCAN 0 MATCH "session:*" COUNT 100
```

### 9.3 API Performance

```bash
# Load testing with k6
k6 run --vus 100 --duration 10m tests/load/api-load.js

# Analyze results
# - p95 latency: <500ms
# - p99 latency: <1s
# - Error rate: <0.1%
# - Throughput: >1000 req/s
```

---

## 10. Compliance & Security

### 10.1 Security Scanning

```bash
# Scan dependencies for vulnerabilities
npm audit

# SAST (Static Application Security Testing)
npm install --save-dev snyk
snyk test --severity-threshold=high

# Container image scanning
trivy image podsoft:api-latest

# Infrastructure scanning
aws accessanalyzer validate-policy --policy-document file://iam-policy.json
```

### 10.2 Backup Encryption

```bash
# Encrypt RDS backup
aws rds create-db-snapshot \
  --db-instance-identifier podsoft-db \
  --db-snapshot-identifier podsoft-encrypted \
  --kms-key-id arn:aws:kms:us-east-1:123456789:key/12345678

# Encrypt S3 objects
aws s3api put-bucket-encryption \
  --bucket podsoft-recordings \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

---

**Document Status**: ✅ APPROVED FOR IMPLEMENTATION  
**Last Review**: May 3, 2026  
**Next Review**: August 3, 2026

