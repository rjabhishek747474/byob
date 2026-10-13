# AWS Production Deployment Guide

## 1. Prerequisites Checklist

Before executing the automated deployment pipeline, verify the following prerequisites:

- [ ] **AWS Organization & Accounts**: Production AWS Account ID with an IAM deployment role or administrator credentials.
- [ ] **Domain & DNS**: Production root domain (e.g., `byoboss.io`) registered and hosted on Route 53 or external registrar with nameservers configured.
- [ ] **Terraform CLI**: Version `>= 1.5.0` installed locally or in CI runner.
- [ ] **AWS CLI**: Version 2 configured (`aws configure`).
- [ ] **Docker Engine**: Version `>= 24.0` with Buildx enabled for multi-stage arm64/amd64 builds.
- [ ] **GitHub Repository Secrets**:
  - `AWS_ACCESS_KEY_ID`: IAM user/role access key.
  - `AWS_SECRET_ACCESS_KEY`: IAM secret key.
  - `AWS_REGION`: Target region (e.g., `us-east-1`).
  - `PROD_DB_NAME`, `PROD_DB_USERNAME`: Database credentials.

---

## 2. Remote State Setup & Bootstrapping

For high availability and multi-engineer safety, production Terraform requires a remote backend with S3 and DynamoDB state locking:

```bash
# 1. Create S3 Bucket for Terraform Remote State
aws s3api create-bucket \
  --bucket beyourownboss-terraform-state-prod \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket beyourownboss-terraform-state-prod \
  --versioning-configuration Status=Enabled

# 2. Create DynamoDB Table for Distributed State Locking
aws dynamodb create-table \
  --table-name beyourownboss-terraform-locks-prod \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

---

## 3. Infrastructure Rollout Sequence

Execute infrastructure provisioning using Terraform:

```bash
# 1. Switch to production environment directory
cd terraform/environments/prod

# 2. Initialize modules and remote provider
terraform init

# 3. Perform a dry-run plan
terraform plan -out=tfplan.binary

# 4. Apply infrastructure modifications
terraform apply tfplan.binary
```

### Outputs to Note
Upon completion, retrieve essential configuration endpoints:
```bash
ALB_DNS=$(terraform output -raw alb_dns_name)
DB_ENDPOINT=$(terraform output -raw database_endpoint)
CDN_DOMAIN=$(terraform output -raw cloudfront_domain_name)
COGNITO_POOL=$(terraform output -raw cognito_user_pool_id)
```

---

## 4. DNS & SSL Certificate Verification

1. **Route 53 DNS Records**:
   - `admin.byoboss.io` $\longrightarrow$ Alias A Record to `${ALB_DNS}`
   - `*.byoboss.io` $\longrightarrow$ Alias A Record to `${ALB_DNS}`
   - `cdn.byoboss.io` $\longrightarrow$ CNAME to `${CDN_DOMAIN}`
2. **ACM Validation**:
   - Verify that DNS validation CNAME records created by AWS ACM are propagated across all nameservers.
   - Status must show `ISSUED` before ALB HTTPS listener activates.

---

## 5. Container Image Build & ECR Push

Push the multi-stage Next.js production container image to Amazon ECR:

```bash
# 1. Authenticate Docker with Amazon ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# 2. Build multi-stage production image
docker build -t beyourownboss:v1.0.0 -f Dockerfile .

# 3. Tag and push image
docker tag beyourownboss:v1.0.0 123456789012.dkr.ecr.us-east-1.amazonaws.com/beyourownboss:v1.0.0
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/beyourownboss:v1.0.0
```

---

## 6. Database Migration Execution

Execute Drizzle ORM schema migrations against the production PostgreSQL instance:

```bash
# Run migration runner from secure bastion or ECS task one-off:
aws ecs run-task \
  --cluster beyourownboss-prod-cluster \
  --task-definition beyourownboss-prod-task \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-1234,subnet-5678],securityGroups=[sg-ecs],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"app","command":["node","-e","require(\"./drizzle/migrate.js\")"]}]}'
```

---

## 7. Post-Deployment Smoke Testing

Execute automated health verification against the live environment:

```bash
# 1. Health Probe Verification
curl -I https://admin.byoboss.io/api/health
# Expected: HTTP/2 200 OK

# 2. Database Connectivity Verification
curl -s https://admin.byoboss.io/api/health | jq .
# Expected: {"status":"healthy","database":"connected","uptime":...}

# 3. WAF Security Verification (Verify Auth Rate Limit)
# Sending 60 rapid requests to verify 429 response on request 51+
for i in {1..55}; do curl -s -o /dev/null -w "%{http_code}\n" https://admin.byoboss.io/api/v1/auth/login; done
```

---

## 8. Rollback Procedure

In the event of a critical failure or elevated 5XX error rates during rollout:

1. **ECS Service Immediate Rollback**:
   ```bash
   aws ecs update-service \
     --cluster beyourownboss-prod-cluster \
     --service beyourownboss-prod-service \
     --task-definition beyourownboss-prod-task:<PREVIOUS_REVISION_NUMBER>
   ```
2. **Database Rollback (if schema changed non-destructively)**:
   - Run Drizzle downgrade migration script.
   - If destructive corruption occurred, restore RDS from point-in-time snapshot created prior to deployment window.
3. **Traffic Reroute**:
   - If ALB or WAF misconfigured, reapply previous Terraform plan state.
