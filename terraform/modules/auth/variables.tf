variable "project_name" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "mfa_configuration" {
  description = "MFA configuration mode: OPTIONAL (dev) or REQUIRED (prod)"
  type        = string
  default     = "OPTIONAL"

  validation {
    condition     = contains(["OFF", "OPTIONAL", "REQUIRED"], var.mfa_configuration)
    error_message = "MFA configuration must be OFF, OPTIONAL, or REQUIRED."
  }
}

variable "platform_domain" {
  description = "Domain name for callback and logout URLs"
  type        = string
  default     = "byoboss.io"
}

variable "admin_subdomain" {
  description = "Admin subdomain"
  type        = string
  default     = "admin"
}
