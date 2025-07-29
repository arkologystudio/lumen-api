# WordPress Plugin Integration Guide

This guide shows how to integrate the Lumen semantic search API with WordPress plugins using the complete license assignment system.

## 🔐 Complete Setup Flow

### 1. Site Owner Registration and License Purchase

```bash
# Step 1: Site owner registers and purchases license
POST /api/auth/register
{
  "email": "owner@example.com",
  "password": "password123",
  "name": "Site Owner"
}

# Step 2: Purchase license (via frontend/billing)
POST /api/purchases/simulate
Authorization: Bearer <jwt-token>
{
  "product_slug": "lumen-search-api",
  "license_type": "standard",
  "billing_period": "monthly"
}
# Response includes license_key: "ABCD-EFGH-IJKL-MNOP"

# Step 3: Create site
POST /api/sites
Authorization: Bearer <jwt-token>
{
  "name": "My WordPress Blog",
  "url": "https://myblog.com",
  "description": "Personal tech blog"
}
# Response includes site_id: "site-uuid-12345"

# Step 4: Create API key for site
POST /api/api-keys
Authorization: Bearer <jwt-token>
{
  "name": "WordPress Plugin Key",
  "site_id": "site-uuid-12345",
  "scopes": ["search", "embed"]
}
# Response includes full API key (shown once only)

# Step 5: Assign license to site
POST /api/licenses/<license-id>/assign-site
Authorization: Bearer <jwt-token>
{
  "site_id": "site-uuid-12345"
}
```

### 2. Get Site Credentials for WordPress

```bash
# Step 6: Get complete credentials for WordPress plugin
GET /api/sites/site-uuid-12345/credentials
Authorization: Bearer <jwt-token>

# Response:
{
  "success": true,
  "site": {
    "id": "site-uuid-12345",
    "name": "My WordPress Blog",
    "url": "https://myblog.com"
  },
  "credentials": {
    "api_key": {
      "key_prefix": "lm_12345678",
      "scopes": ["search", "embed"],
      "note": "Full API key shown once during creation"
    },
    "license": {
      "license_key": "ABCD-EFGH-IJKL-MNOP",
      "license_type": "standard",
      "max_queries": 100,
      "query_count": 0
    }
  },
  "setup_complete": true,
  "next_steps": []
}
```

### 3. WordPress Plugin Configuration

```php
<?php
// wp-config.php or plugin settings
define('LUMEN_API_URL', 'https://api.lumen.com');
define('LUMEN_API_KEY', 'lm_12345678abcdef1234567890...');  // From credentials API
define('LUMEN_LICENSE_KEY', 'ABCD-EFGH-IJKL-MNOP');         // From credentials API
define('LUMEN_SITE_ID', 'site-uuid-12345');
```

## 🚀 Plugin Implementation

### Content Embedding (WordPress → Lumen)

```php
<?php
/**
 * Embed posts when they are published/updated
 */
class LumenEmbedder {
    
    public function __construct() {
        add_action('save_post', [$this, 'embed_post'], 10, 2);
        add_action('wp_ajax_lumen_embed_all', [$this, 'embed_all_posts']);
    }
    
    /**
     * Embed a single post to Lumen
     */
    public function embed_post($post_id, $post) {
        // Only embed published posts
        if ($post->post_status !== 'publish') {
            return;
        }
        
        // Prepare post data for embedding
        $post_data = [
            'id' => $post_id,
            'title' => $post->post_title,
            'content' => $post->post_content,
            'excerpt' => $post->post_excerpt,
            'url' => get_permalink($post_id),
            'date' => $post->post_date,
            'author' => get_the_author_meta('display_name', $post->post_author),
            'categories' => wp_get_post_categories($post_id, ['fields' => 'names']),
            'tags' => wp_get_post_tags($post_id, ['fields' => 'names'])
        ];
        
        // Send to Lumen API
        $this->send_to_lumen([$post_data]);
    }
    
    /**
     * Embed all published posts (bulk operation)
     */
    public function embed_all_posts() {
        $posts = get_posts([
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'post_type' => 'post'
        ]);
        
        $batch_data = [];
        foreach ($posts as $post) {
            $batch_data[] = [
                'id' => $post->ID,
                'title' => $post->post_title,
                'content' => $post->post_content,
                'excerpt' => $post->post_excerpt,
                'url' => get_permalink($post->ID),
                'date' => $post->post_date,
                'author' => get_the_author_meta('display_name', $post->post_author),
                'categories' => wp_get_post_categories($post->ID, ['fields' => 'names']),
                'tags' => wp_get_post_tags($post->ID, ['fields' => 'names'])
            ];
        }
        
        // Send in batches of 10
        $batches = array_chunk($batch_data, 10);
        foreach ($batches as $batch) {
            $this->send_to_lumen($batch);
        }
        
        wp_send_json_success(['message' => 'All posts embedded successfully']);
    }
    
    /**
     * Send posts to Lumen API for embedding
     */
    private function send_to_lumen($posts) {
        $response = wp_remote_post(LUMEN_API_URL . '/api/sites/' . LUMEN_SITE_ID . '/embed', [
            'headers' => [
                'Content-Type' => 'application/json',
                'x-api-key' => LUMEN_API_KEY
            ],
            'body' => json_encode(['posts' => $posts]),
            'timeout' => 60
        ]);
        
        if (is_wp_error($response)) {
            error_log('Lumen embedding failed: ' . $response->get_error_message());
            return false;
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (!$data['success']) {
            error_log('Lumen embedding error: ' . $data['error']);
            return false;
        }
        
        return true;
    }
}

new LumenEmbedder();
```

### Search Interface (Frontend)

```php
<?php
/**
 * Semantic search functionality
 */
class LumenSearch {
    
    public function __construct() {
        add_action('wp_enqueue_scripts', [$this, 'enqueue_scripts']);
        add_action('wp_ajax_lumen_search', [$this, 'handle_search']);
        add_action('wp_ajax_nopriv_lumen_search', [$this, 'handle_search']);
        add_shortcode('lumen_search', [$this, 'search_shortcode']);
    }
    
    /**
     * Enqueue frontend scripts
     */
    public function enqueue_scripts() {
        wp_enqueue_script('lumen-search', plugin_dir_url(__FILE__) . 'js/search.js', ['jquery'], '1.0.0', true);
        wp_localize_script('lumen-search', 'lumen_ajax', [
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('lumen_search_nonce')
        ]);
    }
    
    /**
     * Handle AJAX search requests
     */
    public function handle_search() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'lumen_search_nonce')) {
            wp_send_json_error(['message' => 'Invalid nonce']);
        }
        
        $query = sanitize_text_field($_POST['query']);
        $top_k = intval($_POST['top_k'] ?? 5);
        
        if (empty($query)) {
            wp_send_json_error(['message' => 'Query is required']);
        }
        
        // Search via Lumen API
        $response = wp_remote_post(LUMEN_API_URL . '/api/sites/' . LUMEN_SITE_ID . '/search', [
            'headers' => [
                'Content-Type' => 'application/json',
                'x-api-key' => LUMEN_API_KEY,
                'x-license-key' => LUMEN_LICENSE_KEY
            ],
            'body' => json_encode([
                'query' => $query,
                'topK' => $top_k
            ]),
            'timeout' => 30
        ]);
        
        if (is_wp_error($response)) {
            wp_send_json_error(['message' => 'Search failed: ' . $response->get_error_message()]);
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (!$data['success']) {
            wp_send_json_error(['message' => $data['error']]);
        }
        
        // Format results for frontend
        $formatted_results = [];
        foreach ($data['data']['results'] as $result) {
            $formatted_results[] = [
                'title' => $result['title'],
                'excerpt' => wp_trim_words($result['content'], 30),
                'url' => $result['url'],
                'similarity' => round($result['similarity'] * 100, 1) . '%',
                'date' => date('M j, Y', strtotime($result['date'])),
                'author' => $result['author'] ?? 'Unknown'
            ];
        }
        
        wp_send_json_success([
            'results' => $formatted_results,
            'total' => count($formatted_results),
            'query' => $query
        ]);
    }
    
    /**
     * Search shortcode
     */
    public function search_shortcode($atts) {
        $atts = shortcode_atts([
            'placeholder' => 'Search articles...',
            'button_text' => 'Search',
            'max_results' => 5
        ], $atts);
        
        ob_start();
        ?>
        <div class="lumen-search-container">
            <form class="lumen-search-form" data-max-results="<?php echo esc_attr($atts['max_results']); ?>">
                <div class="search-input-group">
                    <input 
                        type="text" 
                        class="lumen-search-input" 
                        placeholder="<?php echo esc_attr($atts['placeholder']); ?>"
                        required
                    >
                    <button type="submit" class="lumen-search-button">
                        <?php echo esc_html($atts['button_text']); ?>
                    </button>
                </div>
            </form>
            
            <div class="lumen-search-results" style="display: none;">
                <div class="results-header">
                    <h3>Search Results</h3>
                    <span class="results-count"></span>
                </div>
                <div class="results-list"></div>
            </div>
            
            <div class="lumen-search-loading" style="display: none;">
                <p>Searching...</p>
            </div>
        </div>
        
        <style>
        .lumen-search-container {
            max-width: 600px;
            margin: 20px 0;
        }
        
        .search-input-group {
            display: flex;
            gap: 10px;
        }
        
        .lumen-search-input {
            flex: 1;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 6px;
            font-size: 16px;
        }
        
        .lumen-search-button {
            padding: 12px 24px;
            background: #0073aa;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
        }
        
        .lumen-search-button:hover {
            background: #005a87;
        }
        
        .search-result-item {
            padding: 15px;
            border: 1px solid #eee;
            border-radius: 6px;
            margin: 10px 0;
        }
        
        .search-result-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 8px;
        }
        
        .search-result-title a {
            color: #0073aa;
            text-decoration: none;
        }
        
        .search-result-meta {
            font-size: 12px;
            color: #666;
            margin: 5px 0;
        }
        
        .search-result-excerpt {
            color: #333;
            line-height: 1.6;
        }
        </style>
        <?php
        return ob_get_clean();
    }
}

new LumenSearch();
```

### Frontend JavaScript

```javascript
// js/search.js
jQuery(document).ready(function($) {
    $('.lumen-search-form').on('submit', function(e) {
        e.preventDefault();
        
        const $form = $(this);
        const $input = $form.find('.lumen-search-input');
        const $results = $('.lumen-search-results');
        const $loading = $('.lumen-search-loading');
        const query = $input.val().trim();
        const maxResults = parseInt($form.data('max-results')) || 5;
        
        if (!query) {
            alert('Please enter a search query');
            return;
        }
        
        // Show loading state
        $results.hide();
        $loading.show();
        
        // Perform search
        $.ajax({
            url: lumen_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'lumen_search',
                nonce: lumen_ajax.nonce,
                query: query,
                top_k: maxResults
            },
            success: function(response) {
                $loading.hide();
                
                if (response.success) {
                    displayResults(response.data);
                } else {
                    alert('Search failed: ' + response.data.message);
                }
            },
            error: function() {
                $loading.hide();
                alert('Search request failed. Please try again.');
            }
        });
    });
    
    function displayResults(data) {
        const $results = $('.lumen-search-results');
        const $resultsList = $('.results-list');
        const $resultsCount = $('.results-count');
        
        // Clear previous results
        $resultsList.empty();
        
        if (data.results.length === 0) {
            $resultsList.html('<p>No results found for your query.</p>');
        } else {
            data.results.forEach(function(result) {
                const resultHtml = `
                    <div class="search-result-item">
                        <div class="search-result-title">
                            <a href="${result.url}" target="_blank">${result.title}</a>
                        </div>
                        <div class="search-result-meta">
                            ${result.date} by ${result.author} • ${result.similarity} match
                        </div>
                        <div class="search-result-excerpt">
                            ${result.excerpt}
                        </div>
                    </div>
                `;
                $resultsList.append(resultHtml);
            });
        }
        
        $resultsCount.text(`${data.total} result${data.total === 1 ? '' : 's'} for "${data.query}"`);
        $results.show();
    }
});
```

## 🔧 Admin Interface

```php
<?php
/**
 * Admin settings page
 */
class LumenAdmin {
    
    public function __construct() {
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'init_settings']);
    }
    
    public function add_admin_menu() {
        add_options_page(
            'Lumen Search Settings',
            'Lumen Search',
            'manage_options',
            'lumen-search',
            [$this, 'settings_page']
        );
    }
    
    public function init_settings() {
        register_setting('lumen_search', 'lumen_api_key');
        register_setting('lumen_search', 'lumen_site_id');
        register_setting('lumen_search', 'lumen_api_url');
    }
    
    public function settings_page() {
        ?>
        <div class="wrap">
            <h1>Lumen Search Settings</h1>
            
            <form method="post" action="options.php">
                <?php settings_fields('lumen_search'); ?>
                
                <table class="form-table">
                    <tr>
                        <th scope="row">API Key</th>
                        <td>
                            <input type="password" name="lumen_api_key" value="<?php echo esc_attr(get_option('lumen_api_key')); ?>" class="regular-text" />
                            <p class="description">Your Lumen API key from the dashboard</p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">Site ID</th>
                        <td>
                            <input type="text" name="lumen_site_id" value="<?php echo esc_attr(get_option('lumen_site_id')); ?>" class="regular-text" />
                            <p class="description">Your site ID from the Lumen dashboard</p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">API URL</th>
                        <td>
                            <input type="url" name="lumen_api_url" value="<?php echo esc_attr(get_option('lumen_api_url', 'https://api.lumen.com')); ?>" class="regular-text" />
                            <p class="description">Lumen API endpoint URL</p>
                        </td>
                    </tr>
                </table>
                
                <?php submit_button(); ?>
            </form>
            
            <h2>Actions</h2>
            <p>
                <button type="button" class="button button-primary" onclick="embedAllPosts()">
                    Embed All Posts
                </button>
                <span class="description">This will send all published posts to Lumen for semantic search indexing.</span>
            </p>
            
            <div id="embed-status" style="margin-top: 10px;"></div>
        </div>
        
        <script>
        function embedAllPosts() {
            const button = event.target;
            const status = document.getElementById('embed-status');
            
            button.disabled = true;
            button.textContent = 'Embedding...';
            status.innerHTML = '<p>Starting embedding process...</p>';
            
            fetch(ajaxurl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'action=lumen_embed_all'
            })
            .then(response => response.json())
            .then(data => {
                button.disabled = false;
                button.textContent = 'Embed All Posts';
                
                if (data.success) {
                    status.innerHTML = '<p style="color: green;">✅ ' + data.data.message + '</p>';
                } else {
                    status.innerHTML = '<p style="color: red;">❌ Error: ' + data.data.message + '</p>';
                }
            })
            .catch(error => {
                button.disabled = false;
                button.textContent = 'Embed All Posts';
                status.innerHTML = '<p style="color: red;">❌ Request failed: ' + error.message + '</p>';
            });
        }
        </script>
        <?php
    }
}

new LumenAdmin();
```

## 📊 Usage Example

### Site Visitor Experience
1. **Visit WordPress Site**: User goes to `https://myblog.com`
2. **Use Search Widget**: User types "machine learning tutorials" in the Lumen search box
3. **Instant Results**: Plugin sends query to Lumen API using site's API key
4. **Semantic Results**: User sees most relevant posts, even if they don't contain exact keywords

### Behind the Scenes
```
User Query: "machine learning tutorials"
    ↓
WordPress Plugin (with API key: lm_12345678...)
    ↓
POST /api/sites/site-uuid-12345/search
x-api-key: lm_12345678abcdef1234567890abcdef1234567890abcdef1234567890
x-license-key: ABCD-EFGH-IJKL-MNOP
{
  "query": "machine learning tutorials",
  "topK": 5
}
    ↓
Lumen API validates API key scope ['search'] and license key
    ↓
Vector similarity search in site's content
    ↓
Return semantically similar posts
    ↓
WordPress displays results to user
```

## 🚀 Benefits

✅ **No User Accounts Required**: Site visitors search without signing up  
✅ **Secure API Access**: Each site has its own scoped API key  
✅ **Real-time Search**: Instant semantic search results  
✅ **Easy Setup**: One-time configuration by site owner  
✅ **Automatic Embedding**: Posts are indexed when published  
✅ **Rate Limited**: Prevents API abuse  
✅ **Usage Tracking**: Monitor API key usage  

This creates a seamless semantic search experience for WordPress sites! 🎯 