output "dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

output "alarm_arns" {
  description = "ARNs of configured CloudWatch metric alarms"
  value = [
    aws_cloudwatch_metric_alarm.ecs_cpu_high.arn,
    aws_cloudwatch_metric_alarm.ecs_memory_high.arn,
    aws_cloudwatch_metric_alarm.alb_5xx_rate.arn,
    aws_cloudwatch_metric_alarm.rds_free_storage_low.arn,
    aws_cloudwatch_metric_alarm.rds_connections_high.arn
  ]
}
