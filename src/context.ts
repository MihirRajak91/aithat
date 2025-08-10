import * as vscode from 'vscode';

let extensionContext: vscode.ExtensionContext | null = null;

export function setExtensionContext(context: vscode.ExtensionContext): void {
  extensionContext = context;
}

export function getExtensionContext(): vscode.ExtensionContext | null {
  return extensionContext;
}


