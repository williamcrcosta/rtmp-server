# Terraform — Provisionamento da VM no Proxmox

Cria automaticamente a VM de RTMP no Proxmox com Cloud-Init, Docker e SRS já configurados.

## Pré-requisitos

### 1. Terraform instalado (na sua máquina ou no Proxmox)

```bash
apt install -y wget unzip
wget https://releases.hashicorp.com/terraform/1.9.5/terraform_1.9.5_linux_amd64.zip
unzip terraform_1.9.5_linux_amd64.zip -d /usr/local/bin/
```

### 2. Criar template Ubuntu 24.04 no Proxmox

Rodar **no shell do Proxmox**:

```bash
bash terraform/scripts/create-template.sh
```

Ajustar a variável `STORAGE` no script se necessário (padrão: `local-lvm`).

### 3. Criar API Token no Proxmox

```
Proxmox GUI → Datacenter → API Tokens → Add
  User:       root@pam
  Token ID:   terraform
  Privilege:  Desmarcar "Privilege Separation"
```

Copiar o token gerado para o `terraform.tfvars`.

### 4. Habilitar snippets no storage local

```
Proxmox GUI → Datacenter → Storage → local → Edit
  Content: marcar "Snippets"
```

## Deploy

```bash
# 1. Entrar na pasta
cd terraform/

# 2. Copiar e preencher variáveis
cp terraform.tfvars.example terraform.tfvars
# editar terraform.tfvars com seus valores

# 3. Inicializar
terraform init

# 4. Verificar o plano
terraform plan

# 5. Criar a VM
terraform apply
```

## Resultado após apply

```
Outputs:
  dashboard_url    = "http://192.168.50.20:8080"
  rtmp_url_camera1 = "rtmp://192.168.50.20:1935/live/camera1"
  rtmp_url_camera2 = "rtmp://192.168.50.20:1935/live/camera2"
  vm_ip            = "192.168.50.20"
```

A VM já estará com Docker rodando e SRS ativo.

## Primeiro acesso

```
Dashboard: http://IP:8080
Usuário:   admin
Senha:     changeme123   ← TROCAR IMEDIATAMENTE
```

Trocar senha:

```bash
ssh william@IP
htpasswd /etc/nginx/.htpasswd admin
docker compose -f /opt/rtmp-server/srs/docker-compose.yml restart
```

## Disco de gravações

- Disco `scsi1` (50GB) montado em `/var/records`
- Retenção de 2 dias configurada no `srs.conf`
- Gravações em `/var/records/live/cameraX-YYYY-MM-DD-HH_MM_SS.flv`

## Destruir a VM

```bash
terraform destroy
```
