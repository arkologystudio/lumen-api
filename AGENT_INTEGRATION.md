# AI Agent Integration Guide

This document describes how AI agents (ChatGPT, Claude, Perplexity, etc.) can interact with Lumen Search on WordPress sites to perform semantic searches.

## Overview

Lumen Search provides dedicated endpoints and JavaScript functions for AI agents to search content on WordPress sites without requiring authentication beyond the site's configured API credentials. Agents are tracked separately from human users for analytics while having equal access within quota limits.

## Quick Start for Agents

When visiting a WordPress site with Lumen Search installed, agents can use these global JavaScript functions:

### Knowledge/Blog Search

```javascript
// Search blog posts and knowledge content
await window.lumenAgentSearch({
    query: "machine learning tutorials",
    agent_id: "chatgpt-4",
    agent_name: "GPT-4",
    limit: 5
});
```

### Product Search (WooCommerce)

```javascript
// Search WooCommerce products
await window.lumenWCAgentSearch({
    query: "wireless headphones",
    agent_id: "claude-3",
    agent_name: "Claude",
    limit: 10,
    min_price: 50,
    max_price: 200,
    category: "electronics"
});
```

## Agent Identification

Agents should identify themselves using these parameters:

- **agent_id**: A unique identifier for your agent instance (e.g., "chatgpt-web-browser", "claude-3-opus")
- **agent_name**: A human-readable name (e.g., "GPT-4", "Claude", "Perplexity")

## Available Endpoints

### Direct AJAX Endpoints

Agents can also make direct POST requests to these WordPress AJAX endpoints:

#### Knowledge Search
```
POST /wp-admin/admin-ajax.php
Content-Type: application/x-www-form-urlencoded

action=lumen_agent_search
&query=your+search+query
&agent_id=your-agent-id
&agent_name=your-agent-name
&limit=10
```

#### Product Search
```
POST /wp-admin/admin-ajax.php
Content-Type: application/x-www-form-urlencoded

action=lumen_wc_agent_search
&query=product+search+query
&agent_id=your-agent-id
&agent_name=your-agent-name
&limit=10
&min_price=0
&max_price=1000
&category=electronics
&brand=apple
```

## Response Format

### Success Response

```json
{
    "success": true,
    "data": {
        "success": true,
        "query": "machine learning",
        "results": [
            {
                "id": 123,
                "title": "Introduction to Machine Learning",
                "content": "Machine learning is a subset of artificial intelligence...",
                "url": "https://example.com/intro-to-ml",
                "similarity": 0.92,
                "type": "post"
            }
        ],
        "total_results": 5,
        "site_id": "site-uuid-12345",
        "source": "lumen_semantic_search",
        "agent": {
            "id": "chatgpt-4",
            "name": "GPT-4"
        }
    }
}
```

### Error Response

```json
{
    "success": false,
    "data": {
        "error": "Query too short",
        "message": "Query must be at least 2 characters",
        "fallback_available": true
    }
}
```

## Discovery Information

Sites expose search capabilities through global JavaScript objects:

```javascript
// Check knowledge search availability
window.lumenSearchInfo
// Returns:
{
    available: true,
    type: 'knowledge',
    endpoint: 'https://site.com/wp-admin/admin-ajax.php?action=lumen_agent_search',
    configured: true
}

// Check product search availability
window.lumenProductSearchInfo
// Returns:
{
    available: true,
    type: 'woocommerce_products',
    endpoint: 'https://site.com/wp-admin/admin-ajax.php?action=lumen_wc_agent_search',
    configured: true,
    filters_supported: ['price_range', 'category', 'brand']
}
```

## Search Parameters

### Common Parameters
- **query** (required): The search query string (2-500 characters)
- **agent_id** (recommended): Your agent's unique identifier
- **agent_name** (recommended): Human-readable agent name
- **limit**: Maximum number of results (default: 10)
- **top_k**: Same as limit, for compatibility

### Product-Specific Parameters
- **min_price**: Minimum price filter
- **max_price**: Maximum price filter
- **category**: Product category filter
- **brand**: Product brand filter

## Rate Limits and Quotas

- Agent requests are subject to the same quota limits as human users
- Quotas are determined by the site's license tier
- No special agent licensing required
- Rate limiting applies equally to all requests

## Best Practices

1. **Always identify your agent** using agent_id and agent_name
2. **Check configuration status** before searching using the info objects
3. **Handle errors gracefully** - sites may have fallback search available
4. **Respect rate limits** - don't make excessive requests
5. **Use appropriate result limits** - request only what you need
6. **Cache results** when appropriate to reduce API calls

## Example: Complete Agent Integration

```javascript
// Function to search a WordPress site with Lumen
async function searchWordPressSite(query, type = 'knowledge') {
    // Check if search is available
    const searchInfo = type === 'product' ? 
        window.lumenProductSearchInfo : 
        window.lumenSearchInfo;
    
    if (!searchInfo || !searchInfo.configured) {
        throw new Error(`${type} search not available on this site`);
    }
    
    try {
        // Perform search based on type
        const results = type === 'product' ?
            await window.lumenWCAgentSearch({
                query: query,
                agent_id: 'my-agent-v1',
                agent_name: 'MyAgent',
                limit: 10
            }) :
            await window.lumenAgentSearch({
                query: query,
                agent_id: 'my-agent-v1',
                agent_name: 'MyAgent',
                limit: 10
            });
        
        return results;
    } catch (error) {
        console.error('Search failed:', error);
        // Handle fallback to native WordPress search if needed
        return null;
    }
}

// Usage
const results = await searchWordPressSite('machine learning tutorials');
console.log(`Found ${results.total_results} results for:`, results.query);
```

## Headers Passed to API

When agents make requests, the following headers are automatically included in the API call:

- **X-Agent-Id**: Your agent_id parameter
- **X-Agent-Name**: Your agent_name parameter
- **X-Original-User-Agent**: The browser's actual user agent
- **User-Agent**: WordPress plugin identifier

These headers are used for:
- Analytics and usage tracking
- Differentiating agent from human traffic
- No access restrictions based on agent status

## Troubleshooting

### "Not configured" Error
The site hasn't completed Lumen Search setup. The site owner needs to configure API credentials.

### "Query limit exceeded" Error
The site has reached its search quota. This resets based on the billing period.

### "Connection failed" Error
Network issue connecting to the Lumen API. The site may offer fallback search.

### No Search Functions Available
The site may not have Lumen Search installed or it may be an older version without agent support.

## Future LLM.txt Integration

Sites implementing this agent integration are prepared for future `llms.txt` standardization. The llms.txt file will reference this documentation and the available functions, making discovery automatic for compatible agents.

## Support

For technical issues or questions about agent integration:
- Repository: https://github.com/your-org/lighthouse-api
- Documentation: This file (AGENT_INTEGRATION.md)