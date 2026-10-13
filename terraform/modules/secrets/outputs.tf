output "kms_key_arn" {
  description = "ARN of the Customer Managed KMS Key"
  value       = aws_kms_key.app.arn
}

output "kms_key_id" {
  description = "ID of the Customer Managed KMS Key"
  value       = aws_kms_key.app.key_id
}

output "kms_key_alias_arn" {
  description = "ARN of the KMS Key Alias"
  value       = aws_kms_alias.app.arn
}

output "database_secret_arn" {
  description = "ARN of the database_url Secrets Manager secret"
  value       = aws_secretsmanager_secret.database_url.arn
}

output "database_secret_name" {
  description = "Name of the database_url Secrets Manager secret"
  value       = aws_secretsmanager_secret.database_url.name
}

output "auth_secret_arn" {
  description = "ARN of the auth_secret Secrets Manager secret"
  value       = aws_secretsmanager_secret.auth_secret.arn
}

output "auth_secret_name" {
  description = "Name of the auth_secret Secrets Manager secret"
  value       = aws_secretsmanager_secret.auth_secret.name
}
