# MONITORING — Logging, Error Tracking, Alerts

## PURPOSE

Sets up monitoring, logging, and alerting for production apps.

## TRIGGERS

- "Set up monitoring"
- "Add error tracking"
- "Configure alerts"

## COMPONENTS

### Logging

- Structured logging (JSON)
- Log levels: debug, info, warn, error
- Correlation IDs for tracing
- Sensitive data filtering

### Error Tracking

- Sentry, LogRocket, or similar
- Source map upload
- Release tracking
- User impact context

### Performance Monitoring

- APM (Application Performance Monitoring)
- Database query monitoring
- API latency tracking
- Frontend performance (Core Web Vitals)

### Alerting

- Error rate thresholds
- Latency thresholds
- Availability thresholds
- Business metric anomalies

### Analytics

- User behavior tracking
- Feature adoption
- Conversion funnels
- Retention metrics

## RULES

- ALWAYS implement structured logging
- ALWAYS add error tracking from day one
- ALWAYS monitor Core Web Vitals (web)
- ALWAYS set up critical alerts
- ALWAYS track business metrics
- NEVER log sensitive data
- NEVER skip alert configuration