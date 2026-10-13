output "endpoint" {
  description = "Connection endpoint of the PostgreSQL RDS instance (host:port)"
  value       = aws_db_instance.main.endpoint
}

output "address" {
  description = "Hostname/address of the PostgreSQL RDS instance"
  value       = aws_db_instance.main.address
}

output "port" {
  description = "Port of the PostgreSQL RDS instance"
  value       = aws_db_instance.main.port
}

output "db_name" {
  description = "Name of the initial database"
  value       = aws_db_instance.main.db_name
}

output "instance_id" {
  description = "Identifier of the RDS instance"
  value       = aws_db_instance.main.identifier
}

output "resource_id" {
  description = "Resource ID of the RDS instance"
  value       = aws_db_instance.main.resource_id
}

output "master_user_secret_arn" {
  description = "ARN of the Secrets Manager secret storing the database master credentials"
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}
