resource "aws_kms_key" "app" {
  description             = "KMS CMK for ${var.project_name}-${var.environment} encryption across RDS, S3, and Secrets"
  deletion_window_in_days = var.deletion_window_in_days
  enable_key_rotation     = true

  tags = {
    Name        = "${var.project_name}-${var.environment}-kms"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

resource "aws_kms_alias" "app" {
  name          = "alias/${var.project_name}-${var.environment}"
  target_key_id = aws_kms_key.app.key_id
}

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${var.project_name}/${var.environment}/database_url"
  description             = "Full PostgreSQL connection URI for ${var.project_name}-${var.environment}"
  kms_key_id              = aws_kms_key.app.arn
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = {
    Name        = "${var.project_name}-${var.environment}-secret-database-url"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

resource "aws_secretsmanager_secret" "auth_secret" {
  name                    = "${var.project_name}/${var.environment}/auth_secret"
  description             = "Application authentication secret and JWT signing key"
  kms_key_id              = aws_kms_key.app.arn
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = {
    Name        = "${var.project_name}-${var.environment}-secret-auth-secret"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}
