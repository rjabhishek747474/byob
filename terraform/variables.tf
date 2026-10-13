variable "aws_region" {
  description = "AWS region for infrastructure provisioning"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project name identifier used for resource tagging and prefixing"
  type        = string
  default     = "beyourownboss"
}

variable "platform_domain" {
  description = "Root domain for platform services and tenant routing"
  type        = string
  default     = "byoboss.io"
}

variable "admin_subdomain" {
  description = "Subdomain allocated to administrative console"
  type        = string
  default     = "admin"
}

variable "db_name" {
  description = "Name of the default PostgreSQL database"
  type        = string
  default     = "byoboss"
}

variable "db_username" {
  description = "Dedicated least-privilege runtime PostgreSQL username"
  type        = string
  default     = "byoboss_runtime"
}

variable "app_port" {
  description = "Port exposed by the Next.js container application"
  type        = number
  default     = 3000
}

variable "container_image" {
  description = "Container image repository URI and tag to deploy"
  type        = string
  default     = "123456789012.dkr.ecr.us-east-1.amazonaws.com/beyourownboss:latest"
}

variable "container_cpu" {
  description = "CPU units allocated to ECS Fargate task (512 = 0.5 vCPU)"
  type        = number
  default     = 512
}

variable "container_memory" {
  description = "Memory allocated to ECS Fargate task in MiB (1024 = 1 GB)"
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Desired number of ECS task instances running concurrently"
  type        = number
  default     = 2
}
