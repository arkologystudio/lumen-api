# Frontend Features Implementation Guide

This guide outlines all the features your frontend should implement based on the complete licensing and site management system.

## 🎯 **Core User Flows**

### **1. User Registration & Authentication**
- Registration form with email validation
- Login/logout functionality  
- JWT token management
- Password reset capability

### **2. License Management Dashboard**

#### **Purchase Flow**
```typescript
// Purchase licenses for different tiers
interface PurchaseRequest {
  product_slug: "lumen-search-api";
  license_type: "trial" | "standard" | "standard_plus" | "premium" | "premium_plus" | "enterprise";
  billing_period: "monthly" | "annual";
}
```

#### **License Overview**
- **My Licenses**: `GET /api/licenses/my`
  - Show all purchased licenses
  - Display assignment status (assigned/unassigned)
  - License type, expiration, status
- **License Stats**: `GET /api/licenses/my/stats`
  - Total licenses, active/expired counts
  - Usage summaries across all licenses

#### **License Assignment Interface**
- **Available Licenses for Site**: `GET /api/licenses/available-for-site/:site_id`
  - Dropdown to assign unassigned licenses to sites
  - Show currently assigned license
  - Warning if trying to reassign
- **Assign License**: `POST /api/licenses/:license_id/assign-site`
- **Unassign License**: `DELETE /api/licenses/:license_id/unassign-site`

### **3. Site Management Dashboard**

#### **Site CRUD Operations**
- **Create Site**: `POST /api/sites`
  - Form: name, URL, description
- **List Sites**: `GET /api/users/sites`
  - Grid/list view with site cards
- **Site Details**: `GET /api/sites/:site_id`
- **Edit Site**: `PUT /api/sites/:site_id`
- **Delete Site**: `DELETE /api/sites/:site_id` (with confirmation)

#### **Site Setup Wizard**
- **Step 1**: Create site
- **Step 2**: Generate API key (`POST /api/api-keys`)
- **Step 3**: Assign license
- **Step 4**: Show WordPress plugin configuration

#### **Site Credentials**
- **Get Credentials**: `GET /api/sites/:site_id/credentials`
  - Display setup status (`setup_complete: boolean`)
  - Show API key prefix (full key only shown once)
  - Show assigned license details
  - Next steps if incomplete
  - Copy-to-clipboard for WordPress configuration

### **4. API Key Management**

#### **API Key Dashboard**
- **List Keys**: `GET /api/api-keys`
  - Show all user's API keys
  - Key prefix, scopes, last used, status
- **Create Key**: `POST /api/api-keys`
  - Form: name, site selection, scopes
  - Show full key only once with copy button
- **Delete Key**: `DELETE /api/api-keys/:key_id`

### **5. Usage Monitoring & Analytics**

#### **License Usage Details**
- **Usage for License**: `GET /api/licenses/:license_id/usage`
  ```typescript
  interface UsageData {
    queries_used: number;
    queries_remaining: number | null;
    query_period_start: string;
    query_period_end: string | null;
    downloads_used: number;
    downloads_remaining: number | null;
    sites_used: number;
    sites_remaining: number;
    agent_access_enabled: boolean;
    custom_embedding_enabled: boolean;
  }
  ```

#### **Usage Dashboard Components**
- **Query Usage Chart**: Progress bars, usage over time
- **Period Information**: Current billing cycle dates
- **Upgrade Prompts**: When approaching limits
- **Usage Alerts**: Visual warnings at 80%, 90%, 100%

#### **Site Statistics**
- **Site Stats**: `GET /api/sites/:site_id/stats`
  - Embedding status, post count, chunk count
  - Search performance metrics

## 🎨 **UI Components Needed**

### **1. License Cards**
```typescript
interface LicenseCard {
  license: License;
  assigned_site?: Site;
  usage_percentage: number;
  status_color: "green" | "yellow" | "red";
  actions: ("assign" | "unassign" | "upgrade" | "view_usage")[];
}
```

### **2. Site Cards**
```typescript
interface SiteCard {
  site: Site;
  setup_complete: boolean;
  assigned_license?: License;
  api_key_count: number;
  last_search?: string;
  actions: ("configure" | "view_stats" | "edit" | "delete")[];
}
```

### **3. Usage Widgets**
- **Query Usage Bar**: Current/limit with percentage
- **Period Countdown**: Days until reset
- **Feature Badges**: Agent access, custom embedding
- **Upgrade CTA**: When approaching limits

### **4. Setup Flow Components**
- **Progress Stepper**: 4-step site setup
- **Credentials Display**: Copy-to-clipboard interface
- **WordPress Instructions**: Code snippets for plugin config

## 🔧 **Feature-Specific Interfaces**

### **1. License Assignment Modal**
```typescript
interface LicenseAssignmentModal {
  site: Site;
  available_licenses: License[];
  current_assignment?: License;
  onAssign: (licenseId: string, siteId: string) => void;
  onUnassign: (licenseId: string) => void;
}
```

### **2. Site Setup Wizard**
```typescript
interface SiteSetupWizard {
  steps: [
    { id: "create", title: "Create Site", completed: boolean },
    { id: "api_key", title: "Generate API Key", completed: boolean },
    { id: "license", title: "Assign License", completed: boolean },
    { id: "configure", title: "Configure Plugin", completed: boolean }
  ];
  current_step: number;
  site?: Site;
  api_key?: ApiKey;
  license?: License;
}
```

### **3. Usage Dashboard**
```typescript
interface UsageDashboard {
  licenses: LicenseWithUsage[];
  total_queries_used: number;
  total_queries_remaining: number;
  next_renewal_date: string;
  upgrade_recommendations: UpgradeRecommendation[];
}
```

## 📱 **Page Structure**

### **Main Navigation**
- Dashboard (overview)
- Sites (management)
- Licenses (purchase & assignment)
- API Keys (management)
- Usage (analytics)
- Settings (account)

### **Dashboard Page**
- Quick stats cards
- Recent activity feed
- Usage alerts
- Quick actions (create site, purchase license)

### **Sites Page**
- Site cards grid
- "Add Site" button
- Filters: setup status, assigned license
- Search/sort functionality

### **Licenses Page**
- License cards with assignment status
- "Purchase License" button
- Assignment quick actions
- Usage summary charts

### **Site Detail Page**
- Site information
- Setup status
- Credentials section
- Usage for this site
- WordPress configuration guide

## 🚨 **Error Handling & States**

### **Common Error States**
- License quota exceeded (429)
- Invalid API key (401)
- License validation failed (403)
- Site not found (404)

### **Loading States**
- Fetching licenses
- Assigning license
- Generating API key
- Processing usage data

### **Empty States**
- No licenses purchased
- No sites created
- No API keys generated

## 🔄 **Real-time Features**

### **Usage Updates**
- Poll usage data every 5 minutes
- Real-time quota warnings
- Automatic period reset detection

### **License Status**
- Monitor expiration dates
- Alert on expired licenses
- Renewal reminders

## 🎯 **Key User Actions**

### **Primary Actions**
1. **Purchase License** → License selection flow
2. **Create Site** → Site setup wizard
3. **Assign License to Site** → Assignment modal
4. **Get WordPress Credentials** → Copy configuration
5. **Monitor Usage** → Usage dashboard

### **Secondary Actions**
1. **Reassign License** → Unassign + assign flow
2. **Upgrade License** → Purchase higher tier
3. **Reset Usage** → Admin action
4. **Download Usage Report** → Analytics export

## 📊 **Analytics & Reporting**

### **User-Facing Analytics**
- Usage trends over time
- Most searched content
- Query performance metrics
- Site comparison charts

### **Admin Analytics** (if applicable)
- System-wide usage patterns
- Revenue analytics
- License utilization rates

---

## 🚀 **Implementation Priority**

### **Phase 1: Core Functionality**
1. User authentication
2. License purchase/management
3. Site CRUD operations
4. Basic license assignment

### **Phase 2: WordPress Integration**
1. API key management
2. Site credentials interface
3. WordPress configuration guide
4. Setup wizard

### **Phase 3: Advanced Features**
1. Usage monitoring dashboard
2. Real-time updates
3. Advanced analytics
4. Upgrade recommendations

This comprehensive guide provides everything needed to build a complete frontend that leverages all the licensing and site management capabilities of your API! 🎯