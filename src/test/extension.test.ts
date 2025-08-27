import * as assert from 'assert';
import * as vscode from 'vscode';
import { activate, deactivate } from '../extension';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should activate successfully', async () => {
    const mockContext = {
      subscriptions: [],
      secrets: {
        store: async () => {},
        get: async () => undefined,
        delete: async () => {}
      },
      extensionPath: '/test/path',
      globalState: {
        get: () => undefined,
        update: async () => {}
      },
      workspaceState: {
        get: () => undefined,
        update: async () => {}
      }
    } as any;

    // Should not throw
    assert.doesNotThrow(() => {
      activate(mockContext);
    });
  });

  test('Extension should register commands', async () => {
    const commands = await vscode.commands.getCommands(true);
    
    assert.ok(commands.includes('ai-plan.generateFromRecent'));
    assert.ok(commands.includes('ai-plan.generateFromRecentStreaming'));
    assert.ok(commands.includes('ai-plan.configure'));
    assert.ok(commands.includes('ai-plan.settings'));
  });

  test('Deactivate should not throw', () => {
    assert.doesNotThrow(() => {
      deactivate();
    });
  });
});