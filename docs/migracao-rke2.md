# Plano de Migração — LXC/Docker → RKE2 + ArgoCD (GitOps)

Documento de planejamento para migrar o stack de câmeras (SRS + MediaMTX + Caddy)
do LXC 201 com Docker para o cluster RKE2, gerenciado via **ArgoCD**.

**Status:** planejado — ambiente atual (LXC + Docker) permanece em produção.

---

## 1. Estado atual

```
iM7 (RTMP push)  → SRS (LXC 201, Docker)     → HLS/DVR → painel
iM7 (RTSP pull)  → MediaMTX (LXC 201, Docker) → WebRTC/HLS
Caddy            → TLS + proxy (cameras.*)
```

Componentes no CT 201 (`/opt/srs`):
- `srs-server` — RTMP ingest, HLS, DVR (`/var/records`)
- `rtmp-caddy` — TLS + reverse proxy
- `mediamtx` — RTSP pull, WebRTC/HLS, transcode H.265→H.264

## 2. Estado desejado (RKE2 + ArgoCD)

```
Git repo (manifests) → ArgoCD → sync → RKE2
                                        ├─ mediamtx Deployment → RTSP pull → WebRTC/HLS
                                        ├─ srs Deployment → RTMP ingest → HLS/DVR (PVC)
                                        └─ Ingress + cert-manager → TLS
Prometheus → scrape /metrics → Grafana
```

**Modelo GitOps:** toda mudança é commit no repo → ArgoCD aplica no cluster.
Nada de `kubectl apply` manual em produção.

## 3. Estrutura de manifests no repo

```
k8s/
├── base/
│   ├── namespace.yaml
│   ├── mediamtx/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml        # mediamtx.yml
│   │   └── secret.example.yaml   # senhas RTSP (usar SealedSecrets/ESO)
│   ├── srs/
│   │   ├── deployment.yaml
│   │   ├── service.yaml          # RTMP :1935 + HLS :8080
│   │   ├── configmap.yaml        # srs.conf
│   │   └── pvc.yaml              # gravações DVR
│   └── ingress.yaml              # TLS + rotas
├── overlays/
│   └── production/
│       └── kustomization.yaml
└── argocd/
    └── application.yaml          # App do ArgoCD apontando pro repo
```

## 4. Mapeamento de componentes

| Atual (Docker/LXC) | RKE2 | GitOps |
|---|---|---|
| `srs` container | Deployment + PVC | `k8s/base/srs/` |
| `mediamtx` container | Deployment | `k8s/base/mediamtx/` |
| `mediamtx.yml` | ConfigMap | versionado no git |
| `srs.conf` | ConfigMap | versionado no git |
| `mediamtx.env` (senhas) | **Secret** | SealedSecrets ou External Secrets |
| `rtmp-caddy` | Ingress + cert-manager | `k8s/base/ingress.yaml` |
| `/var/records` | PVC (Longhorn/NFS) | `pvc.yaml` |

## 5. Segredos (senhas das câmeras)

**Nunca commitar senha em plain text.** Opções com ArgoCD:

- **Sealed Secrets** (Bitnami) — commita o secret criptografado, descriptografa no cluster
- **External Secrets Operator** — puxa de um vault externo (Vault, AWS SM, etc.)
- **SOPS + age** — criptografia no git, ArgoCD descriptografa via plugin

**Recomendação:** Sealed Secrets — simples, roda no cluster, commit seguro.

## 6. Pontos de atenção

### 6.1 WebRTC precisa de UDP (porta 8189)
- **Opção A:** `hostNetwork: true` no pod mediamtx (simples, acopla ao nó)
- **Opção B:** MetalLB Service `type: LoadBalancer` UDP
- **Opção C:** servir só HLS via Ingress (TCP) — mais simples

**Recomendação inicial:** HLS via Ingress. WebRTC em fase 2.

### 6.2 RTMP ingest (porta 1935)
Câmeras fazem push pra `192.168.50.151:1935`. No cluster:
- Service `type: LoadBalancer` (MetalLB) com IP fixo, ou NodePort
- Reconfigurar câmeras pro novo endpoint (ou manter DNS apontando)

### 6.3 DVR / gravações
SRS grava em `/var/records` → precisa de PVC:
- Longhorn (se já no RKE2) ou NFS
- Migrar gravações com `rsync`/`kubectl cp`

### 6.4 Transcode H.265→H.264
`runOnDemand` roda ffmpeg — usa CPU do nó:
- `resources.requests/limits` no Deployment
- Imagem `bluenviron/mediamtx:latest-ffmpeg` já inclui ffmpeg

## 7. Fases da migração

### Fase 0 — Preparação (sem downtime)
- [ ] `kubectl get nodes` — cluster saudável
- [ ] `kubectl get sc` — storage class disponível
- [ ] MetalLB + Ingress + cert-manager instalados
- [ ] ArgoCD rodando e acessando o repo
- [ ] `kubectl create ns cameras`

### Fase 1 — Manifests + ArgoCD app (MediaMTX)
- [ ] Criar `k8s/base/mediamtx/` (Deployment, Service, ConfigMap)
- [ ] Secret das senhas via Sealed Secrets
- [ ] `k8s/argocd/application.yaml` apontando pro repo
- [ ] ArgoCD sync → validar `camera1_hd` via HLS
- [ ] Painel pode apontar pro novo endpoint (convive com o atual)

### Fase 2 — SRS no cluster
- [ ] `k8s/base/srs/` (Deployment, Service, ConfigMap, PVC)
- [ ] Service RTMP :1935 (LoadBalancer/NodePort)
- [ ] Reconfigurar câmeras pro novo endpoint
- [ ] Migrar gravações antigas pro PVC

### Fase 3 — Ingress + TLS
- [ ] Ingress com cert-manager (CA interna step-ca)
- [ ] Redirect domínio antigo → novo
- [ ] Desligar `rtmp-caddy`

### Fase 4 — Descomissionar LXC Docker
- [ ] Validar ~1 semana no cluster
- [ ] Backup final de `/var/records`
- [ ] Parar containers no CT 201
- [ ] Documentar rollback

## 8. Rollback

O ambiente LXC/Docker fica intacto até a Fase 4.
Rollback = reapontar DNS/câmeras pro `192.168.50.151` + `docker compose up -d`.

Com ArgoCD: rollback de manifests = `git revert` + sync.

## 9. Observabilidade

- **Prometheus:** scrape `mediamtx:9998/metrics` e `srs:1985/api/v1/`
- **Grafana:** dashboard "CAMERA OBSERVABILITY"
- **ArgoCD:** health/sync status dos manifests
- **Alertas:** path offline, transcode falhando, PVC cheio, pod restart

## 10. Estimativa de recursos (por pod)

| Pod | CPU req | CPU lim | RAM req | RAM lim |
|---|---|---|---|---|
| mediamtx | 100m | 2000m | 128Mi | 1Gi |
| srs | 100m | 1000m | 128Mi | 512Mi |

> Transcode de 1 stream 3MP ≈ 0.5–1 core. Limitar pra não derrubar o nó.

## 11. Application do ArgoCD (exemplo)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: cameras
  namespace: argocd
spec:
  project: default
  source:
    repoURL: <url-do-repo>
    targetRevision: main
    path: k8s/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: cameras
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```
