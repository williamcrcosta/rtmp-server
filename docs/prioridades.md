# Prioridades da revisão do sistema de câmeras

Revisão estática de 18/11/2026. A exposição de rede, o login, a reprodução, o uso de CPU e a recuperação das gravações precisam ser confirmados no ambiente. As caixas abaixo registram o que ainda precisa ser tratado ou validado.

O painel legado tem dois fluxos. O `rtsp.html` usa o MediaMTX para visualização das câmeras RTSP. O `cameras.html` usa o SRS para visualizar streams RTMP, cujo fluxo também alimenta o DVR. O painel Next.js em `app/` cobre principalmente a visualização via MediaMTX. Veja a [arquitetura](arquitetura.md) e o [README do painel novo](../app/README.md).

## Prioridade 1 — Crítica

Tratar primeiro. Inclui riscos à privacidade das câmeras, à integridade das gravações e à disponibilidade do serviço. Os bloqueios do painel novo se aplicam antes da troca em produção.

- [ ] **Restringir a API administrativa do MediaMTX.** O Caddy encaminha todo o prefixo `/mtx-api/*` e a configuração interna concede acesso à API a qualquer cliente. Publicar apenas a consulta de status necessária ao painel e exigir credenciais próprias para a API interna. Verificar que a configuração das câmeras e as operações administrativas ficam inacessíveis aos usuários do painel. [Caddyfile](../srs/Caddyfile#L16) · [MediaMTX](../srs/mediamtx.yml#L99)
- [ ] **Revogar o token de Proxmox exposto, se ainda estiver ativo.** Um token de `root@pam` apareceu na saída da checagem de formatação do arquivo local ignorado pelo Git. Substituí-lo por uma credencial com permissões mínimas e restringir o acesso ao arquivo local. [Configuração do provedor](../terraform/main.tf#L10)
- [ ] **Restringir a publicação RTMP.** O SRS publica a porta `1935` em todas as interfaces e os callbacks estão desativados. Limitar o acesso à rede das câmeras e autenticar os publicadores. Validar a publicação pelas câmeras autorizadas. [Compose](../srs/docker-compose.yml#L6) · [SRS](../srs/srs.conf#L43)
- [ ] **Verificar gravação, retenção e restauração.** Confirmar quais câmeras devem gravar e se cada uma gera arquivos reproduzíveis. O status RTSP do MediaMTX e o DVR RTMP do SRS são fluxos distintos. Configurar a retenção, alertar sobre espaço livre e testar a restauração com um backup adequado ao stack atual. A retenção de dois dias está documentada, mas não aparece na configuração versionada. [DVR](../srs/srs.conf#L34) · [Retenção documentada](../terraform/README.md#L94) · [Backup](../scripts/backup-runtime-data.sh#L7)
- [ ] **Proteger as rotas antes da troca para o Next.js.** Versionar o roteamento do Caddy para que o callback do Entra ID, o status e a sinalização WHEP cheguem ao app. Verificar o acesso anônimo aos proxies legados de vídeo e à API após a mudança, pois remover o Basic Auth pode deixá-los acessíveis diretamente. [Caddyfile](../srs/Caddyfile#L4) · [Deploy do app](../app/README.md#L19)

## Prioridade 2 — Alta, para homologação

Concluir antes de migrar os usuários para o Next.js. Inclui problemas de reprodução, recuperação após falhas e instalação.

- [ ] **Completar o fallback HLS autenticado.** Implementar a rota usada pelo player e pelo link HLS. Testar playlists e segmentos com WebRTC indisponível, em HD e Full. [Player](../app/src/app/components/CameraGrid.tsx#L141)
- [ ] **Tratar sessão expirada e falhas de status.** Fazer o painel distinguir sessão expirada, falha da API e câmera offline. Hoje o middleware pode devolver o HTML do login após um redirecionamento e o polling pode continuar exibindo dados antigos. [Middleware](../app/src/middleware.ts#L3) · [Polling](../app/src/app/components/CameraGrid.tsx#L33)
- [ ] **Tornar o deploy reproduzível.** Versionar a integração do Next.js com Compose e Caddy, preparar o `mediamtx.env` no provisionamento, fixar as imagens e versionar o lockfile do app. Testar instalação limpa e retorno ao painel antigo. [Provisionamento LXC](../lxc/create-lxc.sh#L108) · [Compose](../srs/docker-compose.yml#L36) · [Dockerfile](../app/Dockerfile#L1)
- [ ] **Definir o escopo da substituição do legado.** Confirmar se o Next.js substitui apenas o `rtsp.html` ou também o acesso aos streams RTMP e às gravações. Validar login pelo Entra ID e acesso de emergência. Se `admin` e `viewer` tiverem permissões diferentes, aplicar essas regras no servidor. [Arquitetura](arquitetura.md#L20) · [Autenticação](../app/src/auth.ts#L17) · [Controle de acesso da rota de status](../app/src/app/api/status/route.ts#L5)

## Prioridade 3 — Evolução planejada

Executar após estabilizar a operação e homologar o painel. São melhorias de capacidade, diagnóstico e manutenção.

- [ ] **Medir e ajustar a capacidade de transcode.** Medir CPU, estabilidade e tempo até o primeiro quadro com as três câmeras abertas e usuários alternando HD e Full. Os dois perfis podem coexistir e iniciar até seis processos FFmpeg. [Perfis de transcode](../srs/mediamtx.yml#L60)
- [ ] **Corrigir os totais de banda e espectadores.** Incluir os paths Full e identificar no painel quais indicadores representam a origem RTSP e quais representam a visualização no navegador. [Agregação de métricas](../app/src/lib/mediamtx.ts#L39)
- [ ] **Planejar a migração para RKE2 e ArgoCD após a homologação.** Validar separadamente a conectividade WebRTC, o endpoint RTMP e a persistência do DVR. Manter o LXC disponível até comprovar a recuperação no cluster e testar o rollback. [Plano RKE2](migracao-rke2.md#L82)
