# CONTAINER ORCHESTRATION — Docker, Kubernetes, Helm, IaC & Production Deployments

## PURPOSE

Production-grade templates, patterns, and verification steps for containerization,
orchestration, infrastructure-as-code, and deployment strategies. Every section
produces runnable configs — not theory.

## TRIGGERS

- "Dockerize my app"
- "Set up Kubernetes manifests"
- "Create a Helm chart"
- "Configure autoscaling"
- "Set up Terraform"
- "Blue-green / canary deployment"
- "Add health checks / probes"
- "Configure service discovery"
- "Build caching optimization"
- "Feature flags infrastructure"
- "HPA / KEDA / Cluster Autoscaler"
- "Any request mentioning: Dockerfile, docker-compose, K8s, Deployment, Service, Ingress, ConfigMap, Secret, HPA, PDB, Helm, Terraform, IaC, ArgoCD, canary, blue-green, BuildKit, KEDA, Consul, LaunchDarkly"

---

## 1. DOCKER — Multi-Stage Builds & Production Images

### Problem

Naive Dockerfiles produce bloated images (1 GB+), leak build tools into production,
run as root, and ignore layer caching — slowing CI and increasing attack surface.

### Runnable Config

**Multi-stage Dockerfile** (`Dockerfile`):

```dockerfile
# syntax=docker/dockerfile:1.7
FROM <base-image>:<version> AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev
COPY . .
RUN npm run build

# ---- Production stage ----
FROM <base-image>:<version>-slim AS production
RUN addgroup --system --gid 1001 appgroup \
    && adduser --system --uid 1001 --ingroup appgroup appuser
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=appuser:appgroup package.json ./
USER appuser
EXPOSE <port>
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:<port>/health || exit 1
CMD ["node", "dist/main.js"]
```

**.dockerignore**:

```
node_modules
.git
.gitignore
*.md
.env
.env.*
dist
.cache
coverage
test
tests
Dockerfile
.dockerignore
```

**docker-compose.yml** (dev):

```yaml
version: "3.9"
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
      cache_from:
        - <registry>/<image>:cache
    ports:
      - "<host-port>:<container-port>"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://user:pass@db:5432/<db>
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:<port>/health"]
      interval: 15s
      timeout: 5s
      retries: 3

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: <db>
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d <db>"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

### Common Pitfalls

- Installing `devDependencies` in the production stage
- Running as `root` (adds container breakout risk)
- No `.dockerignore` → sends entire project to Docker daemon
- Copying `node_modules` from host instead of rebuilding inside container
- Missing `HEALTHCHECK` → orchestrator can't detect dead containers

### Verification

```bash
# Scan for security issues
docker scout quick <image>

# Check image size
docker images <image> --format "{{.Size}}"

# Run local smoke test
docker run --rm -p <host-port>:<container-port> <image> \
  && curl -f http://localhost:<host-port>/health
```

---

## 2. KUBERNETES — Deployments, Services, Ingress, Config & Secrets

### Problem

Raw pods are ephemeral. Without Deployments, Services, Ingress controllers,
ConfigMaps, and Secrets, you get downtime, no rolling updates, no service
discovery, and credentials baked into images.

### Runnable Configs

**Deployment** (`k8s/deployment.yaml`):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: <app-name>
  namespace: <namespace>
  labels:
    app: <app-name>
    env: <environment>
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: <app-name>
  template:
    metadata:
      labels:
        app: <app-name>
    spec:
      serviceAccountName: <sa-name>
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
        - name: <app-name>
          image: <registry>/<image>:<tag>
          ports:
            - containerPort: <port>
              protocol: TCP
          envFrom:
            - configMapRef:
                name: <app-name>-config
            - secretRef:
                name: <app-name>-secrets
          resources:
            requests:
              cpu: "250m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          livenessProbe:
            httpGet:
              path: /health
              port: <port>
            initialDelaySeconds: 10
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: <port>
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            successThreshold: 1
          startupProbe:
            httpGet:
              path: /health
              port: <port>
            initialDelaySeconds: 0
            periodSeconds: 5
            failureThreshold: 30
```

**Service** (`k8s/service.yaml`):

```yaml
apiVersion: v1
kind: Service
metadata:
  name: <app-name>-svc
  namespace: <namespace>
  labels:
    app: <app-name>
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: <port>
      protocol: TCP
      name: http
  selector:
    app: <app-name>
```

**Ingress** (`k8s/ingress.yaml`):

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: <app-name>-ingress
  namespace: <namespace>
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
    - hosts:
        - <app-domain>
      secretName: <app-name>-tls
  rules:
    - host: <app-domain>
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: <app-name>-svc
                port:
                  number: 80
```

**ConfigMap** (`k8s/configmap.yaml`):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: <app-name>-config
  namespace: <namespace>
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  API_URL: "https://<api-domain>"
```

**Secret** (`k8s/secret.yaml` — commit encrypted, never raw):

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: <app-name>-secrets
  namespace: <namespace>
type: Opaque
stringData:
  DATABASE_URL: "postgres://<user>:<pass>@<host>:5432/<db>"
  REDIS_URL: "redis://:<pass>@<host>:6379"
  JWT_SECRET: "<jwt-secret>"
```

Use `sops` or `sealed-secrets` to encrypt before committing:

```bash
# Encrypt with sops
sops --encrypt k8s/secret.yaml > k8s/secret.enc.yaml

# Or create a SealedSecret
kubeseal --format yaml < k8s/secret.yaml > k8s/sealed-secret.yaml
```

**PodDisruptionBudget** (`k8s/pdb.yaml`):

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: <app-name>-pdb
  namespace: <namespace>
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: <app-name>
```

### Common Pitfalls

- `imagePullPolicy: Always` on prod (wastes bandwidth — omit for `:latest` only)
- No resource limits → noisy neighbor pods starve others
- Probes pointing at the same endpoint with identical thresholds
- Secrets committed in plaintext to Git
- Ingress missing TLS annotation → plaintext traffic
- `maxUnavailable: 1` with `replicas: 1` → downtime during rolling update

### Verification

```bash
# Validate all manifests
kubectl apply --dry-run=client -f k8s/

# Check rollout status
kubectl rollout status deployment/<app-name> -n <namespace>

# Port-forward for local test
kubectl port-forward svc/<app-name>-svc 8080:80 -n <namespace>
curl -f http://localhost:8080/health

# Check pods are ready
kubectl get pods -n <namespace> -l app=<app-name> -w

# Verify PDB
kubectl get pdb <app-name>-pdb -n <namespace>
```

---

## 3. HELM CHARTS — Structure, Values, Templating

### Problem

Raw YAML doesn't compose. Every environment needs different replicas,
image tags, and URLs. Helm adds parameterization, release management,
and rollback.

### Runnable Config

**Chart structure**:

```
<chart-name>/
├── Chart.yaml
├── values.yaml
├── values-staging.yaml
├── values-production.yaml
├── charts/                  # vendored dependencies
├── templates/
│   ├── _helpers.tpl         # shared named templates
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── secret.yaml          # only if not using external secrets
│   ├── hpa.yaml
│   ├── pdb.yaml
│   ├── serviceaccount.yaml
│   └── tests/
│       └── test-connection.yaml
└── .helmignore
```

**Chart.yaml**:

```yaml
apiVersion: v2
name: <chart-name>
description: <description>
type: application
version: 0.1.0
appVersion: "1.0.0"
dependencies:
  - name: redis
    version: "~18.0.0"
    repository: "https://charts.bitnami.com/bitnami"
    condition: redis.enabled
  - name: postgresql
    version: "~15.0.0"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled
```

**values.yaml** (canonical):

```yaml
# --- Global ---
global:
  environment: production
  imageRegistry: <registry>

# --- Application ---
replicaCount: 3

image:
  repository: <registry>/<image>
  tag: latest
  pullPolicy: IfNotPresent

serviceAccount:
  create: true
  name: ""

service:
  type: ClusterIP
  port: 80
  targetPort: <container-port>

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: <app-domain>
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: <app-name>-tls
      hosts:
        - <app-domain>

resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

pdb:
  enabled: true
  minAvailable: 2

config:
  NODE_ENV: production
  LOG_LEVEL: info
  API_URL: "https://<api-domain>"

secrets:
  DATABASE_URL: ""          # set via --set or external-secrets
  JWT_SECRET: ""

# --- Dependencies ---
redis:
  enabled: false
  architecture: standalone
  auth:
    enabled: true
    password: ""

postgresql:
  enabled: false
  auth:
    database: <db>
    username: <user>
    password: ""
```

**Templating pattern** (`templates/deployment.yaml` snippet):

```yaml
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "<chart-name>.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "<chart-name>.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "<chart-name>.serviceAccountName" . }}
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - containerPort: {{ .Values.service.targetPort }}
          env:
            {{- range $key, $val := .Values.config }}
            - name: {{ $key }}
              value: {{ $val | quote }}
            {{- end }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
```

**Install/upgrade**:

```bash
# Template and validate
helm template <release> ./<chart-name> --values <chart-name>/values-production.yaml

# Install
helm upgrade --install <release> ./<chart-name> \
  --namespace <namespace> --create-namespace \
  --values <chart-name>/values-production.yaml \
  --set image.tag=<commit-sha>

# Rollback
helm rollback <release> <revision>

# List revisions
helm history <release> -n <namespace>
```

### Common Pitfalls

- Storing secrets in `values.yaml` instead of external secrets or `--set`
- Not vendoring dependencies (`helm dependency update` before packaging)
- Using `latest` tag in production (unrepeatable)
- `toYaml` on untrusted values without `nindent` → broken indentation
- No `helm template` check in CI

### Verification

```bash
# Lint chart
helm lint <chart-name>

# Diff against live release (requires helm-diff plugin)
helm diff upgrade <release> ./<chart-name> --values values-production.yaml

# Dry-run install
helm install --dry-run --debug <release> ./<chart-name> --values values-production.yaml
```

---

## 4. SERVICE DISCOVERY — K8s DNS, Consul, ECS

### Problem

Hardcoding IP addresses and ports breaks when pods restart, scale up, or
move across nodes. Services need a reliable way to find each other.

### Runnable Configs

**Kubernetes DNS** (built-in — no config needed for basic use):

```yaml
# A Service named "my-svc" in namespace "prod" is reachable at:
#   my-svc.prod.svc.cluster.local
#   my-svc.prod.svc.cluster.local:<port>
#
# Headless Service for StatefulSets (DNS returns pod IPs directly):
apiVersion: v1
kind: Service
metadata:
  name: <statefulset-name>
  namespace: <namespace>
spec:
  clusterIP: None
  selector:
    app: <app-name>
  ports:
    - port: <port>
      name: http
```

**Consul Service Mesh** (sidecar pattern in `values.yaml`):

```yaml
consul:
  enabled: true
  global:
    datacenter: dc1
    image: hashicorp/consul:1.18
  connectInject:
    enabled: true
    default: true
  controller:
    enabled: true
  # App annotation to opt in (on namespace or pod):
  # annotations:
  #   consul.hashicorp.com/connect-inject: "true"
```

```yaml
# Service intention (allow app-a to talk to app-b):
apiVersion: consul.hashicorp.com/v1alpha1
kind: ServiceIntentions
metadata:
  name: <app-a>-to-<app-b>
spec:
  destination:
    name: <app-b>
  sources:
    - name: <app-a>
      action: allow
```

**AWS ECS Service Discovery** (Cloud Map):

```yaml
# Cloud Map namespace + service in Terraform:
resource "aws_service_discovery_private_dns_namespace" "this" {
  name        = "<namespace>.local"
  vpc         = aws_vpc.main.id
  description = "ECS service discovery"
}

resource "aws_service_discovery_service" "this" {
  name = "<service-name>"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.this.id
    dns_records {
      ttl  = 10
      type = "A"
    }
    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}
```

### Common Pitfalls

- Using `hostNetwork: true` needlessly (bypasses DNS, breaks network policies)
- Not relying on K8s DNS SRV records for StatefulSets
- Consul/ECS SD with mismatched health checks (unhealthy endpoints served)

### Verification

```bash
# K8s DNS resolution inside the cluster
kubectl run dns-test --image=busybox:1.36 --rm -it --restart=Never \
  -- nslookup <service-name>.<namespace>.svc.cluster.local

# Consul service list
kubectl exec deploy/<app-name> -n <namespace> -- consul catalog services

# ECS Cloud Map (via AWS CLI)
aws servicediscovery list-instances --service-id <service-id>
```

---

## 5. AUTOSCALING — HPA, KEDA, Cluster Autoscaler

### Problem

Static replica counts waste money during low traffic and cause outages during
spikes. CPU-only scaling misses business-driven signals (queue depth, request rate).

### Runnable Configs

**HPA (CPU + memory)** (`k8s/hpa.yaml`):

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: <app-name>-hpa
  namespace: <namespace>
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: <app-name>
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
```

**KEDA (event-driven)** — scale on queue depth, request rate, cron, etc.:

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: <app-name>-keda
  namespace: <namespace>
spec:
  scaleTargetRef:
    name: <app-name>
  minReplicaCount: 1
  maxReplicaCount: 30
  pollingInterval: 15
  cooldownPeriod: 60
  triggers:
    - type: aws-sqs-queue
      metadata:
        queueURL: "https://sqs.<region>.amazonaws.com/<account-id>/<queue-name>"
        queueLength: "10"
        awsRegion: "<region>"
    - type: prometheus
      metadata:
        serverAddress: "http://<prometheus-server>:9090"
        metricName: http_requests_per_second
        query: |
          sum(rate(http_requests_total{app="<app-name>"}[2m]))
        threshold: "100"
```

**Cluster Autoscaler** (add/remove nodes — no YAML, set flags):

```yaml
# Deploy cluster-autoscaler via Helm
cluster-autoscaler:
  enabled: true
  autoDiscovery:
    clusterName: <cluster-name>
  awsRegion: <region>
  extraArgs:
    skip-nodes-with-local-storage: false
    balance-similar-node-groups: true
    scale-down-enabled: true
    scale-down-delay-after-add: 10m
    scale-down-unneeded-time: 10m
```

### Common Pitfalls

- Conflicting HPA and KEDA on the same Deployment (use one scale target)
- `stabilizationWindowSeconds` too short → thrashing during traffic bursts
- Cluster Autoscaler without instance diversity → can't scale if one AZ is full
- No PDB → scale-down can evict every replica at once

### Verification

```bash
# Check HPA status
kubectl get hpa <app-name>-hpa -n <namespace>

# Describe for events
kubectl describe hpa <app-name>-hpa -n <namespace>

# Check KEDA ScaledObject status
kubectl get scaledobject <app-name>-keda -n <namespace> -o yaml

# Cluster Autoscaler logs
kubectl logs -n kube-system deployment/cluster-autoscaler --tail=50
```

---

## 6. LIVENESS, READINESS & STARTUP PROBES

### Problem

Without probes, K8s sends traffic to crashed pods, kills pods that are still
starting up, and has no way to self-heal.

### When to Use Each

| Probe        | Purpose                                      | Failure action       |
|-------------|----------------------------------------------|----------------------|
| `startupProbe`  | Slow-starting containers (>30s initial delay) | Kill pod, restart   |
| `livenessProbe` | Container is alive (not deadlocked/crashed)   | Kill pod, restart   |
| `readinessProbe`| Container can serve traffic                   | Remove from Service |

### Runnable Config

```yaml
# Fast HTTP service
livenessProbe:
  httpGet:
    path: /health
    port: <port>
  initialDelaySeconds: 10
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /ready
    port: <port>
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 3
  successThreshold: 1

# Startup probe — only needed if app takes >30s to init
startupProbe:
  httpGet:
    path: /health
    port: <port>
  initialDelaySeconds: 0
  periodSeconds: 5
  failureThreshold: 30   # 30 * 5 = 150s max startup time
```

```yaml
# For gRPC services (K8s 1.24+):
livenessProbe:
  grpc:
    port: <grpc-port>
  initialDelaySeconds: 10
  periodSeconds: 30
```

```yaml
# For TCP-only services:
readinessProbe:
  tcpSocket:
    port: <port>
  initialDelaySeconds: 5
  periodSeconds: 10
```

```yaml
# For workers / queue consumers (no HTTP):
livenessProbe:
  exec:
    command:
      - /bin/grpc_health_probe
      - -addr=localhost:<port>
  initialDelaySeconds: 10
  periodSeconds: 30
```

### Common Pitfalls

- Same endpoint for liveness and readiness → pod killed during graceful shutdown
- `failureThreshold` too low → flapping pod on transient blips
- No startup probe on apps with >30s init → infinite restart loop
- Probes on external dependencies → cascading failure if DB is slow
- `periodSeconds` too low (1-5s) → unnecessary load on the application

### Verification

```bash
# Check pod probe status
kubectl get pods -n <namespace> -l app=<app-name> -o wide

# Inspect probe events
kubectl describe pod <pod-name> -n <namespace> | grep -A5 -i probe

# Simulate failure (if app has a kill endpoint)
curl -X POST http://<pod-ip>:<port>/_/kill  # observe restart
```

---

## 7. INFRASTRUCTURE AS CODE — Terraform

### Problem

Click-ops infrastructure is unrepeatable, un-reviewable, and un-recoverable.
Terraform provides declarative, version-controlled infrastructure with drift
detection and state management.

### Runnable Config

**Provider setup** (`terraform/main.tf`):

```hcl
terraform {
  required_version = ">= 1.7"
  backend "s3" {
    bucket         = "<tf-state-bucket>"
    key            = "<project>/<environment>/terraform.tfstate"
    region         = "<region>"
    encrypt        = true
    dynamodb_table = "<tf-lock-table>"
  }
}

provider "aws" {
  region = "<region>"
  default_tags {
    tags = {
      Project     = "<project>"
      Environment = terraform.workspace
      ManagedBy   = "terraform"
    }
  }
}
```

**S3 + DynamoDB for remote state** (`terraform/bootstrap.tf`):

```hcl
resource "aws_s3_bucket" "terraform_state" {
  bucket = "<tf-state-bucket>"
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "<tf-lock-table>"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }
}
```

**Module structure**:

```
terraform/
├── main.tf              # provider + backend
├── variables.tf         # input variables
├── outputs.tf           # outputs
├── modules/
│   ├── networking/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── compute/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── database/
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
└── environments/
    ├── dev/
    │   └── terraform.tfvars
    ├── staging/
    │   └── terraform.tfvars
    └── prod/
        └── terraform.tfvars
```

**Module call pattern** (`terraform/modules/compute/main.tf`):

```hcl
resource "aws_ecs_service" "this" {
  name            = "<service-name>-${var.environment}"
  cluster         = var.ecs_cluster_id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [var.sg_id]
  }

  deployment_controller {
    type = "CODE_DEPLOY"  # enables blue/green via CodeDeploy
  }

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }
}
```

**Workspace usage**:

```bash
# Create workspaces per environment
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod

# Select and apply
terraform workspace select dev
terraform plan -var-file=environments/dev/terraform.tfvars
terraform apply -var-file=environments/dev/terraform.tfvars
```

### Common Pitfalls

- Storing `terraform.tfstate` locally (lose it = lose infra mapping)
- No state locking → concurrent applies corrupt state
- Using `latest` provider version with no constraints
- Hardcoding environment differences instead of using workspaces + tfvars
- Secrets in plaintext in `.tfvars` (use `sops` or Vault provider)
- `ignore_changes` on everything → drift unknown

### Verification

```bash
# Validate syntax
terraform fmt -recursive && terraform validate

# Plan against each environment
terraform workspace select staging
terraform plan -var-file=environments/staging/terraform.tfvars

# Check state integrity
terraform state list | head -20

# Drift detection
terraform plan -detailed-exitcode
echo "Exit code 0=clean, 2=drift"
```

---

## 8. BUILD CACHING — Docker Layer Caching & BuildKit

### Problem

Every CI build re-installs dependencies and re-compiles from scratch, turning
a 30-second code change into a 10-minute build. Layer and remote caching
dramatically speeds up CI.

### Runnable Configs

**Docker layer caching** (order your Dockerfile by change frequency):

```dockerfile
# Least-frequently-changing layers FIRST
FROM <base-image>:<version> AS builder
WORKDIR /app

# 1. Package manifests (change rarely)
COPY package.json package-lock.json* ./

# 2. Dependency install (cached until package.json changes)
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# 3. Source code (changes every commit)
COPY . .

# 4. Build (cached until source changes)
RUN npm run build
```

**GitHub Actions cache** (`.github/workflows/build.yml`):

```yaml
name: Build and Push
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Cache Docker layers
        uses: actions/cache@v4
        with:
          path: /tmp/.buildx-cache
          key: ${{ runner.os }}-buildx-${{ github.sha }}
          restore-keys: |
            ${{ runner.os }}-buildx-

      - name: Log in to registry
        uses: docker/login-action@v3
        with:
          registry: <registry>
          username: ${{ secrets.REGISTRY_USER }}
          password: ${{ secrets.REGISTRY_PASS }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: <registry>/<image>:${{ github.sha }},<registry>/<image>:latest
          cache-from: type=local,src=/tmp/.buildx-cache
          cache-to: type=local,dest=/tmp/.buildx-cache-new,mode=max

      - # Temp fix: move cache to avoid growing indefinitely
        name: Move cache
        run: |
          rm -rf /tmp/.buildx-cache
          mv /tmp/.buildx-cache-new /tmp/.buildx-cache
```

**BuildKit inline cache** (push/registry cache):

```bash
# Build with registry cache (multi-stage, multi-arch)
docker buildx build \
  --cache-from type=registry,ref=<registry>/<image>:cache \
  --cache-to type=registry,ref=<registry>/<image>:cache,mode=max \
  --tag <registry>/<image>:<tag> \
  --platform linux/amd64,linux/arm64 \
  --push \
  .
```

**Dockerfile layer order cheat sheet** (by change frequency):

```
┌─────────────────────────────────┐
│  OS packages (FROM)             │  ← almost never changes
│  System deps (apt/apk)          │  ← rarely changes
│  Language runtime (nvm/pyenv)   │  ← rarely changes
│  Dependency manifests (lock)    │  ← changes on dep updates
│  Dependency install (ci/install) │  ← cached with manifest
│  Application config             │  ← may change per env
│  Source code                    │  ← changes every commit
│  Build step                     │  ← changes with source
└─────────────────────────────────┘
```

### Common Pitfalls

- Copying entire `node_modules` or `vendor/` before source → busts cache on any change
- No `.dockerignore` → sends `.git` (history) to Docker daemon on every build
- `--cache-to` without `mode=max` → only caches the final stage, not intermediates
- Registry cache without periodic pruning → stale + growing cache
- CI cache key too narrow (only `${{ github.sha }}`) → never hits on restore

### Verification

```bash
# Check cache hit rate
docker buildx build --no-cache-filter=...  # omit to measure
docker system df                           # cache disk usage

# Inspect layers in an image
docker history <image>:<tag>

# Build from scratch vs cached (compare times)
time docker buildx build --load .
```

---

## 9. BLUE-GREEN / CANARY / ROLLING DEPLOYMENTS

### Problem

A bad release to 100% of users means full outage. Staged rollouts limit blast
radius, enable automated rollback, and give observability time to detect anomalies.

### Runnable Configs

**Rolling update** (K8s native — in `strategy`):

```yaml
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # spin up 1 new pod before killing 1 old
      maxUnavailable: 0    # never go below desired replicas
```

**Blue-Green with Service selector swap**:

```yaml
# Apply green deployment alongside blue, then patch Service selector
apiVersion: apps/v1
kind: Deployment
metadata:
  name: <app-name>-green
  labels:
    app: <app-name>
    version: green
spec:
  replicas: 5
  selector:
    matchLabels:
      app: <app-name>
      version: green
  template:
    metadata:
      labels:
        app: <app-name>
        version: green
    spec:
      containers:
        - name: <app-name>
          image: <registry>/<image>:<new-version>
---
# Cutover: patch Service selector to green
# kubectl patch svc <app-name>-svc -p '{"spec":{"selector":{"version":"green"}}}'
```

**Canary (gradual traffic split via Service Mesh)**:

```yaml
# Istio VirtualService
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: <app-name>-vs
  namespace: <namespace>
spec:
  hosts:
    - <app-name>
  http:
    - match:
        - headers:
            x-canary:
              exact: "true"
      route:
        - destination:
            host: <app-name>-canary
          weight: 100
    - route:
        - destination:
            host: <app-name>
            port:
              number: 80
          weight: 90
        - destination:
            host: <app-name>-canary
            port:
              number: 80
          weight: 10
```

**ArgoCD Rollout (canary with automated promotion)**:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: <app-name>-rollout
  namespace: <namespace>
spec:
  replicas: 10
  selector:
    matchLabels:
      app: <app-name>
  template:
    metadata:
      labels:
        app: <app-name>
    spec:
      containers:
        - name: <app-name>
          image: <registry>/<image>:<tag>
  strategy:
    canary:
      maxSurge: "25%"
      maxUnavailable: 0
      steps:
        - setWeight: 10
        - pause: { duration: 5m }
        - setWeight: 50
        - pause: { duration: 5m }
        - setWeight: 100
        - pause: { duration: 10m }    # manual promotion gate
      analysis:
        templates:
          - templateName: <success-rate-check>
        args:
          - name: service-name
            value: <app-name>-svc
```

```yaml
# AnalysisTemplate referenced by the Rollout
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: <success-rate-check>
spec:
  metrics:
    - name: success-rate
      successCondition: result >= 0.99
      provider:
        prometheus:
          query: |
            1 - sum(rate(http_requests_total{app="<app-name>",status=~"5.."}[5m]))
                / sum(rate(http_requests_total{app="<app-name>"}[5m]))
```

### Common Pitfalls

- Blue-green with no `maxSurge` protection (green can overwhelm resources)
- Canary without automated analysis (manual only = human forgets)
- Rolling update with `maxUnavailable: 1` and `replicas: 1` → downtime
- No PDB → evictions during rollout can exceed allowed disruption
- No long-enough canary observation window (5s is not enough for metric lag)

### Verification

```bash
# Check rollout status
kubectl rollout status deployment/<app-name> -n <namespace> --watch

# ArgoCD Rollout dashboard
kubectl argo rollouts get rollout <app-name>-rollout -n <namespace>

# Canary: verify traffic split
kubectl exec deploy/<app-name> -n <namespace> -- \
  curl -s http://<app-name>-svc/health | jq .version

# Blue-green: verify selector swap
kubectl get svc <app-name>-svc -n <namespace> -o json | jq .spec.selector
```

---

## 10. FEATURE FLAGS — LaunchDarkly Pattern

### Problem

Deploying incomplete features into mainline requires long-lived feature branches,
merge hell, and coordination delays. Feature flags decouple deploy from release.

### Runnable Configs

**LaunchDarkly client initialization** (`lib/feature-flags.ts`):

```typescript
import { init } from '@launchdarkly/node-server-sdk';

const ldClient = await init(process.env.LAUNCHDARKLY_SDK_KEY, {
  stream: true,               // real-time updates
  flushIntervalSeconds: 5,    // analytics events batch interval
});

export async function getFlag<T>(
  flagKey: string,
  user: { key: string; email?: string; custom?: Record<string, unknown> },
  defaultValue: T,
): Promise<T> {
  try {
    const value = await ldClient.variation(flagKey, user, defaultValue);
    return value as T;
  } catch {
    return defaultValue;      // fail-open by design
  }
}
```

**Flag evaluation middleware** (`middleware/feature-flag.ts`):

```typescript
import { Request, Response, NextFunction } from 'express';
import { getFlag } from '../lib/feature-flags';

// Middleware that blocks access unless a flag is enabled
export function featureGate(flagKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const enabled = await getFlag(flagKey, {
      key: req.user?.id ?? 'anonymous',
      email: req.user?.email,
      custom: {
        plan: req.user?.plan,
        beta: req.user?.beta ?? false,
      },
    }, false);

    if (!enabled) {
      return res.status(404).json({ error: 'Not found' });
    }
    next();
  };
}

// Usage:
// router.get('/new-feature', featureGate('new-dashboard'), handler);
```

**Flag lifecycle** (flag definition in LaunchDarkly / flag YAML):

```yaml
# flags/<flag-name>.yaml — stored in repo for audit trail
name: "new-dashboard"
key: "new-dashboard"
kind: boolean
tags:
  - "frontend"
  - "dashboard-team"
temporary: true
description: "Enable the redesigned dashboard for beta users"
variations:
  - value: true
    description: "New dashboard"
  - value: false
    description: "Old dashboard"
defaults:
  onVariation: 0    # false — kill switch
  offVariation: 0
rules:
  - description: "Beta users get new dashboard"
    clauses:
      - attribute: "beta"
        operator: in
        values: ["true"]
      - attribute: "plan"
        operator: in
        values: ["beta", "enterprise"]
    variation: 0     # true
```

**Flag evaluation patterns**:

```typescript
// Pattern 1: Boolean toggle
const enabled = await getFlag('new-dashboard', user, false);
if (enabled) { renderNewDashboard(); } else { renderOldDashboard(); }

// Pattern 2: Multivariate (A/B test variant)
const variant = await getFlag<string>('checkout-experiment', user, 'control');
switch (variant) {
  case 'variant-a': showCheckoutA(); break;
  case 'variant-b': showCheckoutB(); break;
  default:          showControl();
}

// Pattern 3: Gradual rollout (percentage)
const rolloutPercent = await getFlag<number>('dark-launch-percent', user, 0);
if (Math.random() * 100 < rolloutPercent) { enableFeature(); }

// Pattern 4: Kill switch (override all rules)
// Set flag to false in LaunchDarkly UI = instant kill, no deploy needed
```

**Flag cleanup** (when permanent):

```diff
  // After the flag is fully rolled out and stabilized:
- const enabled = await getFlag('new-dashboard', user, false);
- if (enabled) {
-   renderNewDashboard();
- } else {
-   renderOldDashboard();
- }
+ renderNewDashboard(); // always on, delete old path
```

### Common Pitfalls

- No default value → app crashes if LaunchDarkly is unreachable
- Boolean only flags → makes A/B testing harder (use multivariate)
- Stale flags in code → dead branches accumulate (schedule cleanup review)
- Long-lived "temporary" flags → never removed (set a TTL in flag metadata)
- Flags in the hot path of a tight loop → LD SDK makes streaming calls; cache per request

### Verification

```bash
# Evaluate a flag locally
curl -s "https://sdk.launchdarkly.com/sdk/latest-all/<sdk-key>" | \
  jq '.["<flag-key>"]'

# Check SDK stream is connected (monitor logs)
grep "LaunchDarkly" /var/log/app/current.log | tail -5

# Verify kill switch works (set flag false in UI, confirm behavior)
curl -f http://localhost:<port>/new-feature -w "%{http_code}"
# Should return 404 when gate is blocking
```

---

## VERIFICATION CHECKLIST

Before declaring container orchestration complete:

### Docker
- [ ] Multi-stage Dockerfile with distroless/slim production stage
- [ ] Non-root user (`USER 1001` or named user)
- [ ] `.dockerignore` excludes `.git`, `node_modules`, secrets
- [ ] `HEALTHCHECK` defined
- [ ] Image scanned (`docker scout quick`) with no critical CVEs
- [ ] `docker compose up` starts all services without errors

### Kubernetes
- [ ] Deployments use `RollingUpdate` strategy with `maxUnavailable: 0`
- [ ] Readiness probe points to `/ready` (not same as liveness)
- [ ] Startup probe configured for slow-init containers
- [ ] Resource `requests` and `limits` set on every container
- [ ] Ingress has TLS and `ssl-redirect` annotation
- [ ] Secrets not committed in plaintext (sops / SealedSecret / external-secrets)
- [ ] PDB configured with `minAvailable >= 2`
- [ ] HPA configured with both CPU and memory targets
- [ ] `kubectl apply --dry-run=client` passes

### Helm
- [ ] `Chart.yaml` has valid `appVersion`, `version`, dependencies
- [ ] `values.yaml` has all configuration surfaces
- [ ] Environment-specific values files exist (not inline `--set`)
- [ ] `helm lint` passes with zero warnings
- [ ] `helm template` produces valid YAML (pipe to `kubectl apply --dry-run`)

### Autoscaling
- [ ] HPA or KEDA configured with `minReplicas >= 2`
- [ ] Scale-down stabilization window set (300s minimum)
- [ ] Cluster Autoscaler deployed with `scale-down-delay-after-add`
- [ ] KEDA triggers reflect real business signals (queue depth, request rate)

### Infrastructure as Code
- [ ] Remote state backend configured with state locking
- [ ] State bucket has versioning and encryption enabled
- [ ] Environment-specific `terraform.tfvars` files exist
- [ ] `terraform fmt -recursive` passes
- [ ] No secrets in `.tfvars` (use Vault or sops)

### Build Caching
- [ ] Dockerfile ordered by change frequency (lockfiles before source)
- [ ] CI uses `docker/build-push-action` with `cache-from`/`cache-to`
- [ ] Registry cache has `mode=max` for multi-stage caching
- [ ] `.dockerignore` prevents unnecessary daemon context

### Deploy Strategy
- [ ] Rollout strategy selected (rolling / blue-green / canary)
- [ ] Automated analysis or observation window configured for canary
- [ ] Rollback procedure documented and tested
- [ ] ArgoCD Rollout (if used) has AnalysisTemplate with Prometheus metrics

### Feature Flags
- [ ] SDK initialized with fail-on-error default values
- [ ] Flag evaluation uses user context (key, email, plan)
- [ ] Feature gate middleware returns 404 (not 403) for unauthenticated users
- [ ] Stale flags have scheduled removal review
- [ ] Kill switch verified (set false → feature disabled without deploy)

## RULES

- ALWAYS produce runnable configs, never theory
- ALWAYS mark placeholders as `<variable>` for user substitution
- ALWAYS set resource limits — never deploy unbounded containers
- ALWAYS use remote state with locking for Terraform
- ALWAYS validate manifests with `--dry-run` before applying
- ALWAYS encrypt secrets before committing
- ALWAYS have a rollback plan before any deploy
- NEVER hardcode secrets, IPs, or domains in configs
- NEVER use `latest` tag in production Helm values
- NEVER put secrets in ConfigMaps or unencrypted values.yaml
- NEVER skip probes on production workloads
- NEVER apply Terraform without reviewing the plan
- NEVER keep stale feature flags in code beyond their TTL
