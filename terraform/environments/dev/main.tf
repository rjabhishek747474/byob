terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "Terraform"
    }
  }
}

# 1. KMS Keys and Secrets Manager
module "secrets" {
  source                  = "../../modules/secrets"
  project_name            = var.project_name
  environment             = var.environment
  deletion_window_in_days = 7
}

# 2. Networking Tier (VPC, Subnets, SGs)
module "networking" {
  source       = "../../modules/networking"
  project_name = var.project_name
  environment  = var.environment
  app_port     = 3000
}

# 3. Application Load Balancer
module "alb" {
  source                = "../../modules/alb"
  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.networking.vpc_id
  public_subnet_ids     = module.networking.public_subnet_ids
  alb_security_group_id = module.networking.alb_security_group_id
  app_port              = 3000
  platform_domain       = var.platform_domain
}

# 4. Regional AWS WAF
module "waf" {
  source             = "../../modules/waf"
  project_name       = var.project_name
  environment        = var.environment
  alb_arn            = module.alb.alb_arn
  general_rate_limit = 2000
  auth_rate_limit    = 50
}

# 5. Database Tier (PostgreSQL 16)
module "database" {
  source                  = "../../modules/database"
  project_name            = var.project_name
  environment             = var.environment
  private_db_subnet_ids   = module.networking.private_db_subnet_ids
  rds_security_group_id   = module.networking.rds_security_group_id
  db_name                 = var.db_name
  db_username             = var.db_username
  instance_class          = "db.t4g.micro"
  allocated_storage       = 20
  max_allocated_storage   = 50
  multi_az                = false
  kms_key_arn             = module.secrets.kms_key_arn
  backup_retention_period = 1
  deletion_protection     = false
}

# 6. Storage Tier (S3 & CloudFront)
module "storage" {
  source          = "../../modules/storage"
  project_name    = var.project_name
  environment     = var.environment
  kms_key_arn     = module.secrets.kms_key_arn
  platform_domain = var.platform_domain
}

# 7. Authentication (Cognito User Pool)
module "auth" {
  source            = "../../modules/auth"
  project_name      = var.project_name
  environment       = var.environment
  mfa_configuration = "OPTIONAL"
  platform_domain   = var.platform_domain
  admin_subdomain   = var.admin_subdomain
}

# 8. Compute Tier (ECS Fargate)
module "compute" {
  source                 = "../../modules/compute"
  project_name           = var.project_name
  environment            = var.environment
  aws_region             = var.aws_region
  private_app_subnet_ids = module.networking.private_app_subnet_ids
  ecs_security_group_id  = module.networking.ecs_security_group_id
  target_group_arn       = module.alb.target_group_arn
  container_image        = var.container_image
  container_cpu          = var.container_cpu
  container_memory       = var.container_memory
  desired_count          = var.desired_count
  min_count              = 1
  max_count              = 3
  app_port               = 3000
  platform_domain        = var.platform_domain
  s3_bucket_arn          = module.storage.bucket_arn
  kms_key_arn            = module.secrets.kms_key_arn
  database_secret_arn    = module.secrets.database_secret_arn
  auth_secret_arn        = module.secrets.auth_secret_arn
}

# 9. Monitoring Tier (CloudWatch Metrics & Alarms)
module "monitoring" {
  source                  = "../../modules/monitoring"
  project_name            = var.project_name
  environment             = var.environment
  cluster_name            = module.compute.cluster_name
  service_name            = module.compute.service_name
  alb_arn_suffix          = module.alb.alb_arn_suffix
  target_group_arn_suffix = module.alb.target_group_arn_suffix
  db_instance_id          = module.database.instance_id
}
