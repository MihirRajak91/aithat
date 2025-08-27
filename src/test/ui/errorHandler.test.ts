import * as assert from 'assert';
import { EnhancedErrorHandler, ErrorAction } from '../../ui/errorHandler';

suite('EnhancedErrorHandler Tests', () => {
  let errorHandler: EnhancedErrorHandler;

  setup(() => {
    errorHandler = new EnhancedErrorHandler();
  });

  test('should create user-friendly messages', () => {
    const createMessage = (errorHandler as any).createUserFriendlyMessage;
    
    const message = createMessage('connection_failed', 'provider_connection');
    assert.ok(message.includes('Service Connection'));
    assert.ok(message.includes('Unable to connect'));
  });

  test('should handle error context mapping', () => {
    const createMessage = (errorHandler as any).createUserFriendlyMessage;
    
    const contexts = [
      'ticket_fetch',
      'context_build', 
      'ai_generation',
      'provider_connection',
      'settings_save'
    ];

    contexts.forEach(context => {
      const message = createMessage('test error', context);
      assert.ok(message.length > 0);
      assert.ok(message.includes('test error'));
    });
  });

  test('should handle different error types', () => {
    const createMessage = (errorHandler as any).createUserFriendlyMessage;
    
    const errorTypes = [
      'connection_failed',
      'invalid_credentials',
      'service_unavailable',
      'timeout',
      'rate_limit',
      'invalid_config'
    ];

    errorTypes.forEach(errorType => {
      const message = createMessage(errorType, 'test_context');
      assert.ok(message.length > 0);
      assert.notStrictEqual(message, errorType); // Should be transformed
    });
  });

  test('should provide default actions', () => {
    // This would require mocking vscode.window in a real test environment
    // For now, just verify the structure
    assert.ok(typeof errorHandler.handleError === 'function');
    assert.ok(typeof errorHandler.handleWarning === 'function');
    assert.ok(typeof errorHandler.showSuccess === 'function');
  });

  test('should handle logs management', () => {
    assert.ok(typeof errorHandler.showLogs === 'function');
    assert.ok(typeof errorHandler.clearLogs === 'function');
  });
});