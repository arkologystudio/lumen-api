# Diagnostics Engine Phase B - Implementation Plan

## Current Implementation Status

### ✅ Completed Components (Phase A)

#### 1. **Database Architecture**
- All 5 diagnostic tables implemented in Prisma schema
- Complete relationships and indexes for optimal performance
- Multi-tenant data isolation with user_id constraints
- Proper cascade deletions and referential integrity

#### 2. **Scanner Framework**
- **Base Infrastructure**: Modular scanner interface with registry pattern
- **8 Implemented Scanners**:
  - `llms.txt` - AI agent instruction file validation
  - `agent.json` - Root-level agent configuration
  - `ai-agent.json` - Well-known directory agent config
  - `robots` - Robots.txt and meta robots directives
  - `canonical` - Canonical URL validation
  - `sitemap` - XML sitemap detection and validation
  - `seoBasic` - Basic SEO indicators (title, meta description)
  - `jsonLd` - JSON-LD structured data analysis

#### 3. **Crawler Service**
- HTTP-based crawler with content extraction
- JSDOM integration for HTML parsing
- Basic metadata extraction (title, description, word count)
- Redirect chain tracking

#### 4. **Aggregation & Scoring**
- Weighted scoring algorithm (0-10 scale per indicator)
- Category-based aggregation
- AI readiness classification ('excellent', 'good', 'needs_improvement', 'poor')
- Access intent detection ('allow', 'partial', 'block')

#### 5. **REST API Layer**
- 5 fully implemented endpoints:
  - `POST /v1/diagnostics/scan` - Trigger new scans
  - `GET /v1/diagnostics/sites/:siteId/score` - Get latest scores
  - `GET /v1/diagnostics/pages/:pageId/indicators` - Page-level details (Pro)
  - `POST /v1/diagnostics/trigger-rescore` - On-demand rescore (Pro)
  - `GET /v1/diagnostics/audits/:auditId` - Audit details

#### 6. **Authentication & Authorization**
- JWT-based authentication integration
- Subscription tier enforcement (Free vs Pro features)
- Complete tenant isolation

#### 7. **Testing Suite**
- 134 passing unit tests
- Complete coverage of scanners, crawler, aggregator
- TDD-validated implementation

## 🚧 Missing Components for Phase B

### 1. **Testing & Quality Assurance**

#### Integration Tests
- End-to-end diagnostic workflow testing
- Database transaction testing
- Multi-scanner coordination tests
- Error recovery scenarios

#### API Tests
- Endpoint response validation
- Authentication/authorization edge cases
- Rate limiting validation
- Subscription tier feature gating

#### Performance Tests
- Concurrent scan handling
- Large site crawling optimization
- Database query performance
- Memory usage profiling

### 2. **Background Processing & Scheduling**

#### Job Queue System
- Async job submission for long-running scans
- Job status tracking and progress updates
- Worker pool management
- Retry logic for failed jobs

#### Scheduled Audits
- Cron-based scheduling system
- User-configurable audit frequency
- Automatic re-scan triggers
- Schedule management API

#### Background Workers
- Dedicated worker processes
- Queue consumer implementation
- Resource management and throttling

### 3. **Advanced Crawler Features**

#### Playwright Integration
- Replace HTTP crawler with headless browser
- JavaScript rendering capabilities
- Dynamic content extraction
- Screenshot capture functionality

#### Storage Integration
- Supabase Object Storage for raw HTML
- Screenshot storage with CDN delivery
- Efficient storage lifecycle policies
- Compression and optimization

#### Cache System
- 24-hour cache for free tier users
- Delta detection for changed content
- Smart re-crawl decisions
- Cache invalidation strategies

### 4. **Advanced Features**

#### Webhook System
- Configurable webhooks per site
- Score change notifications
- Delivery tracking and retries
- Webhook event types

#### LLM-Powered Scanners
- Advanced SEO content analysis
- Entity recognition and coverage
- Content quality assessment
- AI-readiness recommendations

#### GraphQL Layer
- Rich query capabilities
- Real-time subscriptions
- Complex filtering/aggregation
- Batch operations

#### Monitoring & Analytics
- Usage metrics collection
- Performance monitoring
- Error tracking integration
- Dashboard analytics

## Implementation Timeline

### Phase B.1: Testing & Infrastructure (2 weeks)
**Week 1:**
- Create comprehensive integration test suite
- Implement API endpoint tests
- Add performance benchmarking

**Week 2:**
- Set up CI/CD test automation
- Create test data fixtures
- Document testing procedures

### Phase B.2: Background Processing (3 weeks)
**Week 3-4:**
- Implement job queue system (Bull/Redis or database-based)
- Create worker pool architecture
- Build job status tracking

**Week 5:**
- Add scheduled audit system
- Implement cron job integration
- Create schedule management UI

### Phase B.3: Advanced Crawler (2 weeks)
**Week 6:**
- Integrate Playwright for JavaScript rendering
- Add screenshot capabilities
- Implement advanced content extraction

**Week 7:**
- Set up Supabase Object Storage
- Implement cache system
- Add delta detection logic

### Phase B.4: Advanced Features (3 weeks)
**Week 8:**
- Build webhook notification system
- Create webhook management API
- Add delivery tracking

**Week 9:**
- Implement LLM-powered SEO scanner
- Add content quality analysis
- Create AI recommendations engine

**Week 10:**
- Design GraphQL schema
- Implement GraphQL resolvers
- Add real-time subscriptions

### Phase B.5: Polish & Launch (1 week)
**Week 11:**
- Performance optimization
- Security audit
- Documentation completion
- Production deployment

## Technical Decisions

### Job Queue Options
1. **Bull + Redis** (Recommended)
   - Proven reliability
   - Built-in UI for monitoring
   - Excellent Node.js integration

2. **Database-based Queue**
   - Simpler deployment
   - Uses existing PostgreSQL
   - Good for smaller scale

### Scheduler Options
1. **Supabase Cron** (If available)
   - Native integration
   - Managed service
   - Simple configuration

2. **Node-cron + PM2**
   - Self-hosted flexibility
   - Fine-grained control
   - No external dependencies

### Storage Strategy
- **HTML Content**: Compressed and stored in Supabase Storage
- **Screenshots**: WebP format with CDN delivery
- **Retention**: 30 days for free tier, unlimited for Pro
- **Access**: Signed URLs with expiration

## Success Metrics

### Performance Targets
- Single page scan: < 5 seconds
- Full site scan (20 pages): < 60 seconds
- API response time: < 200ms
- Concurrent scans: 100+ 

### Quality Metrics
- Test coverage: > 90%
- API availability: 99.9%
- Scanner accuracy: > 95%
- User satisfaction: > 4.5/5

## Risk Mitigation

### Technical Risks
1. **Playwright stability**: Implement fallback to HTTP crawler
2. **Storage costs**: Implement smart retention policies
3. **LLM API limits**: Add caching and rate limiting
4. **Database performance**: Implement read replicas if needed

### Business Risks
1. **Feature creep**: Stick to MVP for Phase B
2. **Timeline delays**: Build in 20% buffer time
3. **Resource constraints**: Prioritize core features

## Next Steps

1. **Immediate Actions**:
   - Set up integration test environment
   - Research and select job queue solution
   - Create detailed API test plans

2. **Team Coordination**:
   - Review plan with stakeholders
   - Assign development resources
   - Set up weekly progress reviews

3. **Documentation**:
   - Update API documentation
   - Create scanner development guide
   - Document deployment procedures

## Conclusion

Phase B builds upon the solid foundation of Phase A, adding the production-ready features needed for a complete diagnostics engine. The phased approach ensures we deliver value incrementally while maintaining system stability and performance.