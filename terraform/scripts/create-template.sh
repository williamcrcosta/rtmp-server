#!/usr/bin/env bash
# Rodar no shell do Proxmox como root
# Cria template Ubuntu 24.04 Cloud-Init (VM ID 9000)
set -euo pipefail

TEMPLATE_ID=9000
TEMPLATE_NAME="ubuntu-2404-cloudinit"
STORAGE="local-lvm"   # ajuste para seu storage (ex: local-lvm, ceph, zfs-pool)
NODE=$(hostname)

echo "=== Baixando imagem Ubuntu 24.04 Cloud Image ==="
cd /tmp
wget -q --show-progress \
  https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img \
  -O ubuntu-24.04-cloud.img

echo "=== Criando VM template (ID: ${TEMPLATE_ID}) ==="
qm create ${TEMPLATE_ID} \
  --name "${TEMPLATE_NAME}" \
  --memory 2048 \
  --cores 2 \
  --net0 virtio,bridge=vmbr0 \
  --ostype l26 \
  --machine q35 \
  --cpu host \
  --scsihw virtio-scsi-pci

echo "=== Importando disco ==="
qm importdisk ${TEMPLATE_ID} ubuntu-24.04-cloud.img ${STORAGE}

echo "=== Configurando discos e boot ==="
qm set ${TEMPLATE_ID} \
  --scsi0 ${STORAGE}:vm-${TEMPLATE_ID}-disk-0,discard=on \
  --ide2 ${STORAGE}:cloudinit \
  --boot order=scsi0 \
  --serial0 socket \
  --vga serial0

echo "=== Convertendo para template ==="
qm template ${TEMPLATE_ID}

echo ""
echo "=== Template criado com sucesso! ==="
echo "ID: ${TEMPLATE_ID} | Nome: ${TEMPLATE_NAME}"
echo "Agora rode: terraform init && terraform apply"
