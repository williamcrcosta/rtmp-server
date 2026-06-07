variable "proxmox_endpoint" {
  description = "URL da API do Proxmox (ex: https://192.168.50.1:8006)"
  type        = string
}

variable "proxmox_api_token" {
  description = "API Token do Proxmox (ex: root@pam!terraform=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)"
  type        = string
  sensitive   = true
}

variable "proxmox_node" {
  description = "Nome do node Proxmox (ex: pve)"
  type        = string
  default     = "pve"
}

variable "vm_id" {
  description = "ID da VM a ser criada"
  type        = number
  default     = 200
}

variable "vm_name" {
  description = "Nome da VM"
  type        = string
  default     = "rtmp-server"
}

variable "template_id" {
  description = "ID do template Cloud-Init Ubuntu 24.04"
  type        = number
  default     = 9000
}

variable "vm_ip" {
  description = "IP fixo da VM (ex: 192.168.50.20)"
  type        = string
}

variable "vm_gateway" {
  description = "Gateway da rede (ex: 192.168.50.1)"
  type        = string
}

variable "storage" {
  description = "Storage do Proxmox (ex: local-lvm)"
  type        = string
  default     = "local-lvm"
}

variable "ssh_public_key" {
  description = "Chave SSH pública para acesso à VM"
  type        = string
}

variable "records_disk_size" {
  description = "Tamanho do disco de gravações em GB (2 dias de retenção)"
  type        = number
  default     = 50
}
