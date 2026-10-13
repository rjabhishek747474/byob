# ─────────────────────────────────────────────────────────────────────────────
# CloudWatch Metric Alarms
# ─────────────────────────────────────────────────────────────────────────────

# 1. ECS CPU Utilization > 80%
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  alarm_name          = "${var.project_name}-${var.environment}-ecs-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Alarm triggers when ECS CPU utilization exceeds 80% for 10 minutes"
  alarm_actions       = var.alarm_action_arns
  ok_actions          = var.alarm_action_arns

  dimensions = {
    ClusterName = var.cluster_name
    ServiceName = var.service_name
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-ecs-cpu-high"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# 2. ECS Memory Utilization > 80%
resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  alarm_name          = "${var.project_name}-${var.environment}-ecs-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Alarm triggers when ECS Memory utilization exceeds 80% for 10 minutes"
  alarm_actions       = var.alarm_action_arns
  ok_actions          = var.alarm_action_arns

  dimensions = {
    ClusterName = var.cluster_name
    ServiceName = var.service_name
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-ecs-memory-high"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# 3. ALB 5XX Error Rate > 5%
resource "aws_cloudwatch_metric_alarm" "alb_5xx_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-alb-5xx-error-rate-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 5
  alarm_description   = "Alarm triggers when ALB HTTP 5XX error rate exceeds 5% for 10 minutes"
  alarm_actions       = var.alarm_action_arns
  ok_actions          = var.alarm_action_arns

  metric_query {
    id          = "e1"
    expression  = "(m1 / m2) * 100"
    label       = "ALB 5XX Error Rate (%)"
    return_data = "true"
  }

  metric_query {
    id = "m1"
    metric {
      metric_name = "HTTPCode_Target_5XX_Count"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      unit        = "Count"

      dimensions = {
        LoadBalancer = var.alb_arn_suffix
      }
    }
  }

  metric_query {
    id = "m2"
    metric {
      metric_name = "RequestCount"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      unit        = "Count"

      dimensions = {
        LoadBalancer = var.alb_arn_suffix
      }
    }
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-alb-5xx-rate-high"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# 4. RDS Free Storage Space < 5GB
resource "aws_cloudwatch_metric_alarm" "rds_free_storage_low" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-free-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 5368709120 # 5 GB in bytes
  alarm_description   = "Alarm triggers when RDS Free Storage Space drops below 5GB"
  alarm_actions       = var.alarm_action_arns
  ok_actions          = var.alarm_action_arns

  dimensions = {
    DBInstanceIdentifier = var.db_instance_id
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-rds-storage-low"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# 5. RDS Database Connections > 80
resource "aws_cloudwatch_metric_alarm" "rds_connections_high" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Alarm triggers when RDS active database connections exceed 80"
  alarm_actions       = var.alarm_action_arns
  ok_actions          = var.alarm_action_arns

  dimensions = {
    DBInstanceIdentifier = var.db_instance_id
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-rds-connections-high"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# CloudWatch Dashboard
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-${var.environment}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", var.service_name, "ClusterName", var.cluster_name, { "stat" = "Average", "label" = "ECS CPU Utilization (%)" }],
            [".", "MemoryUtilization", ".", ".", ".", ".", { "stat" = "Average", "label" = "ECS Memory Utilization (%)" }]
          ]
          period = 300
          region = "us-east-1"
          title  = "ECS Compute Resources (CPU & Memory)"
          view   = "timeSeries"
          yAxis = {
            left = {
              min = 0
              max = 100
            }
          }
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix, { "stat" = "Sum", "label" = "ALB Total Requests" }],
            [".", "HTTPCode_Target_2XX_Count", ".", ".", { "stat" = "Sum", "label" = "HTTP 2XX Success" }],
            [".", "HTTPCode_Target_4XX_Count", ".", ".", { "stat" = "Sum", "label" = "HTTP 4XX Client Error" }],
            [".", "HTTPCode_Target_5XX_Count", ".", ".", { "stat" = "Sum", "label" = "HTTP 5XX Server Error" }]
          ]
          period = 300
          region = "us-east-1"
          title  = "ALB Traffic & Response Distribution"
          view   = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", var.db_instance_id, { "stat" = "Average", "label" = "Active Connections" }],
            [".", "CPUUtilization", ".", ".", { "stat" = "Average", "label" = "RDS CPU (%)" }]
          ]
          period = 300
          region = "us-east-1"
          title  = "RDS Database Connections & CPU"
          view   = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", var.db_instance_id, { "stat" = "Average", "label" = "Free Storage (Bytes)" }]
          ]
          period = 300
          region = "us-east-1"
          title  = "RDS Free Storage Space"
          view   = "timeSeries"
        }
      }
    ]
  })
}
