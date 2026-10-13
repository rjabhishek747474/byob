variable "aws_region" {
  description = "AWS region for production environment"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name identifier"
  type        = string
  default     = "beyourownboss"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}

variable "platform_domain" {
  description = "Platform root domain"
  type        = string
  default     = "byoboss.io"
}

variable "admin_subdomain" {
  description = "Admin subdomain"
  type        = string
  default     = "admin"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "byoboss_prod"
}

variable "db_username" {
  description = "Runtime database username"
  type        = string
  default     = "byoboss_admin"
}

variable "container_image" {
  description = "Container image URI"
  type        = string
  default     = "123456789012.dkr.ecr.us-east-1.amazonaws.com/beyourownboss:v1.0.0"
}

variable "container_cpu" {
  description = "CPU units for ECS task"
  type        = number
  default     = 512
}

variable "container_memory" {
  description = "Memory for ECS task in MiB"
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

variable "certificate_arn" {
  description = "Optional existing ACM Certificate ARN for HTTPS listener"
  type        = string
  default     = ""
}

variable "alarm_notification_sns_topic_arns" {
  description = "SNS Topic ARNs to receive critical production CloudWatch alarms"
  type        = list(string)
  default     = []
}
