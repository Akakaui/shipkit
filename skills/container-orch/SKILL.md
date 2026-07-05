---
title: Container Orchestration
description: "Docker containers, Compose for local dev, Kubernetes for production, service discovery, CI/CD pipeline."
triggers:
  - "Docker setup"
  - "containerize"
  - "Kubernetes config"
  - "docker compose"
  - "helm chart"
  - "service discovery"
  - "container CI/CD"
owner-agent: deployer
---

# Container Orchestration

## Dockerfile Best Practices
- Use multi-stage builds
- Use `.dockerignore`
- Prefer distroless or alpine base images
- Pin base image versions (no `:latest`)
- Run as non-root user
- Health checks: `HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:3000/health`

## Docker Compose (Local Dev)
- Named volumes for persistence
- `.env` file for local config
- Dependencies with `depends_on` + healthcheck
- Override file for production differences

## Kubernetes
- Resource requests + limits on all containers
- Liveness + readiness probes
- Pod disruption budgets for critical services
- Horizontal Pod Autoscaler for scaling
- ConfigMaps + Secrets for configuration
- RBAC with least privilege
- Network policies for micro-segmentation

## Helm
- Separate values files for environments
- Use `helm lint` and `helm template` in CI
- Chart version matches app version
- Template helpers for common patterns

## CI/CD Pipeline
```yaml
# Stages: lint → test → build → scan → push → deploy
- Lint: Dockerfile lint, chart lint
- Test: Unit + integration
- Build: Multi-arch images (amd64 + arm64)
- Scan: Trivy or Snyk for vulnerabilities
- Push: To container registry with SHA tag + semver tag
- Deploy: Rolling update (K8s) or blue-green
```

## Service Discovery
- Internal DNS in K8s (`<service>.<namespace>.svc.cluster.local`)
- Consul or etcd for VMs
- mTLS for service-to-service auth (Istio or Linkerd)
