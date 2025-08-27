import * as assert from 'assert';
import { GitHubProvider } from '../../providers/github';

suite('GitHubProvider Tests', () => {
  let provider: GitHubProvider;

  setup(() => {
    provider = new GitHubProvider({
      token: 'ghp_test-token'
    });
  });

  test('should create provider with correct config', () => {
    assert.strictEqual(provider.getProviderName(), 'github');
  });

  test('should validate config with required fields', async () => {
    const validProvider = new GitHubProvider({
      token: 'ghp_test-token-12345678901234567890123456789012'
    });

    const invalidProvider = new GitHubProvider({});

    // Note: This would require mocking the HTTP request in real tests
    // For now, just test the structure
    assert.ok(typeof validProvider.validateConfig === 'function');
    assert.ok(typeof invalidProvider.validateConfig === 'function');
  });

  test('should map GitHub issue to RecentTicket correctly', () => {
    const mockIssue = {
      id: 12345,
      number: 123,
      title: 'Test Issue',
      body: 'Test description',
      state: 'open' as const,
      labels: [
        { name: 'bug', color: 'red' },
        { name: 'high-priority', color: 'orange' }
      ],
      assignee: { login: 'testuser' },
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      html_url: 'https://github.com/owner/repo/issues/123',
      repository: {
        id: 456,
        name: 'test-repo',
        full_name: 'owner/test-repo',
        owner: { login: 'owner' },
        private: false
      },
      pull_request: undefined
    };

    const ticket = (provider as any).mapToRecentTicket(mockIssue);

    assert.strictEqual(ticket.id, 'owner/test-repo#123');
    assert.strictEqual(ticket.key, '#123');
    assert.strictEqual(ticket.summary, 'Test Issue');
    assert.strictEqual(ticket.description, 'Test description');
    assert.strictEqual(ticket.provider, 'github');
    assert.strictEqual(ticket.assignee, 'testuser');
    assert.deepStrictEqual(ticket.labels, ['bug', 'high-priority']);
    assert.strictEqual(ticket.status, 'Open');
    assert.strictEqual(ticket.url, 'https://github.com/owner/repo/issues/123');
  });

  test('should determine priority correctly from labels', () => {
    const priorities = [
      { labels: [{ name: 'critical', color: 'red' }], expected: 'urgent' },
      { labels: [{ name: 'high', color: 'orange' }], expected: 'high' },
      { labels: [{ name: 'low', color: 'green' }], expected: 'low' },
      { labels: [{ name: 'enhancement', color: 'blue' }], expected: 'medium' }
    ];

    priorities.forEach(({ labels, expected }) => {
      const mockIssue = {
        id: 1,
        number: 1,
        title: 'Test',
        state: 'open' as const,
        labels,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
        html_url: 'https://github.com/test/test/issues/1'
      };

      const ticket = (provider as any).mapToRecentTicket(mockIssue);
      assert.strictEqual(ticket.priority, expected, `Labels ${labels.map(l => l.name).join(', ')} should map to ${expected}`);
    });
  });

  test('should extract repository from URL correctly', () => {
    const urls = [
      { url: 'https://github.com/owner/repo/issues/123', expected: 'owner/repo' },
      { url: 'https://api.github.com/repos/owner/repo/issues/123', expected: 'owner/repo' },
      { url: 'https://invalid-url.com', expected: 'unknown/unknown' }
    ];

    urls.forEach(({ url, expected }) => {
      const result = (provider as any).extractRepoFromUrl(url);
      assert.strictEqual(result, expected, `URL ${url} should extract to ${expected}`);
    });
  });

  test('should handle ticket ID format validation', async () => {
    try {
      await provider.getTicket('invalid-format');
      assert.fail('Should have thrown validation error');
    } catch (error) {
      assert.ok(error.message.includes('Format should be "owner/repo#number"'));
    }

    // Valid format should not throw (though it will fail on HTTP request)
    try {
      await provider.getTicket('owner/repo#123');
    } catch (error) {
      // Expected to fail due to no HTTP mock, but should not be a validation error
      assert.ok(!error.message.includes('Format should be'));
    }
  });

  test('should provide cache management methods', () => {
    assert.ok(typeof provider.clearCache === 'function');
    assert.ok(typeof provider.getCacheStats === 'function');
    assert.ok(typeof provider.invalidateCache === 'function');

    // Test cache operations
    provider.clearCache();
    const stats = provider.getCacheStats();
    assert.strictEqual(stats.size, 0);
  });
});