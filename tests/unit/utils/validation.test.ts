// Test utility functions and validation logic
describe('Validation Utilities', () => {
  describe('Email Validation', () => {
    const isValidEmail = (email: string): boolean => {
      if (!email || typeof email !== 'string') return false;
      
      // More strict email validation
      const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      
      // Additional checks
      if (email.includes('..') || 
          email.startsWith('.') || 
          email.endsWith('.') ||
          email.includes(' ') ||
          email.split('@').length !== 2) {
        return false;
      }
      
      const [localPart, domain] = email.split('@');
      if (!localPart || !domain || domain.startsWith('.') || domain.endsWith('.')) {
        return false;
      }
      
      return emailRegex.test(email);
    };

    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'first.last@subdomain.example.com',
        'user123@example123.com',
      ];

      validEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user..name@example.com',
        'user name@example.com',
        'user@example',
        '',
        'user@.com',
        'user@com.',
      ];

      invalidEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(false);
      });
    });
  });

  describe('Password Validation', () => {
    const isValidPassword = (password: string): { valid: boolean; message?: string } => {
      if (password.length < 8) {
        return {
          valid: false,
          message: 'Password must be at least 8 characters long',
        };
      }
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        return {
          valid: false,
          message: 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
        };
      }
      return { valid: true };
    };

    it('should validate strong passwords', () => {
      const strongPasswords = [
        'StrongPass123',
        'MySecure1Password',
        'Test123Password',
        'Complex1Pass',
        'Aa1bcdefgh',
      ];

      strongPasswords.forEach(password => {
        const result = isValidPassword(password);
        expect(result.valid).toBe(true);
        expect(result.message).toBeUndefined();
      });
    });

    it('should reject passwords that are too short', () => {
      const shortPasswords = [
        'Short1',
        'Abc123',
        'Test1',
        '',
        '1234567',
      ];

      shortPasswords.forEach(password => {
        const result = isValidPassword(password);
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Password must be at least 8 characters long');
      });
    });

    it('should reject passwords without required character types', () => {
      const weakPasswords = [
        'alllowercase123', // No uppercase
        'ALLUPPERCASE123', // No lowercase
        'NoNumbersHere', // No numbers
        'onlylowercase', // No uppercase or numbers
        'ONLYUPPERCASE', // No lowercase or numbers
        '12345678', // Only numbers
      ];

      weakPasswords.forEach(password => {
        const result = isValidPassword(password);
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Password must contain at least one lowercase letter, one uppercase letter, and one number');
      });
    });
  });

  describe('JWT TTL Parsing', () => {
    const parseJwtTtl = (ttl: string): number => {
      if (!ttl) return 3600; // 1 hour default

      // Handle time strings like "15m", "1h", "2d"
      const match = ttl.match(/^(\d+)([smhd]?)$/);
      if (!match) return 3600;

      const value = parseInt(match[1]);
      const unit = match[2] || 's';

      switch (unit) {
        case 's':
          return value;
        case 'm':
          return value * 60;
        case 'h':
          return value * 3600;
        case 'd':
          return value * 86400;
        default:
          return value;
      }
    };

    it('should parse seconds correctly', () => {
      expect(parseJwtTtl('30')).toBe(30);
      expect(parseJwtTtl('30s')).toBe(30);
      expect(parseJwtTtl('3600')).toBe(3600);
      expect(parseJwtTtl('3600s')).toBe(3600);
    });

    it('should parse minutes correctly', () => {
      expect(parseJwtTtl('15m')).toBe(900); // 15 * 60
      expect(parseJwtTtl('30m')).toBe(1800); // 30 * 60
      expect(parseJwtTtl('60m')).toBe(3600); // 60 * 60
    });

    it('should parse hours correctly', () => {
      expect(parseJwtTtl('1h')).toBe(3600); // 1 * 3600
      expect(parseJwtTtl('2h')).toBe(7200); // 2 * 3600
      expect(parseJwtTtl('24h')).toBe(86400); // 24 * 3600
    });

    it('should parse days correctly', () => {
      expect(parseJwtTtl('1d')).toBe(86400); // 1 * 86400
      expect(parseJwtTtl('7d')).toBe(604800); // 7 * 86400
      expect(parseJwtTtl('30d')).toBe(2592000); // 30 * 86400
    });

    it('should return default for invalid formats', () => {
      expect(parseJwtTtl('')).toBe(3600);
      expect(parseJwtTtl('invalid')).toBe(3600);
      expect(parseJwtTtl('15x')).toBe(3600);
      expect(parseJwtTtl('abc')).toBe(3600);
      expect(parseJwtTtl('15.5h')).toBe(3600);
    });
  });

  describe('URL Validation', () => {
    const isValidUrl = (url: string): boolean => {
      if (!url || typeof url !== 'string') return false;
      
      try {
        const parsedUrl = new URL(url);
        
        // Only allow http and https protocols
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return false;
        }
        
        // Reject localhost for production use
        if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
          return false;
        }
        
        // Must have a valid hostname
        if (!parsedUrl.hostname || parsedUrl.hostname === '.') {
          return false;
        }
        
        return true;
      } catch {
        return false;
      }
    };

    it('should validate correct URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://example.com',
        'https://www.example.com/path',
        'https://subdomain.example.com',
        'https://example.com:8080',
        'https://example.com/path?query=value',
        'https://example.com/path#fragment',
      ];

      validUrls.forEach(url => {
        expect(isValidUrl(url)).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com', // Wrong protocol
        'example.com', // Missing protocol
        'https://',
        'https://.',
        '',
        'http://localhost', // Localhost not allowed
        'https://127.0.0.1', // IP not allowed
        'javascript:alert(1)', // Wrong protocol
      ];

      invalidUrls.forEach(url => {
        expect(isValidUrl(url)).toBe(false);
      });
    });
  });

  describe('Site ID Validation', () => {
    const isValidSiteId = (siteId: string): boolean => {
      // Site IDs should be non-empty strings with reasonable length
      return typeof siteId === 'string' && 
             siteId.trim().length > 0 && 
             siteId.length <= 255 &&
             /^[a-zA-Z0-9\-_]+$/.test(siteId);
    };

    it('should validate correct site IDs', () => {
      const validSiteIds = [
        'site-123',
        'my_site',
        'Site123',
        'test-site-1',
        'ABC123',
        'site_with_underscores',
      ];

      validSiteIds.forEach(siteId => {
        expect(isValidSiteId(siteId)).toBe(true);
      });
    });

    it('should reject invalid site IDs', () => {
      const invalidSiteIds = [
        '',
        '   ',
        'site with spaces',
        'site@invalid',
        'site.with.dots',
        'site/with/slashes',
        'a'.repeat(256), // Too long
        'special!chars',
      ];

      invalidSiteIds.forEach(siteId => {
        expect(isValidSiteId(siteId)).toBe(false);
      });
    });
  });

  describe('Content Type Validation', () => {
    const isValidContentType = (contentType: string): boolean => {
      const validTypes = ['all', 'post', 'product'];
      return validTypes.includes(contentType);
    };

    it('should validate correct content types', () => {
      const validTypes = ['all', 'post', 'product'];

      validTypes.forEach(type => {
        expect(isValidContentType(type)).toBe(true);
      });
    });

    it('should reject invalid content types', () => {
      const invalidTypes = [
        'page',
        'comment',
        'user',
        'invalid',
        '',
        'ALL',
        'Post',
        'PRODUCT',
      ];

      invalidTypes.forEach(type => {
        expect(isValidContentType(type)).toBe(false);
      });
    });
  });
});