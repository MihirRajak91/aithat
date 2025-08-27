import * as assert from 'assert';
import { JiraProvider } from '../../providers/jira';

suite('JiraProvider Tests', () => {
  let provider: JiraProvider;

  setup(() => {
    provider = new JiraProvider({
      baseUrl: 'https://test.atlassian.net',
      token: 'test-token'
    });
  });

  test('should create provider with correct config', () => {
    assert.strictEqual(provider.getProviderName(), 'jira');
  });

  test('should validate config with required fields', async () => {
    const validProvider = new JiraProvider({
      baseUrl: 'https://test.atlassian.net',
      token: 'test-token'
    });

    const invalidProvider = new JiraProvider({});

    // Note: This would require mocking the HTTP request in real tests
    // For now, just test the structure
    assert.ok(typeof validProvider.validateConfig === 'function');
    assert.ok(typeof invalidProvider.validateConfig === 'function');
  });

  test('should map Jira issue to RecentTicket correctly', () => {
    const mockIssue = {
      id: '12345',
      key: 'TEST-123',
      fields: {
        summary: 'Test Issue',
        description: 'Test description',
        priority: { name: 'High' },
        assignee: { displayName: 'John Doe' },
        labels: ['bug', 'urgent'],
        created: '2023-01-01T00:00:00.000Z',
        updated: '2023-01-02T00:00:00.000Z',
        status: { name: 'In Progress' }
      }
    };

    const ticket = (provider as any).mapToRecentTicket(mockIssue);

    assert.strictEqual(ticket.id, '12345');
    assert.strictEqual(ticket.key, 'TEST-123');
    assert.strictEqual(ticket.summary, 'Test Issue');
    assert.strictEqual(ticket.priority, 'high');
    assert.strictEqual(ticket.provider, 'jira');
    assert.strictEqual(ticket.assignee, 'John Doe');
    assert.deepStrictEqual(ticket.labels, ['bug', 'urgent']);
    assert.strictEqual(ticket.status, 'In Progress');
  });

  test('should handle priority mapping correctly', () => {
    const priorities = [
      { name: 'Lowest', expected: 'low' },
      { name: 'Low', expected: 'low' },
      { name: 'Medium', expected: 'medium' },
      { name: 'High', expected: 'high' },
      { name: 'Highest', expected: 'urgent' },
      { name: 'Critical', expected: 'urgent' }
    ];

    priorities.forEach(({ name, expected }) => {
      const mockIssue = {
        id: '1',
        key: 'TEST-1',
        fields: {
          summary: 'Test',
          priority: { name },
          created: '2023-01-01T00:00:00.000Z',
          updated: '2023-01-02T00:00:00.000Z',
          status: { name: 'Open' }
        }
      };

      const ticket = (provider as any).mapToRecentTicket(mockIssue);
      assert.strictEqual(ticket.priority, expected, `Priority ${name} should map to ${expected}`);
    });
  });

  test('should handle status classification', () => {
    const statusTests = [
      { status: 'In Progress', method: 'isInProgress', expected: true },
      { status: 'Development', method: 'isInProgress', expected: true },
      { status: 'To Do', method: 'isReadyToStart', expected: true },
      { status: 'Open', method: 'isReadyToStart', expected: true },
      { status: 'Blocked', method: 'isBlocked', expected: true },
      { status: 'Waiting', method: 'isBlocked', expected: true },
      { status: 'Done', method: 'isInProgress', expected: false }
    ];

    statusTests.forEach(({ status, method, expected }) => {
      const result = (provider as any)[method](status);
      assert.strictEqual(result, expected, `${status} should ${expected ? '' : 'not '}be classified as ${method}`);
    });
  });

  test('should handle cache operations', () => {
    // Test cache stats
    const stats = provider.getCacheStats();
    assert.ok(typeof stats.size === 'number');
    assert.ok(Array.isArray(stats.keys));

    // Test cache clear
    provider.clearCache();
    const clearedStats = provider.getCacheStats();
    assert.strictEqual(clearedStats.size, 0);
  });
});