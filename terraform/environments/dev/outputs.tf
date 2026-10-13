output "alb_dns_name" {
  description = "ALB Public DNS name for Dev environment"
  value       = module.alb.alb_dns_name
}

output "cloudfront_domain_name" {
  description = "CloudFront CDN domain name for Dev assets"
  value       = module.storage.cloudfront_domain_name
}

output "database_endpoint" {
  description = "RDS endpoint address"
  value       = module.database.endpoint
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.auth.user_pool_id
}

output "ecs_service_name" {
  description = "ECS Service Name"
  value       = module.compute.service_name
}
