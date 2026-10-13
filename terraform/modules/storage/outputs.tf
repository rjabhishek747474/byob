output "bucket_name" {
  description = "Name of the S3 media bucket"
  value       = aws_s3_bucket.assets.id
}

output "bucket_arn" {
  description = "ARN of the S3 media bucket"
  value       = aws_s3_bucket.assets.arn
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront CDN distribution"
  value       = aws_cloudfront_distribution.cdn.id
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront CDN distribution"
  value       = aws_cloudfront_distribution.cdn.domain_name
}

output "cloudfront_distribution_arn" {
  description = "ARN of the CloudFront CDN distribution"
  value       = aws_cloudfront_distribution.cdn.arn
}
