variable "project_name" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where the ALB and Target Group reside"
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs where ALB is deployed"
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "Security Group ID attached to ALB"
  type        = string
}

variable "app_port" {
  description = "Target port for container traffic"
  type        = number
  default     = 3000
}

variable "platform_domain" {
  description = "Primary platform domain name"
  type        = string
  default     = "byoboss.io"
}

variable "certificate_arn" {
  description = "Optional ACM certificate ARN for HTTPS listener. If empty, an ACM certificate request will be generated."
  type        = string
  default     = ""
}
