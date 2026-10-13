variable "project_name" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "us-east-1"
}

variable "private_app_subnet_ids" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security Group ID for ECS tasks"
  type        = string
}

variable "target_group_arn" {
  description = "ARN of ALB Target Group to register containers"
  type        = string
}

variable "container_image" {
  description = "Container image URI"
  type        = string
}

variable "container_cpu" {
  description = "Task CPU allocation"
  type        = number
  default     = 512
}

variable "container_memory" {
  description = "Task memory allocation in MiB"
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

variable "min_count" {
  description = "Minimum number of ECS tasks for autoscaling"
  type        = number
  default     = 2
}

variable "max_count" {
  description = "Maximum number of ECS tasks for autoscaling"
  type        = number
  default     = 10
}

variable "app_port" {
  description = "Application port"
  type        = number
  default     = 3000
}

variable "platform_domain" {
  description = "Primary platform domain"
  type        = string
  default     = "byoboss.io"
}

variable "s3_bucket_arn" {
  description = "ARN of S3 bucket for media access"
  type        = string
}

variable "kms_key_arn" {
  description = "KMS Key ARN for decryption permissions"
  type        = string
}

variable "database_secret_arn" {
  description = "Secrets Manager secret ARN for DATABASE_URL"
  type        = string
}

variable "auth_secret_arn" {
  description = "Secrets Manager secret ARN for AUTH_SECRET"
  type        = string
}
