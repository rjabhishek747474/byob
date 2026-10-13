variable "project_name" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "kms_key_arn" {
  description = "KMS Key ARN for S3 server-side encryption"
  type        = string
}

variable "platform_domain" {
  description = "Base domain for allowed CORS origins"
  type        = string
  default     = "byoboss.io"
}
