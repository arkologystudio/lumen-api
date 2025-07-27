# WordPress Plugin Licensing Compliance Guide

## 🎯 Overview

This guide ensures your WordPress plugin correctly integrates with the Lumen API's licensing system. Follow these requirements to maintain compliance and proper functionality.

## 🔑 Authentication Requirements

### 1. Dual Authentication System (Updated Implementation)
Your WordPress plugin **MUST** use both API key authentication AND license validation:

```php
// Required headers for all search requests
$headers = [
    'Content-Type: application/json',
    'x-api-key: ' . $lumen_api_key,        // API key for authentication
    'X-License-Key: ' . $lumen_license_key  // License key for usage validation
];
```

### 2. License Keys
- Each user must have a valid license for the product (`lumen-search-api`)
- License keys enforce query limits and feature access
- License keys determine if agent/API access is permitted

### 3. Site-Specific API Keys
- Each WordPress site needs its own unique API key
- API keys are scoped to specific operations: `['search', 'embed']`
- API keys are tied to a specific site ID in the Lumen system

## 🚨 Critical Implementation Requirements

### 1. Search Endpoint Usage
**Endpoint**: `POST /api/sites/{site_id}/search`

```php
function lumen_search($query, $site_id, $api_key, $license_key) {
    $response = wp_remote_post("https://api.lumen.com/api/sites/{$site_id}/search", [
        'headers' => [
            'Content-Type' => 'application/json',
            'x-api-key' => $api_key,
            'X-License-Key' => $license_key
        ],
        'body' => json_encode([
            'query' => $query,
            'topK' => 5
        ]),
        'timeout' => 30
    ]);
    
    if (is_wp_error($response)) {
        error_log('Lumen search failed: ' . $response->get_error_message());
        return false;
    }
    
    // Check for license-related headers
    $headers = wp_remote_retrieve_headers($response);
    $usage_info = [
        'current' => $headers['X-Query-Usage-Current'] ?? null,
        'limit' => $headers['X-Query-Usage-Limit'] ?? null,
        'remaining' => $headers['X-Query-Usage-Remaining'] ?? null,
        'period_end' => $headers['X-Query-Period-End'] ?? null,
    ];
    
    $data = json_decode(wp_remote_retrieve_body($response), true);
    if ($data['success']) {
        $data['usage'] = $usage_info;
        return $data;
    }
    
    return false;
}
```

### 2. Content Embedding
**Endpoint**: `POST /api/sites/{site_id}/embed`

```php
function lumen_embed_content($posts, $site_id, $api_key) {
    $response = wp_remote_post("https://api.lumen.com/api/sites/{$site_id}/embed", [
        'headers' => [
            'Content-Type' => 'application/json',
            'x-api-key' => $api_key
        ],
        'body' => json_encode(['posts' => $posts]),
        'timeout' => 60
    ]);
    
    return !is_wp_error($response);
}
```

## 📋 Licensing Compliance Checklist

### ✅ Required Plugin Features

1. **API Key Validation**
   ```php
   function validate_lumen_credentials($api_key, $license_key, $site_id) {
       // Test both API key and license key
       $test_response = wp_remote_post("https://api.lumen.com/api/sites/{$site_id}/search", [
           'headers' => [
               'Content-Type' => 'application/json',
               'x-api-key' => $api_key,
               'X-License-Key' => $license_key
           ],
           'body' => json_encode(['query' => 'test', 'topK' => 1])
       ]);
       
       $code = wp_remote_retrieve_response_code($test_response);
       if ($code === 200) {
           return ['valid' => true, 'message' => 'Credentials valid'];
       } elseif ($code === 401) {
           return ['valid' => false, 'message' => 'Invalid API key'];
       } elseif ($code === 403) {
           $body = json_decode(wp_remote_retrieve_body($test_response), true);
           return ['valid' => false, 'message' => $body['error'] ?? 'License validation failed'];
       } elseif ($code === 429) {
           return ['valid' => false, 'message' => 'Query limit exceeded'];
       }
       
       return ['valid' => false, 'message' => 'Unknown error occurred'];
   }
   ```

2. **Error Handling for License Issues**
   ```php
   function handle_lumen_response($response) {
       if (is_wp_error($response)) {
           return ['error' => 'Connection failed'];
       }
       
       $code = wp_remote_retrieve_response_code($response);
       $body = json_decode(wp_remote_retrieve_body($response), true);
       
       switch ($code) {
           case 401:
               return ['error' => 'Invalid API key - check your Lumen dashboard'];
           case 403:
               return ['error' => 'API key lacks required permissions'];
           case 429:
               return ['error' => 'Rate limit exceeded - please try again later'];
           default:
               return $body;
       }
   }
   ```

3. **Rate Limiting Compliance**
   ```php
   function lumen_search_with_rate_limit($query, $site_id, $api_key) {
       // Check if we've made too many requests recently
       $recent_requests = get_transient('lumen_recent_requests') ?: 0;
       
       if ($recent_requests >= 60) { // Max 60 requests per minute
           return ['error' => 'Rate limit exceeded'];
       }
       
       $result = lumen_search($query, $site_id, $api_key);
       
       // Increment counter
       set_transient('lumen_recent_requests', $recent_requests + 1, 60);
       
       return $result;
   }
   ```

### ⚙️ Configuration Requirements

1. **Required Settings**
   ```php
   // Plugin must store these settings securely
   define('LUMEN_API_KEY', get_option('lumen_api_key'));
   define('LUMEN_SITE_ID', get_option('lumen_site_id'));
   define('LUMEN_API_URL', get_option('lumen_api_url', 'https://api.lumen.com'));
   ```

2. **Settings Validation**
   ```php
   function validate_lumen_settings() {
       $api_key = get_option('lumen_api_key');
       $site_id = get_option('lumen_site_id');
       
       if (empty($api_key) || empty($site_id)) {
           add_action('admin_notices', function() {
               echo '<div class="notice notice-error"><p>Lumen Search: API key and Site ID are required.</p></div>';
           });
           return false;
       }
       
       return true;
   }
   ```

## 🔐 Security Requirements

### 1. API Key Storage
```php
// Store API keys securely (never in plain text in database dumps)
function secure_store_api_key($api_key) {
    // Option 1: Use WordPress's built-in encryption if available
    if (function_exists('wp_hash_password')) {
        update_option('lumen_api_key', $api_key, false); // false = don't autoload
    }
    
    // Option 2: Store in wp-config.php (recommended for production)
    // define('LUMEN_API_KEY', 'your-key-here');
}
```

### 2. Input Sanitization
```php
function sanitize_search_query($query) {
    // Remove potential XSS and limit length
    $query = sanitize_text_field($query);
    $query = substr($query, 0, 500); // Limit query length
    
    if (empty(trim($query))) {
        return false;
    }
    
    return $query;
}
```

## 🚦 Error Handling & User Experience

### 1. Graceful Degradation
```php
function lumen_search_with_fallback($query) {
    $lumen_results = lumen_search_with_rate_limit($query, LUMEN_SITE_ID, LUMEN_API_KEY);
    
    if (isset($lumen_results['error'])) {
        // Fall back to WordPress native search
        return [
            'results' => get_wordpress_search_results($query),
            'source' => 'wordpress_fallback',
            'error' => $lumen_results['error']
        ];
    }
    
    return [
        'results' => $lumen_results['results'],
        'source' => 'lumen',
        'total' => count($lumen_results['results'])
    ];
}
```

### 2. User Feedback
```php
function display_search_results($results) {
    if ($results['source'] === 'wordpress_fallback') {
        echo '<div class="lumen-notice">Using basic search due to: ' . 
             esc_html($results['error']) . '</div>';
    }
    
    foreach ($results['results'] as $result) {
        // Display results...
    }
}
```

## 📊 Usage Analytics (Optional but Recommended)

```php
function track_search_usage($query, $results_count) {
    $usage_data = get_option('lumen_usage_stats', []);
    $today = date('Y-m-d');
    
    if (!isset($usage_data[$today])) {
        $usage_data[$today] = ['searches' => 0, 'results' => 0];
    }
    
    $usage_data[$today]['searches']++;
    $usage_data[$today]['results'] += $results_count;
    
    // Keep only last 30 days
    $usage_data = array_slice($usage_data, -30, null, true);
    
    update_option('lumen_usage_stats', $usage_data);
}
```

## 🧪 Testing Requirements

### 1. API Connection Test
```php
function test_lumen_connection() {
    $api_key = get_option('lumen_api_key');
    $site_id = get_option('lumen_site_id');
    
    if (!$api_key || !$site_id) {
        return ['success' => false, 'message' => 'Missing configuration'];
    }
    
    $response = wp_remote_post("https://api.lumen.com/api/sites/{$site_id}/search", [
        'headers' => [
            'Content-Type' => 'application/json',
            'x-api-key' => $api_key
        ],
        'body' => json_encode(['query' => 'test connection', 'topK' => 1]),
        'timeout' => 10
    ]);
    
    if (is_wp_error($response)) {
        return ['success' => false, 'message' => $response->get_error_message()];
    }
    
    $code = wp_remote_retrieve_response_code($response);
    return [
        'success' => $code === 200,
        'message' => $code === 200 ? 'Connection successful' : "HTTP {$code}"
    ];
}
```

### 2. Admin Test Interface
```php
function lumen_admin_test_page() {
    if (isset($_POST['test_connection'])) {
        $test_result = test_lumen_connection();
        $message = $test_result['success'] 
            ? '<div class="notice notice-success"><p>✅ ' . $test_result['message'] . '</p></div>'
            : '<div class="notice notice-error"><p>❌ ' . $test_result['message'] . '</p></div>';
        echo $message;
    }
    
    echo '<form method="post">';
    echo '<button type="submit" name="test_connection" class="button button-primary">Test Lumen Connection</button>';
    echo '</form>';
}
```

## 🔄 Update and Maintenance

### 1. API Endpoint Updates
- Always use the base URL from settings (don't hardcode)
- Check API documentation for endpoint changes
- Implement version checking if available

### 2. Monitoring
```php
function lumen_health_check() {
    $last_check = get_option('lumen_last_health_check', 0);
    
    // Check once per hour
    if (time() - $last_check < 3600) {
        return;
    }
    
    $connection_test = test_lumen_connection();
    if (!$connection_test['success']) {
        // Log error or notify admin
        error_log('Lumen API health check failed: ' . $connection_test['message']);
    }
    
    update_option('lumen_last_health_check', time());
}

// Hook into WordPress cron
add_action('init', function() {
    if (!wp_next_scheduled('lumen_health_check')) {
        wp_schedule_event(time(), 'hourly', 'lumen_health_check');
    }
});
add_action('lumen_health_check', 'lumen_health_check');
```

## 📊 Usage Monitoring and Headers

The API now returns usage information in response headers:

```php
function display_usage_info($search_result) {
    if (isset($search_result['usage'])) {
        $usage = $search_result['usage'];
        
        echo '<div class="lumen-usage-info">';
        if ($usage['limit'] !== 'unlimited') {
            $percentage = ($usage['current'] / $usage['limit']) * 100;
            echo "<p>Queries used: {$usage['current']}/{$usage['limit']} ({$percentage}%)</p>";
            
            if ($percentage > 80) {
                echo '<div class="notice notice-warning"><p>⚠️ Approaching query limit</p></div>';
            }
        } else {
            echo '<p>✅ Unlimited queries available</p>';
        }
        echo '</div>';
    }
}
```

### Response Headers Available:
- `X-Query-Usage-Current`: Current period query count
- `X-Query-Usage-Limit`: Query limit for current period
- `X-Query-Usage-Remaining`: Remaining queries
- `X-Query-Period-End`: When current period ends
- `X-License-Type`: License tier (standard, premium, etc.)
- `X-Agent-Access`: Whether agent/API access is enabled

## ✅ System Status

**Updated**: The Lumen API now implements complete license validation:

1. ✅ **License Validation**: Search endpoints validate license keys
2. ✅ **Usage Limits**: Query limits are enforced per billing period
3. ✅ **Usage Headers**: All documented headers are implemented
4. ✅ **Agent Access Control**: Agent/API access is enforced based on license tier
5. ✅ **Automatic Period Reset**: Query periods reset automatically
6. ✅ **Usage Tracking**: Complete query usage tracking and analytics

## 📞 Support and Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check API key and regenerate if needed
2. **403 Forbidden**: 
   - Verify API key has required scopes (`search`, `embed`)
   - Check if license key is valid and not expired
   - Verify agent access is enabled for bot requests
3. **404 Not Found**: Verify site ID exists in Lumen dashboard
4. **429 Query Limit Exceeded**: 
   - Check usage with headers or `/api/licenses/{id}/usage` endpoint
   - Upgrade license tier or wait for period reset
   - Implement query caching to reduce API calls
5. **License Validation Failed**: Verify license key is correct and active

### Best Practices

1. **Cache Results**: Cache search results for 5-10 minutes to reduce API calls
2. **Timeout Handling**: Set reasonable timeouts (30s for search, 60s for embed)
3. **Fallback Strategy**: Always provide WordPress native search as fallback
4. **Error Logging**: Log API errors for debugging but don't expose to users
5. **User Privacy**: Don't log search queries unless explicitly permitted

---

**Last Updated**: After implementing complete license validation system
**Compliance Status**: This guide reflects the updated API with full license enforcement, query limits, and usage tracking