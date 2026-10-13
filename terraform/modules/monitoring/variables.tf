variable "project_name" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "cluster_name" {
  description = "ECS Cluster Name"
  type        = string
}

variable "service_name" {
  description = "ECS Service Name"
  type        = string
}

variable "alb_arn_suffix" {
  description = "ALB ARN Suffix for CloudWatch metrics"
  type        = string
}

variable "target_group_arn_suffix" {
  description = "Target Group ARN Suffix for CloudWatch metrics"
  type        = string
}

variable "db_instance_id" {
  description = "RDS DB Instance Identifier"
  type        = string
}

variable "alarm_action_arns" {
  description = "List of ARNs (e.g., SNS topic) to notify when alarms trigger"
  type        = list(string)
  default     = []
}
