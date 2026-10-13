variable "aws_region" {
  description = "AWS region for development environment"
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
  default     = "dev"
}

variable "platform_domain" {
  description = "Platform root domain"
  type        = string
  default     = "dev.byoboss.io"
}

variable "admin_subdomain" {
  description = "Admin subdomain"
  type        = string
  default     = "admin"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "byoboss_dev"
}

variable "db_username" {
  description = "Runtime database username"
  type        = string
  default     = "byoboss_dev_user"
}

variable "container_image" {
  description = "Container image URI"
  type        = string
  default     = "123456789012.dkr.ecr.us-east-1.amazonaws.com/beyourownboss:dev-latest"
}

variable "container_cpu" {
  description = "CPU units for ECS task"
  type        = number
  default     = 256
}

variable "container_memory" {
  description = "Memory for ECS task in MiB"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 1
}
