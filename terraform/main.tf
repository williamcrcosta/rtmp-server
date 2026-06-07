terraform {
  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = "~> 0.66"
    }
  }
}

provider "proxmox" {
  endpoint  = var.proxmox_endpoint
  api_token = var.proxmox_api_token
  insecure  = true
}

resource "proxmox_virtual_environment_file" "cloud_init" {
  content_type = "snippets"
  datastore_id = "local"
  node_name    = var.proxmox_node

  source_raw {
    data = templatefile("${path.module}/cloud-init.yml", {
      ssh_public_key = var.ssh_public_key
    })
    file_name = "rtmp-server-cloud-init.yml"
  }
}

resource "proxmox_virtual_environment_vm" "rtmp_server" {
  name      = var.vm_name
  node_name = var.proxmox_node
  vm_id     = var.vm_id
  on_boot   = true

  clone {
    vm_id = var.template_id
    full  = true
  }

  cpu {
    cores = 4
    type  = "host"
  }

  memory {
    dedicated = 4096
  }

  # Disco SO
  disk {
    datastore_id = var.storage
    interface    = "scsi0"
    size         = 32
    discard      = "on"
  }

  # Disco gravações (50GB, 2 dias de retenção)
  disk {
    datastore_id = var.storage
    interface    = "scsi1"
    size         = var.records_disk_size
    discard      = "on"
  }

  network_device {
    bridge = "vmbr0"
    model  = "virtio"
  }

  initialization {
    ip_config {
      ipv4 {
        address = "${var.vm_ip}/24"
        gateway = var.vm_gateway
      }
    }
    user_data_file_id = proxmox_virtual_environment_file.cloud_init.id
  }
}
