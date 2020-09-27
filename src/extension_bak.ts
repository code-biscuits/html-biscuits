// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import {
  commands,
  window,
  workspace,
  languages,
  ExtensionContext,
} from "vscode";
import { CodelensProvider } from "./CodelensProvider_bak";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "html-biscuits" is now active!');

  const codelensProvider = new CodelensProvider();

  languages.registerCodeLensProvider("*", codelensProvider);

  commands.registerCommand("html-biscuits.enableCodeLens", () => {
    workspace
      .getConfiguration("html-biscuits")
      .update("enableCodeLens", true, true);
  });

  commands.registerCommand("html-biscuits.disableCodeLens", () => {
    workspace
      .getConfiguration("html-biscuits")
      .update("enableCodeLens", false, true);
  });

  commands.registerCommand("html-biscuits.codelensAction", (args: any) => {
    window.showInformationMessage(`CodeLens action clicked with args=${args}`);
  });
}

// this method is called when your extension is deactivated
export function deactivate() {}
