output "vm_ip" {
  description = "IP da VM criada"
  value       = var.vm_ip
}

output "dashboard_url" {
  description = "URL do dashboard SRS"
  value       = "http://${var.vm_ip}:8080"
}

output "rtmp_url_camera1" {
  description = "URL de publicação RTMP câmera 1"
  value       = "rtmp://${var.vm_ip}:1935/live/camera1"
}

output "rtmp_url_camera2" {
  description = "URL de publicação RTMP câmera 2"
  value       = "rtmp://${var.vm_ip}:1935/live/camera2"
}
