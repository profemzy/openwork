---
name: k8s-hardening
description: |
  Kubernetes security hardening for production workloads.
  Triggers when user mentions:
  - "harden kubernetes"
  - "k8s security"
  - "pod security"
  - "kubernetes RBAC"
  - "network policies"
  - "secure the cluster"
  - "production-ready kubernetes"
---

You apply battle-tested Kubernetes security hardening patterns for production workloads across healthcare, fintech, gaming, and regulated environments.

## Pod security

Every pod spec must include:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 65534
  runAsGroup: 65534
  fsGroup: 65534
  seccompProfile:
    type: RuntimeDefault
```

Every container must include:

```yaml
securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]
  privileged: false
```

If the container needs to write (logs, tmp, cache), mount explicit `emptyDir` volumes at those paths. Never disable `readOnlyRootFilesystem` for convenience.

## Resource management

Every container must have requests and limits:

```yaml
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    memory: 256Mi
```

- Always set memory limits. OOMKill is better than node-level pressure.
- CPU limits are optional and context-dependent. Omit them for latency-sensitive workloads to avoid throttling. Set them for batch/background jobs.
- Use Vertical Pod Autoscaler recommendations to right-size, not guesswork.

## Network policies

Default-deny all ingress and egress per namespace:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

Then explicitly allow required traffic:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-app-ingress
spec:
  podSelector:
    matchLabels:
      app: my-app
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api-gateway
      ports:
        - port: 8080
          protocol: TCP
```

- Egress to DNS (kube-dns, port 53 TCP+UDP) must be explicitly allowed in deny-all namespaces.
- Egress to external APIs should whitelist specific CIDR blocks, not `0.0.0.0/0`.

## RBAC

- Never use `cluster-admin` for workloads. Create scoped roles.
- Service accounts are per-workload, never shared.
- Disable automounting of service account tokens unless needed:

```yaml
automountServiceAccountToken: false
```

- If the pod needs API access, bind the minimum verbs and resources:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
```

- Audit RBAC bindings regularly. Remove stale bindings from departed team members and decommissioned services.

## Secrets management

- Never store secrets in plain Kubernetes Secrets without encryption at rest.
- Prefer external secret stores: HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault.
- Use External Secrets Operator or Sealed Secrets for GitOps workflows.
- If using native Secrets, enable etcd encryption at rest:

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources: ["secrets"]
    providers:
      - aescbc:
          keys:
            - name: key1
              secret: <base64-encoded-key>
      - identity: {}
```

- Rotate secrets on a schedule. Automate rotation, don't rely on manual processes.

## Image security

- Pin images by digest, not tag: `image: nginx@sha256:abc123...`
- Scan images in CI with Trivy, Grype, or Snyk before deployment.
- Use distroless or scratch base images where possible.
- Enforce image pull policies:

```yaml
imagePullPolicy: Always
```

- Use admission controllers (OPA Gatekeeper, Kyverno) to block:
  - Images from untrusted registries
  - Images without signatures (Cosign/Notary)
  - Images with critical CVEs

## Pod disruption budgets

Every HA workload must have a PDB:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: my-app-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: my-app
```

- Use `minAvailable` for stateful workloads.
- Use `maxUnavailable` for stateless workloads that scale horizontally.
- Never set `minAvailable` equal to replica count — this blocks node drains.

## Health probes

Every container must have all three probes:

```yaml
startupProbe:
  httpGet:
    path: /healthz
    port: 8080
  failureThreshold: 30
  periodSeconds: 2
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  periodSeconds: 10
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  periodSeconds: 5
  failureThreshold: 3
```

- Startup probe prevents slow-starting containers from being killed by liveness.
- Liveness and readiness must be separate endpoints. Readiness checks dependencies; liveness checks the process.
- Never put dependency checks in liveness probes — a database outage should not restart your pods.

## Namespace isolation

- One team or service domain per namespace.
- Apply ResourceQuotas per namespace to prevent noisy neighbors:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: namespace-quota
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.memory: 16Gi
    pods: "20"
```

- Apply LimitRanges to enforce per-pod defaults:

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
spec:
  limits:
    - default:
        memory: 256Mi
      defaultRequest:
        memory: 128Mi
        cpu: 100m
      type: Container
```

## Admission control

Use policy engines to enforce standards cluster-wide:

- **OPA Gatekeeper** or **Kyverno** for policy-as-code
- Enforce at minimum:
  - No privileged containers
  - No host namespace sharing (hostPID, hostNetwork, hostIPC)
  - No root users
  - Required resource limits
  - Required labels (team, cost-center, environment)
  - Trusted image registries only

## Audit and observability

- Enable Kubernetes audit logging. Send to a SIEM or log aggregator.
- Monitor RBAC denials — they indicate misconfiguration or potential intrusion.
- Alert on:
  - Pods running as root
  - Containers with `privileged: true`
  - Failed image pulls (potential registry compromise)
  - Unexpected exec into pods
  - Service account token usage from outside the cluster

## Supply chain security

- Sign container images with Cosign.
- Generate and store SBOMs for every image.
- Use `ImagePolicyWebhook` or Kyverno to verify signatures at admission.
- Pin Helm chart versions in GitOps repos. Never use `latest` or floating tags.
- Review third-party Helm charts before adoption. Audit templates for privilege escalation.
