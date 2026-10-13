output "alb_dns_name" {
  description = "ALB Public DNS name for Production environment"
  value       = module.alb.alb_dns_name
}

output "alb_zone_id" {
  description = "ALB Canonical Hosted Zone ID for Route53 ALIAS records"
  value       = module.alb.alb_zone_id
}

output "cloudfront_domain_name" {
  description = "CloudFront CDN domain name for Production media assets"
  value       = module.storage.cloudfront_domain_name
}

output "database_endpoint" {
  description = "RDS PostgreSQL endpoint address"
  value       = module.database.endpoint
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.auth.user_pool_id
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = module.auth.user_pool_client_id
}

output "ecs_service_name" {
  description = "ECS Service Name"
  value       = module.compute.service_name
}

output "cloudwatch_dashboard_name" {
  description = "CloudWatch Dashboard Name"
  value       = module.monitoring.dashboard_name
}
