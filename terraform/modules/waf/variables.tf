variable "project_name" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "alb_arn" {
  description = "ARN of the Application Load Balancer to associate with WAF"
  type        = string
}

variable "general_rate_limit" {
  description = "Rate-based rule limit for general traffic per 5-minute evaluation window"
  type        = number
  default     = 2000
}

variable "auth_rate_limit" {
  description = "Rate-based rule limit for authentication endpoints per 5-minute evaluation window"
  type        = number
  default     = 50
}
