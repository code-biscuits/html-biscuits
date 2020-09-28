// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import {
  commands,
  window,
  workspace,
  languages,
  ExtensionContext,
} from "vscode";
import * as vscodeHtml from "vscode-html-languageservice";
export { activate } from "./activate";

// this method is called when your extension is deactivated
export function deactivate() {}
